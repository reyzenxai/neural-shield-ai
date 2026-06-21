import { config, isAiConfigured } from "../config";
import { logger } from "../utils/logger";
import type { RiskLevel, ScanFlag, ScanInput, ScanResult } from "../types";

const SYSTEM_PROMPT = `You are a cybersecurity expert specializing in scam and fraud detection for the Indian market.
You analyze text, URLs, emails, and other content to detect fraud patterns.

You MUST respond in this exact JSON format with no additional text:
{
  "scamProbability": <number 0.0-1.0>,
  "trustScore": <integer 0-100>,
  "riskLevel": <"safe"|"low"|"medium"|"high"|"critical">,
  "scamType": <string or null>,
  "flags": [
    {
      "flag": "<specific suspicious element found>",
      "severity": <"info"|"warning"|"danger">,
      "description": "<why this is suspicious>"
    }
  ],
  "recommendation": "<clear action in 1-2 sentences for an average Indian user>",
  "detailedAnalysis": "<2-3 sentence professional analysis>"
}

Scam types to detect: phishing, advance_fee, fake_investment, lottery_fraud, tech_support,
romance_scam, impersonation, fake_kyc, upi_fraud, job_fraud, loan_fraud, delivery_scam.

Always err on the side of caution. False positives are better than missed scams.
Use context clues specific to Indian scam patterns (TRAI, KYC, Aadhaar, UPI, SBI, HDFC mentions etc.)`;

const RISK_LEVELS: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];
const SEVERITIES = new Set(["info", "warning", "danger"]);

/** Clamp a number to [min, max]; falls back to `fallback` for non-finite input. */
export function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
}

/** Extract the first balanced JSON object from a model response (handles fences). */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return body.slice(start, end + 1);
}

/** Coerce arbitrary parsed JSON into a well-formed ScanResult shape. */
export function normalize(parsed: Record<string, unknown>): Omit<ScanResult, "aiModel" | "processingTimeMs"> {
  const riskLevel = RISK_LEVELS.includes(parsed.riskLevel as RiskLevel)
    ? (parsed.riskLevel as RiskLevel)
    : "medium";

  const flags: ScanFlag[] = Array.isArray(parsed.flags)
    ? parsed.flags
        .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
        .map((f) => ({
          flag: String(f.flag ?? "Unspecified signal"),
          severity: SEVERITIES.has(String(f.severity)) ? (f.severity as ScanFlag["severity"]) : "warning",
          description: String(f.description ?? ""),
        }))
    : [];

  return {
    scamProbability: clampNumber(parsed.scamProbability, 0, 1, 0.5),
    trustScore: Math.round(clampNumber(parsed.trustScore, 0, 100, 50)),
    riskLevel,
    scamType: parsed.scamType == null ? null : String(parsed.scamType),
    flags,
    recommendation: String(parsed.recommendation ?? "Verify through official channels before acting."),
    detailedAnalysis: String(parsed.detailedAnalysis ?? ""),
  };
}

function buildPrompt(input: ScanInput): string {
  const prompts: Record<ScanInput["type"], string> = {
    message: `Analyze this message for scam indicators:\n\n"${input.content}"`,
    url: `Analyze this URL for phishing and malicious content:\n\nURL: ${input.content}`,
    email: `Analyze this email for phishing and fraud:\n\n${input.content}`,
    phone: `Analyze this phone number for fraud: ${input.content}\nCheck against common Indian scam patterns.`,
    upi: `Analyze this UPI ID for fraud: ${input.content}\nCheck for suspicious patterns, fake merchant names, known fraud patterns.`,
    qr: `Analyze this URL/text extracted from a QR code:\n\n${input.content}`,
    screenshot: `Analyze this extracted text from a screenshot for scam indicators:\n\n"${input.extractedText || input.content}"`,
  };
  return prompts[input.type];
}

export class AIService {
  /**
   * Analyze content for scam/fraud signals via OpenRouter, trying each model in
   * the configured fallback chain until one returns valid JSON.
   * @throws if AI is not configured or all models fail.
   */
  async analyze(input: ScanInput): Promise<ScanResult> {
    if (!isAiConfigured) {
      throw new Error("AI is not configured (missing OPENROUTER_API_KEY).");
    }

    const startTime = Date.now();
    const userPrompt = buildPrompt(input);
    let lastError: unknown;

    for (const model of config.openRouter.models) {
      // Abort a hung upstream call so we can fail over to the next model.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.openRouter.timeoutMs);
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.openRouter.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl,
            "X-Title": "Neural Shield AI",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 1000,
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          lastError = new Error(`Model ${model} HTTP ${response.status}: ${await response.text()}`);
          logger.warn(`AI model ${model} returned HTTP ${response.status}`);
          continue;
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error(`Model ${model} returned empty content`);
          continue;
        }

        const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;
        return {
          ...normalize(parsed),
          aiModel: model,
          processingTimeMs: Date.now() - startTime,
        };
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        lastError = aborted ? new Error(`Model ${model} timed out after ${config.openRouter.timeoutMs}ms`) : err;
        logger.warn(`AI model ${model} failed: ${aborted ? "timeout" : err instanceof Error ? err.message : String(err)}`);
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error(
      `All AI models failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    );
  }
}

export const aiService = new AIService();

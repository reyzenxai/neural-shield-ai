import type { Request, Response } from "express";

import { config } from "../config";
import { aiService } from "../services/ai.service";
import { runEngine } from "../engine";
import { decodeQr, ocrImage } from "../services/extract.service";
import { audit, checkAndConsumeDailyLimit, DailyLimitError, saveScan } from "../services/scan.service";
import { getUserClient, recordApiScan } from "../services/supabase.service";
import { success, failure } from "../utils/response";
import { logger } from "../utils/logger";
import type { AuthUser, ScanInput, ScanResult, SavedScan, ScanType } from "../types";

/**
 * Produce a scan result. v2 (ENGINE_V2=true): the deterministic engine decides the
 * score and the AI only explains. Legacy: the AI returns the full result (unchanged).
 */
function analyzeInput(scanType: ScanType, input: ScanInput): Promise<ScanResult> {
  if (config.engineV2) {
    return runEngine(scanType, input.extractedText || input.content);
  }
  return aiService.analyze(input);
}

/** Persist a scan via the API-key RPC (API auth) or the user's RLS client (web auth). */
async function persistScan(
  req: Request,
  scanType: ScanType,
  stored: { text?: string; url?: string },
  result: ScanResult,
): Promise<SavedScan> {
  const user = req.user as AuthUser;
  if (req.apiKeyHash) {
    const scanId = await recordApiScan(req.apiKeyHash, scanType, stored, result);
    return { ...result, scanId, scanType, createdAt: new Date().toISOString() };
  }
  const db = getUserClient(req.userToken);
  const saved = await saveScan(db, user, scanType, stored, result);
  await audit(db, user.id, `scan_${scanType}`, "scan", req.ip, req.get("user-agent"), {
    scanId: saved.scanId,
    riskLevel: saved.riskLevel,
  });
  return saved;
}

/** Shared pipeline for text-based scans: limit → analyze → persist → respond. */
async function runScan(
  req: Request,
  res: Response,
  scanType: ScanType,
  aiInput: ScanInput,
  stored: { text?: string; url?: string },
): Promise<void> {
  const user = req.user as AuthUser;
  try {
    // Web (JWT) free users are metered; Business API-key calls are not metered here.
    if (!req.apiKeyHash) await checkAndConsumeDailyLimit(getUserClient(req.userToken), user);

    const result = await analyzeInput(scanType, aiInput);
    const saved = await persistScan(req, scanType, stored, result);
    success(res, saved);
  } catch (err) {
    if (err instanceof DailyLimitError) {
      failure(res, err.message, 429, { code: err.code });
      return;
    }
    logger.error(`Scan (${scanType}) failed: ${err instanceof Error ? err.message : String(err)}`);
    failure(res, "Analysis failed. Please try again.", 502);
  }
}

export function scanMessage(req: Request, res: Response): Promise<void> {
  const { text } = req.body as { text: string };
  return runScan(req, res, "message", { type: "message", content: text }, { text });
}

export function scanUrl(req: Request, res: Response): Promise<void> {
  const { url } = req.body as { url: string };
  return runScan(req, res, "url", { type: "url", content: url }, { url, text: url });
}

export function scanEmail(req: Request, res: Response): Promise<void> {
  const { subject, body, sender } = req.body as { subject: string; body: string; sender: string };
  const content = `From: ${sender || "unknown"}\nSubject: ${subject || "(none)"}\n\n${body}`;
  return runScan(req, res, "email", { type: "email", content }, { text: content });
}

export function scanPhone(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone: string };
  return runScan(req, res, "phone", { type: "phone", content: phone }, { text: phone });
}

export function scanUpi(req: Request, res: Response): Promise<void> {
  const { upiId } = req.body as { upiId: string };
  return runScan(req, res, "upi", { type: "upi", content: upiId }, { text: upiId });
}

/** Screenshot scan: OCR the uploaded image, then analyze the extracted text. */
export async function scanScreenshot(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    failure(res, "No image uploaded.", 400);
    return;
  }
  try {
    const text = await ocrImage(req.file.buffer);
    if (text.replace(/\s/g, "").length < 3) {
      failure(res, "Couldn't read any text from that image. Try a clearer screenshot.", 422);
      return;
    }
    const result = await analyzeInput("screenshot", { type: "screenshot", content: text, extractedText: text });
    const saved = await persistScan(req, "screenshot", { text }, result);
    success(res, { ...saved, extractedText: text });
  } catch (err) {
    logger.error(`Screenshot scan failed: ${err instanceof Error ? err.message : String(err)}`);
    failure(res, "Analysis failed. Please try again.", 502);
  }
}

/** QR scan: decode the QR from the uploaded image, then analyze the payload. */
export async function scanQr(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    failure(res, "No image uploaded.", 400);
    return;
  }
  try {
    const decoded = await decodeQr(req.file.buffer);
    if (!decoded) {
      failure(res, "No QR code found in that image.", 422);
      return;
    }
    const isUrl = /^https?:\/\//i.test(decoded);
    const result = await analyzeInput("qr", { type: "qr", content: decoded });
    const saved = await persistScan(req, "qr", isUrl ? { url: decoded, text: decoded } : { text: decoded }, result);
    success(res, { ...saved, decodedText: decoded });
  } catch (err) {
    logger.error(`QR scan failed: ${err instanceof Error ? err.message : String(err)}`);
    failure(res, "Analysis failed. Please try again.", 502);
  }
}

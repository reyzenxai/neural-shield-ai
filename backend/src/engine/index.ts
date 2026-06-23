/**
 * Module I — the Trust Engine orchestrator (docs/trust-engine-architecture.md §1).
 *
 *   normalize → collect (rules + structural; TI/reputation in later weeks)
 *            → risk engine → AI explanation → assembled verdict.
 *
 * The engine decides every number; the AI only narrates. Each collector fails open,
 * so a bug or outage in one source never crashes a scan.
 */

import { aiService, type ExplainSignal } from "../services/ai.service";
import { collectStructural } from "./collectors/structural";
import { ENGINE_VERSION } from "./config/weights";
import { entityFromScan, extractEntities, normalizeUpi, normalizeUrl } from "./normalize";
import { effectiveWeight, computeRisk } from "./risk";
import { runRules, runUpiRules } from "./rules";
import { logger } from "../utils/logger";
import type { ScanFlag, ScanType } from "../types";
import type { DecisionTrace, ScanResultV2, Signal, SourceId } from "./types";

/** Map a signal's base weight to a flag severity for the legacy frontend. */
function severityFor(weight: number): ScanFlag["severity"] {
  if (weight < 0) return "info";
  if (weight >= 28) return "danger";
  if (weight >= 14) return "warning";
  return "info";
}

/** Derive legacy ScanFlags from the signal trail (keeps the existing UI working). */
function signalsToFlags(signals: Signal[]): ScanFlag[] {
  return signals.map((s) => ({
    flag: s.label,
    severity: severityFor(s.weight),
    description: s.evidence ? `${s.label} (${JSON.stringify(s.evidence)})` : s.label,
  }));
}

/**
 * Run the deterministic engine for a scan. Local-only in Week 1 (rules + structural
 * heuristics); network collectors + reputation are added in Weeks 2–3.
 */
export async function runEngine(scanType: ScanType, content: string): Promise<ScanResultV2> {
  const start = Date.now();
  const entity = entityFromScan(scanType, content);

  const sourcesQueried: SourceId[] = [];
  const sourcesFailed: SourceId[] = [];
  const signals: Signal[] = [];

  // ── Rule Engine (content / identity / payment) ──
  sourcesQueried.push("rule_engine");
  try {
    signals.push(...runRules(entity, content));
  } catch (err) {
    sourcesFailed.push("rule_engine");
    logger.warn(`rule_engine failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Structural heuristics (primary URL/domain entity) ──
  sourcesQueried.push("structural");
  try {
    if (entity.type === "url" || entity.type === "domain") {
      signals.push(...collectStructural(entity));
    }
    // Sub-entities embedded in free text / email / QR payloads.
    if (entity.type === "text" || entity.type === "email") {
      const extracted = extractEntities(content);
      for (const u of extracted.urls) signals.push(...collectStructural(normalizeUrl(u), true));
      for (const v of extracted.upis) signals.push(...runUpiRules(normalizeUpi(v)));
    }
  } catch (err) {
    sourcesFailed.push("structural");
    logger.warn(`structural collector failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Coverage = fraction of queried sources that returned without error (drives confidence).
  const coverage = sourcesQueried.length ? (sourcesQueried.length - sourcesFailed.length) / sourcesQueried.length : 0;
  const risk = computeRisk(signals, coverage);

  const trace: DecisionTrace = {
    override: risk.override,
    firedRuleIds: signals.map((s) => s.id),
    sourcesQueried,
    sourcesFailed,
  };

  // ── AI explanation (no numbers; templated fallback on failure) ──
  const explainSignals: ExplainSignal[] = signals
    .filter((s) => effectiveWeight(s) > 0)
    .map((s) => ({ id: s.id, label: s.label, source: s.source }));
  const ai = await aiService.explain({
    entityType: entity.type,
    verdict: { riskLevel: risk.riskLevel, trustScore: risk.trustScore, confidence: risk.confidence },
    signals: explainSignals,
    rawContext: content,
  });

  return {
    scamProbability: risk.scamProbability,
    trustScore: risk.trustScore,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    confidence: risk.confidence,
    verdictLabel: risk.verdictLabel,
    signals,
    decisionTrace: trace,
    flags: signalsToFlags(signals),
    summary: ai.summary,
    recommendation: ai.recommendation,
    scamType: ai.scamType,
    detailedAnalysis: ai.summary, // legacy alias
    aiModel: ai.aiModel,
    engineVersion: ENGINE_VERSION,
    processingTimeMs: Date.now() - start,
    cached: false,
  };
}

/**
 * Module G — the Risk Engine (docs/trust-engine-architecture.md §3, §5, §7).
 *
 * THE only place numbers are produced. Three layers:
 *   1. hard overrides (malicious / allowlist)
 *   2. category-capped weighted accumulation
 *   3. calibration to P (scam probability), T (trust score), C (confidence), band.
 *
 * All weights/caps/thresholds come from config/weights.ts — none are hard-coded here.
 */

import {
  ALLOWLIST_RISK_CAP,
  BAND_THRESHOLDS,
  CATEGORY_CAPS,
  CONFIDENCE_WEIGHTS,
  MALICIOUS_OVERRIDE_MIN_CONFIDENCE,
  TIER_MULTIPLIER,
} from "./config/weights";
import type { RiskLevel } from "../types";
import type { OverrideKind, RiskOutput, Signal, SignalCategory } from "./types";

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Effective weight of a signal: base × own-confidence × source-tier reliability. */
export function effectiveWeight(s: Signal): number {
  return s.weight * s.confidence * TIER_MULTIPLIER[s.sourceTier];
}

/** Map a risk score to its band (docs/trust-engine-architecture.md §7). */
export function bandFor(r: number): RiskLevel {
  if (r >= BAND_THRESHOLDS.critical) return "critical";
  if (r >= BAND_THRESHOLDS.high) return "high";
  if (r >= BAND_THRESHOLDS.medium) return "medium";
  if (r >= BAND_THRESHOLDS.low) return "low";
  return "safe";
}

/** Human verdict label, qualified by confidence (docs/trust-engine-redesign.md §3.3). */
export function verdictLabelFor(band: RiskLevel, c: number): string {
  const high = c >= 0.66;
  const low = c < 0.4;
  switch (band) {
    case "critical":
      return high ? "Dangerous — confirmed" : low ? "Likely dangerous — limited data" : "Dangerous";
    case "high":
      return low ? "Suspicious — verify manually" : "High risk";
    case "medium":
      return low ? "Unverified — caution" : "Some risk — be careful";
    case "low":
      return "Low risk";
    case "safe":
    default:
      return low ? "No red flags found, but limited data" : "Looks safe";
  }
}

/**
 * Confidence C from coverage / reliability / agreement
 * (docs/trust-engine-architecture.md §5). A hard override forces C ≥ 0.95.
 */
export function computeConfidence(
  signals: Signal[],
  coverage: number,
  override: OverrideKind | null,
): number {
  const contributing = signals.filter((s) => effectiveWeight(s) !== 0);
  const reliability =
    contributing.length === 0
      ? 0.5
      : contributing.reduce((a, s) => a + TIER_MULTIPLIER[s.sourceTier], 0) / contributing.length;

  const fPos = contributing.filter((s) => effectiveWeight(s) > 0).length;
  const fNeg = contributing.filter((s) => effectiveWeight(s) < 0).length;
  const agreement = fPos + fNeg === 0 ? 0.5 : Math.abs(fPos - fNeg) / (fPos + fNeg);

  const c = clamp(
    CONFIDENCE_WEIGHTS.coverage * clamp(coverage, 0, 1) +
      CONFIDENCE_WEIGHTS.reliability * reliability +
      CONFIDENCE_WEIGHTS.agreement * agreement,
    0,
    1,
  );
  return override === "malicious" ? Math.max(c, 0.95) : c;
}

/** Detect a qualifying hard override among the signals. */
function findOverride(signals: Signal[]): OverrideKind | null {
  const malicious = signals.some(
    (s) =>
      s.override === "malicious" &&
      s.sourceTier === 1 &&
      s.confidence >= MALICIOUS_OVERRIDE_MIN_CONFIDENCE,
  );
  if (malicious) return "malicious";
  if (signals.some((s) => s.override === "allowlist")) return "allowlist";
  return null;
}

/** Layer-2 capped accumulation → raw risk score. */
function accumulate(signals: Signal[]): number {
  const posByCat = new Map<SignalCategory, number>();
  let neg = 0;
  for (const s of signals) {
    const w = effectiveWeight(s);
    if (w > 0) posByCat.set(s.category, (posByCat.get(s.category) ?? 0) + w);
    else neg += w;
  }
  let pos = 0;
  for (const [cat, raw] of posByCat) pos += Math.min(raw, CATEGORY_CAPS[cat]);
  return clamp(pos + neg, 0, 100);
}

/**
 * Compute the verdict from the full Signal[].
 * @param coverage 0–1 — fraction of applicable sources that returned data (drives confidence).
 */
export function computeRisk(signals: Signal[], coverage = 1): RiskOutput {
  const override = findOverride(signals);

  let riskScore: number;
  if (override === "malicious") {
    riskScore = 100;
  } else {
    riskScore = accumulate(signals);
    if (override === "allowlist") riskScore = Math.min(riskScore, ALLOWLIST_RISK_CAP);
  }

  const confidence = computeConfidence(signals, coverage, override);
  const riskLevel = bandFor(riskScore);
  return {
    riskScore,
    scamProbability: riskScore / 100,
    trustScore: clamp(100 - riskScore, 0, 100),
    confidence,
    riskLevel,
    verdictLabel: verdictLabelFor(riskLevel, confidence),
    override,
  };
}

/**
 * Module I — the Trust Engine orchestrator (docs/trust-engine-architecture.md §1).
 *
 *   normalize → redirect-expand (URLs) → collect (local rules+structural; network TI
 *            in parallel, timeboxed, cache-first) → risk engine → AI explanation.
 *
 * The engine decides every number; the AI only narrates. Every collector fails open,
 * so a bug or outage in one source never crashes a scan — it only lowers confidence.
 */

import { config } from "../config";
import { aiService, type ExplainSignal } from "../services/ai.service";
import { expandUrl } from "./collectors/redirect";
import { runCollectors } from "./collectors/registry";
import { collectStructural } from "./collectors/structural";
import { ENGINE_VERSION } from "./config/weights";
import { entityFromScan, extractEntities, normalizeUpi, normalizeUrl } from "./normalize";
import { reputationSignals } from "./reputation";
import { effectiveWeight, computeRisk } from "./risk";
import { templatedExplanation } from "../services/ai.service";
import { runRules, runUpiRules } from "./rules";
import { logger } from "../utils/logger";
import type { ScanFlag, ScanType } from "../types";
import type { DecisionTrace, Entity, ScanResultV2, Signal, SourceId } from "./types";

const MAX_SUBENTITY_URLS = 3;

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

/** Tag sub-entity signals so the explanation can distinguish embedded links. */
function mark(signals: Signal[], sub: boolean): Signal[] {
  return sub ? signals.map((s) => ({ ...s, fromSubEntity: true })) : signals;
}

export interface RunEngineOpts {
  /** Skip the OpenRouter explanation call and use templatedExplanation instead.
   *  Use for batch/extension calls where AI latency is unacceptable. */
  skipExplain?: boolean;
}

/**
 * Run the deterministic engine for a scan: local rules + structural heuristics, plus
 * the network threat-intel collectors (RDAP age, GSB/URLHaus/PhishTank/OpenPhish),
 * all timeboxed by a single engine-level budget.
 */
export async function runEngine(scanType: ScanType, content: string, opts: RunEngineOpts = {}): Promise<ScanResultV2> {
  const start = Date.now();
  const original = entityFromScan(scanType, content);

  const queried = new Set<SourceId>();
  const failed = new Set<SourceId>();
  const signals: Signal[] = [];

  // ── Rule Engine (content / identity / payment) — always-on, local ──
  queried.add("rule_engine");
  try {
    signals.push(...runRules(original, content));
  } catch (err) {
    failed.add("rule_engine");
    logger.warn(`rule_engine failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  queried.add("structural");

  // ── Build the URL/domain targets to deep-analyze (primary + embedded links) ──
  const targets: { entity: Entity; sub: boolean }[] = [];
  if (original.type === "url" || original.type === "domain") {
    targets.push({ entity: original, sub: false });
  }
  if (original.type === "text" || original.type === "email") {
    const extracted = extractEntities(content);
    for (const u of extracted.urls.slice(0, MAX_SUBENTITY_URLS)) targets.push({ entity: normalizeUrl(u), sub: true });
    for (const v of extracted.upis) signals.push(...runUpiRules(normalizeUpi(v)));
  }

  // ── Network collection under a single engine-level budget ──
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), config.intel.budgetMs);
  try {
    for (const t of targets) {
      let eff = t.entity;
      if (eff.type === "url") {
        const expanded = await expandUrl(eff, budget.signal);
        eff = expanded.entity;
        signals.push(...mark(expanded.signals, t.sub));
      }
      try {
        signals.push(...mark(collectStructural(eff, t.sub), t.sub));
      } catch (err) {
        failed.add("structural");
        logger.warn(`structural failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      const out = await runCollectors(eff, { parentSignal: budget.signal });
      signals.push(...mark(out.signals, t.sub));
      out.queried.forEach((s) => queried.add(s));
      out.failed.forEach((s) => failed.add(s));
    }
  } finally {
    clearTimeout(budgetTimer);
  }

  // ── Reputation Engine — community reports + cached entity intel ──
  queried.add("reputation_db");
  try {
    const repSignals = await reputationSignals(original);
    signals.push(...repSignals);
  } catch (err) {
    failed.add("reputation_db");
    logger.warn(`reputation_db failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Coverage = fraction of attempted (configured) sources that returned without error.
  const coverage = queried.size ? (queried.size - failed.size) / queried.size : 0;
  const risk = computeRisk(signals, coverage);

  const trace: DecisionTrace = {
    override: risk.override,
    firedRuleIds: signals.map((s) => s.id),
    sourcesQueried: [...queried],
    sourcesFailed: [...failed],
  };

  // ── AI explanation (no numbers; templated fallback on failure or when skipped) ──
  const explainSignals: ExplainSignal[] = signals
    .filter((s) => effectiveWeight(s) > 0)
    .map((s) => ({ id: s.id, label: s.label, source: s.source }));
  const explainInput = {
    entityType: original.type,
    verdict: { riskLevel: risk.riskLevel, trustScore: risk.trustScore, confidence: risk.confidence },
    signals: explainSignals,
    rawContext: content,
  };
  const ai = opts.skipExplain
    ? { ...templatedExplanation(explainInput), aiModel: "templated" }
    : await aiService.explain(explainInput);

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

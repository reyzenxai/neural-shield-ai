/**
 * Module G — Reputation Engine (docs/trust-engine-architecture.md §6).
 *
 * Queries the community-report aggregate (app_get_reputation RPC) and converts
 * it to typed Signals. Fails open: any DB error returns [] and is silently
 * recorded as a skipped source by the orchestrator.
 *
 * Thresholds (tunable — bump ENGINE_VERSION on change):
 *   weighted_score ≥ 8  → community_override  (R=100 hard override, tier-1)
 *   weighted_score ≥ 2  → community_abuse     (weight 50, tier-2)
 *   weighted_score ≥ 0.5 → prior_scam_verdict (weight 30, tier-2)
 *   0 reports + clean intel  → clean_history  (weight −15, tier-2)
 */

import { getPublicClient } from "../services/supabase.service";
import { signalFrom } from "./config/weights";
import type { Entity, Signal } from "./types";

interface ReputationData {
  report_count: number;
  weighted_report_score: number;
  intel: Array<{ source: string; verdict: string; fetched_at: string }>;
}

export async function reputationSignals(entity: Entity): Promise<Signal[]> {
  const client = getPublicClient();
  if (!client) return [];

  let data: ReputationData | null = null;
  try {
    const res = await client.rpc("app_get_reputation", {
      p_entity_type: entity.type,
      p_entity_value: entity.value,
    });
    if (res.error || !res.data) return [];
    data = res.data as ReputationData;
  } catch {
    return [];
  }

  const signals: Signal[] = [];
  const ws = data.weighted_report_score;
  const ev = { report_count: data.report_count, weighted_score: ws };

  if (ws >= 8) {
    signals.push(
      signalFrom("reputation.community_override", "reputation_db",
        Math.min(0.95, 0.7 + ws * 0.02), ev),
    );
  } else if (ws >= 2) {
    signals.push(
      signalFrom("reputation.community_abuse", "reputation_db",
        Math.min(0.85, 0.6 + ws * 0.05), ev),
    );
  } else if (ws >= 0.5) {
    signals.push(
      signalFrom("reputation.prior_scam_verdict", "reputation_db",
        Math.min(0.7, 0.5 + ws * 0.1), ev),
    );
  } else if (data.report_count === 0 && data.intel.length > 0 &&
             data.intel.every(i => i.verdict === "safe")) {
    signals.push(
      signalFrom("reputation.clean_history", "reputation_db", 0.4,
        { intel_count: data.intel.length }),
    );
  }

  return signals;
}

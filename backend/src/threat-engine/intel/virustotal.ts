/**
 * VirusTotal URL reputation collector — v3 API (docs/threat-intelligence.md, Tier 2).
 *
 * Maps the detection ratio from 90+ AV engines to:
 *   ratio ≥ 30% → ti.virustotal.ratio_high (+45, T2)
 *   ratio ≥ 10% → ti.virustotal.ratio_low  (+18, T2)
 *
 * Free tier: 4 requests/min. Strategy: submit URL for analysis, poll up to 3×
 * (2s apart) for the result, then give up (fail open). Results cached 2h to stay
 * well inside the free quota. Key-gated: skipped unless VIRUSTOTAL_API_KEY is set.
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { httpFetch, httpJson } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal } from "../types";

const SOURCE = "virustotal" as const;
const BASE = "https://www.virustotal.com/api/v3";

interface VtAnalysisStats {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
}
interface VtAnalysisResponse {
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      stats?: VtAnalysisStats;
      last_analysis_stats?: VtAnalysisStats;
    };
  };
}

/** Map VT stats to signals. Pure — exported for tests. */
export function parseVtStats(stats: VtAnalysisStats): Signal[] {
  const total = stats.malicious + stats.suspicious + stats.undetected + stats.harmless;
  if (total === 0) return [];
  const ratio = (stats.malicious + stats.suspicious) / total;
  if (ratio >= 0.3) return [signalFrom("ti.virustotal.ratio_high", SOURCE, 0.85, { ratio: +ratio.toFixed(3), malicious: stats.malicious, total })];
  if (ratio >= 0.1) return [signalFrom("ti.virustotal.ratio_low", SOURCE, 0.7, { ratio: +ratio.toFixed(3), malicious: stats.malicious, total })];
  return [];
}

async function getVtHeaders(): Promise<Record<string, string>> {
  return { "x-apikey": config.intel.virustotal.apiKey, Accept: "application/json" };
}

async function submitAndPoll(url: string, parentSignal?: AbortSignal): Promise<Signal[]> {
  const headers = await getVtHeaders();

  // Submit URL for analysis
  const submitRes = await httpFetch(`${BASE}/urls`, {
    method: "POST",
    timeoutMs: 5000,
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
    body: `url=${encodeURIComponent(url)}`,
    parentSignal,
  });
  if (!submitRes.ok) throw new Error(`VT submit HTTP ${submitRes.status}`);
  const submitData = (await submitRes.json()) as VtAnalysisResponse;
  const analysisId = submitData.data?.id;
  if (!analysisId) throw new Error("VT: no analysis id in response");

  // Poll up to 3 times for the completed result
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    const result = await httpJson<VtAnalysisResponse>(`${BASE}/analyses/${analysisId}`, {
      timeoutMs: 5000,
      headers,
      parentSignal,
    });
    const attrs = result.data?.attributes;
    if (!attrs) continue;
    const stats = attrs.stats ?? attrs.last_analysis_stats;
    if (attrs.status === "completed" && stats) return parseVtStats(stats);
  }
  // Analysis still queued after retries — fail open
  return [];
}

export const virusTotalCollector: Collector = {
  id: SOURCE,
  appliesTo: (e: Entity) => e.type === "url",
  isConfigured: () => !!config.intel.virustotal.apiKey && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${entity.value}`, () =>
      submitAndPoll(entity.value, ctx.signal),
    );
    return signals;
  },
};

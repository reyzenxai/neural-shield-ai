/**
 * PhishTank (Cisco) — verified phishing URLs (docs/threat-intelligence.md, Tier 1).
 *
 * A verified, in-database match is a HARD malicious override. Gated behind
 * PHISHTANK_ENABLED; an app key (PHISHTANK_APP_KEY) raises the rate limit. For high
 * volume, prefer ingesting the hourly DB dump (a later optimization).
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { httpFetch } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "phishtank";

interface PhishtankResponse {
  results?: { in_database?: boolean; valid?: boolean; verified?: boolean };
}

/** Map a PhishTank checkurl response to an override signal. Pure — exported for tests. */
export function parsePhishtank(data: PhishtankResponse): Signal[] {
  const r = data.results;
  if (r?.in_database && r.valid) {
    return [signalFrom("ti.phishtank.verified", SOURCE, r.verified ? 1 : 0.9, { verified: !!r.verified })];
  }
  return [];
}

export const phishtankCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => e.type === "url",
  isConfigured: () => config.intel.phishtank.enabled && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const body = new URLSearchParams({ url: entity.value, format: "json" });
    if (config.intel.phishtank.appKey) body.set("app_key", config.intel.phishtank.appKey);

    const { signals } = await withCache(ctx.cache, `${SOURCE}:${entity.value}`, async () => {
      const res = await httpFetch("https://checkurl.phishtank.com/checkurl/", {
        method: "POST",
        timeoutMs: 3000,
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "phishtank/neural-shield" },
        parentSignal: ctx.signal,
        body: body.toString(),
      });
      if (!res.ok) throw new Error(`PhishTank HTTP ${res.status}`);
      return parsePhishtank((await res.json()) as PhishtankResponse);
    });
    return signals;
  },
};

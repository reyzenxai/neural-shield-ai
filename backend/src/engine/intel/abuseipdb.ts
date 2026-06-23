/**
 * AbuseIPDB hosting-IP collector (docs/threat-intelligence.md, Tier 2).
 *
 * Resolves the domain to its hosting IP, then queries AbuseIPDB for the abuse
 * confidence score over the last 90 days:
 *   score ≥ 50 → ti.abuseipdb.high (+25, T2)
 *   score ≥ 20 → ti.abuseipdb.low  (+12, T2)
 *
 * Free tier: 1000 checks/day. Results cached 4h (IP reputation changes slowly).
 * Key-gated: skipped unless ABUSEIPDB_API_KEY is set.
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { resolveIps } from "../collectors/dns";
import { httpJson } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal } from "../types";

const SOURCE = "abuseipdb" as const;

interface AbuseIpDbResponse {
  data?: { abuseConfidenceScore?: number; ipAddress?: string };
}

/** Map an AbuseIPDB score to signals. Pure — exported for tests. */
export function parseAbuseScore(score: number, ip: string): Signal[] {
  if (score >= 50) return [signalFrom("ti.abuseipdb.high", SOURCE, 0.8, { score, ip })];
  if (score >= 20) return [signalFrom("ti.abuseipdb.low", SOURCE, 0.65, { score, ip })];
  return [];
}

export const abuseIpDbCollector: Collector = {
  id: SOURCE,
  appliesTo: (e: Entity) => (e.type === "url" || e.type === "domain") && !!e.parts.domain,
  isConfigured: () => !!config.intel.abuseipdb.apiKey && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const domain = entity.parts.domain!;
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${domain}`, async () => {
      const ips = await resolveIps(domain, 2000);
      const ipv4 = ips.find((ip) => !ip.includes(":"));
      if (!ipv4) return [];

      const data = await httpJson<AbuseIpDbResponse>(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ipv4)}&maxAgeInDays=90`,
        {
          timeoutMs: 4000,
          headers: { Key: config.intel.abuseipdb.apiKey, Accept: "application/json" },
          parentSignal: ctx.signal,
        },
      );

      const score = data.data?.abuseConfidenceScore ?? 0;
      return parseAbuseScore(score, ipv4);
    });
    return signals;
  },
};

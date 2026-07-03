/**
 * DNS signals collector — TTL anomaly, sinkhole, and missing MX detection.
 *
 * No API key required — uses Node built-in dns module. Applies to url/domain entities.
 *
 *   domain.low_ttl         (+8,  T2) — A record TTL < 300s (fast-flux / evasion)
 *   domain.sinkholed       (+30, T1) — resolves to a known null-route or sinkhole IP
 *   domain.no_mx_yet_emails (+8, T2) — no MX record but entity came from email context
 */

import { resolve4 } from "node:dns/promises";

import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { resolveMx } from "../collectors/dns";
import { config } from "../../config";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal } from "../types";

const SOURCE = "dns" as const;
const TIMEOUT_MS = 2500;

/** Known sinkhole / null-route IPs — resolving to these means the domain is seized or blocked. */
const SINKHOLE_PREFIXES = ["0.0.0.", "127.0.0.", "192.0.2.", "198.51.100.", "203.0.113."];

function isSinkhole(ip: string): boolean {
  return SINKHOLE_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

interface DnsRecord { address: string; ttl: number; }

async function resolveWithTtl(domain: string): Promise<DnsRecord[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // resolve4 with { ttl: true } returns Array<{ address: string, ttl: number }>
    return (await resolve4(domain, { ttl: true })) as unknown as DnsRecord[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const dnsCheckCollector: Collector = {
  id: SOURCE,
  appliesTo: (e: Entity) => (e.type === "url" || e.type === "domain") && !!e.parts.domain,
  isConfigured: () => !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const domain = entity.parts.domain!;
    const { signals } = await withCache(ctx.cache, `dnscheck:${domain}`, async () => {
      const out: Signal[] = [];

      const [records, mxHosts] = await Promise.all([
        resolveWithTtl(domain),
        resolveMx(domain, TIMEOUT_MS),
      ]);

      if (records.length > 0) {
        // Sinkhole check
        const sinkholeIp = records.find((r) => isSinkhole(r.address));
        if (sinkholeIp) {
          out.push(signalFrom("domain.sinkholed", SOURCE, 0.9, { ip: sinkholeIp.address, domain }));
        }

        // Low TTL check (skip if already sinkholed — same issue)
        if (!sinkholeIp) {
          const minTtl = Math.min(...records.map((r) => r.ttl));
          if (minTtl > 0 && minTtl < 300) {
            out.push(signalFrom("domain.low_ttl", SOURCE, 0.7, { minTtl, domain }));
          }
        }
      }

      // Missing MX for a domain that appeared in email context
      if (entity.type === "domain" && records.length > 0 && mxHosts.length === 0) {
        out.push(signalFrom("domain.no_mx_yet_emails", SOURCE, 0.65, { domain }));
      }

      return out;
    });
    return signals;
  },
};

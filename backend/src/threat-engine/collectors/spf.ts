/**
 * SPF / DMARC collector — email authentication via DNS (docs/threat-intelligence.md).
 *
 * A domain that properly publishes SPF + DMARC is less likely to be a spoofed sender.
 * When both pass → negative (trust) signal: identity.spf_dkim_dmarc_pass (−12, T1).
 * Applies only to email entities. No API key required — pure DNS.
 *
 * SPF pass criteria: TXT starting with "v=spf1" and NOT ending with "+all" / "?all"
 *   (those policies are too permissive to count as a meaningful restriction).
 * DMARC pass criteria: TXT at _dmarc.{domain} starting with "v=DMARC1" with p≠none.
 */

import { promises as dns } from "node:dns";

import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { config } from "../../config";
import type { Collector, CollectorContext } from "./types";
import type { Entity, Signal } from "../types";

const SOURCE = "dns" as const;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), ms))]);

async function resolveTxt(host: string, timeoutMs = 2500): Promise<string[][]> {
  try {
    return await withTimeout(dns.resolveTxt(host), timeoutMs);
  } catch {
    return [];
  }
}

/** Returns true if the domain has a well-formed, restrictive SPF record. */
export async function checkSpf(domain: string): Promise<boolean> {
  const records = await resolveTxt(domain);
  return records.some((parts) => {
    const txt = parts.join("").toLowerCase();
    if (!txt.startsWith("v=spf1")) return false;
    // "+all" or "?all" means "let everything through" — not a real restriction
    return !txt.endsWith("+all") && !txt.endsWith("?all");
  });
}

/** Returns true if the domain has a DMARC policy that is not "none". */
export async function checkDmarc(domain: string): Promise<boolean> {
  const records = await resolveTxt(`_dmarc.${domain}`);
  return records.some((parts) => {
    const txt = parts.join("").toLowerCase();
    if (!txt.startsWith("v=dmarc1")) return false;
    const pMatch = /\bp=(\w+)/.exec(txt);
    return !!pMatch && pMatch[1] !== "none";
  });
}

export const spfCollector: Collector = {
  id: SOURCE,
  appliesTo: (e: Entity) => e.type === "email" && !!e.parts.domain,
  isConfigured: () => !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const domain = entity.parts.domain!;
    const { signals } = await withCache(ctx.cache, `spf:${domain}`, async () => {
      // Run SPF and DMARC checks concurrently
      const [spfPass, dmarcPass] = await Promise.all([checkSpf(domain), checkDmarc(domain)]);
      if (spfPass && dmarcPass) {
        return [signalFrom("identity.spf_dkim_dmarc_pass", SOURCE, 0.8, { domain, spf: true, dmarc: true })];
      }
      return [];
    });
    return signals;
  },
};

/**
 * Spamhaus DBL + ZEN collector — DNS-based, no API key (docs/threat-intelligence.md, Tier 1).
 *
 *   DBL (Domain Block List): {domain}.dbl.spamhaus.org — resolves ⇒ domain listed.
 *   ZEN (Combined IP list):  {reversed-ip}.zen.spamhaus.org — resolves ⇒ IP listed.
 *
 * Both are free for low-volume non-commercial lookups. Applies to url/domain entities.
 * Any DNS failure → fail open (returns []).
 */

import { promises as dns } from "node:dns";

import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { resolveIps } from "../collectors/dns";
import { config } from "../../config";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal } from "../types";

const SOURCE = "spamhaus" as const;
const TIMEOUT_MS = 2500;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), ms))]);

/** Returns true if the Spamhaus DBL lists this domain. */
export async function checkDbl(domain: string): Promise<boolean> {
  try {
    await withTimeout(dns.resolve4(`${domain}.dbl.spamhaus.org`), TIMEOUT_MS);
    return true; // any answer means listed
  } catch {
    return false; // NXDOMAIN or timeout → not listed
  }
}

/** Returns true if the Spamhaus ZEN lists the hosting IP of this domain. */
export async function checkZen(domain: string): Promise<boolean> {
  const ips = await resolveIps(domain, TIMEOUT_MS);
  if (ips.length === 0) return false;

  // Use first IPv4 address; ZEN only covers IPv4
  const ipv4 = ips.find((ip) => !ip.includes(":"));
  if (!ipv4) return false;

  const reversed = ipv4.split(".").reverse().join(".");
  try {
    await withTimeout(dns.resolve4(`${reversed}.zen.spamhaus.org`), TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

export const spamhausCollector: Collector = {
  id: SOURCE,
  appliesTo: (e: Entity) => (e.type === "url" || e.type === "domain") && !!e.parts.domain,
  isConfigured: () => !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const domain = entity.parts.domain!;
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${domain}`, async () => {
      const [dblListed, zenListed] = await Promise.all([checkDbl(domain), checkZen(domain)]);
      const out: Signal[] = [];
      if (dblListed) out.push(signalFrom("ti.spamhaus.dbl", SOURCE, 0.9, { domain }));
      if (zenListed) out.push(signalFrom("ti.spamhaus.zen", SOURCE, 0.9, { domain }));
      return out;
    });
    return signals;
  },
};

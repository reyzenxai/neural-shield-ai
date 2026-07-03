/**
 * RDAP collector — domain age (docs/threat-intelligence.md §"WHOIS / RDAP", Tier 1).
 *
 * Freshly-registered domains are the single most predictive phishing signal. RDAP is
 * free, structured (JSON), no API key. We query rdap.org which redirects to the
 * authoritative registry. Age changes slowly ⇒ long cache TTL.
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { httpJson } from "../net";
import type { Collector, CollectorContext } from "./types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "rdap";
const DAY = 86_400_000;

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}
interface RdapResponse {
  events?: RdapEvent[];
}

/** Extract the domain registration date from an RDAP response, or null. */
export function parseRdapRegistration(data: RdapResponse): Date | null {
  const ev = data.events?.find((e) => e.eventAction === "registration" && e.eventDate);
  if (!ev?.eventDate) return null;
  const d = new Date(ev.eventDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Map a registration date to the single most-specific age signal (or none). */
export function ageToSignals(registeredAt: Date, now = Date.now()): Signal[] {
  const ageDays = Math.floor((now - registeredAt.getTime()) / DAY);
  const ev = { registeredAt: registeredAt.toISOString(), ageDays };
  if (ageDays < 0) return []; // clock skew / bad data — ignore
  if (ageDays < 7) return [signalFrom("domain.age_lt_7d", SOURCE, 1, ev)];
  if (ageDays < 30) return [signalFrom("domain.age_lt_30d", SOURCE, 1, ev)];
  if (ageDays < 90) return [signalFrom("domain.age_lt_90d", SOURCE, 1, ev)];
  if (ageDays < 365) return [signalFrom("domain.age_lt_1y", SOURCE, 1, ev)];
  if (ageDays > 5 * 365) return [signalFrom("domain.age_gt_5y", SOURCE, 1, ev)];
  if (ageDays > 2 * 365) return [signalFrom("domain.age_gt_2y", SOURCE, 1, ev)];
  return [];
}

export const rdapCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => (e.type === "url" || e.type === "domain") && !!e.parts.domain,
  isConfigured: () => config.intel.rdapEnabled && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const domain = entity.parts.domain;
    if (!domain) return [];
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${domain}`, async () => {
      const data = await httpJson<RdapResponse>(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        timeoutMs: 3000,
        retries: 1,
        headers: { Accept: "application/rdap+json" },
        parentSignal: ctx.signal,
      });
      const registered = parseRdapRegistration(data);
      return registered ? ageToSignals(registered) : [];
    });
    return signals;
  },
};

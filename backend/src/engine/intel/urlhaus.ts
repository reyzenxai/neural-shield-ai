/**
 * URLHaus (abuse.ch) — malware-distribution URLs/hosts (docs/threat-intelligence.md, Tier 1).
 *
 * A match is a HARD malicious override. Free; default-enabled. abuse.ch now recommends
 * an Auth-Key (URLHAUS_AUTH_KEY) — sent when present. Uses the form-encoded POST API.
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { httpFetch } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "urlhaus";

interface UrlhausResponse {
  query_status?: string;
  threat?: string;
  url_status?: string;
}

/** Map a URLHaus response to an override signal. Pure — exported for tests. */
export function parseUrlhaus(data: UrlhausResponse): Signal[] {
  if (data.query_status === "ok") {
    return [signalFrom("ti.urlhaus.malware", SOURCE, 1, { threat: data.threat, urlStatus: data.url_status })];
  }
  return [];
}

export const urlhausCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => e.type === "url" || e.type === "domain",
  isConfigured: () => config.intel.urlhaus.enabled && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const isUrl = entity.type === "url";
    const endpoint = isUrl ? "url" : "host";
    const field = isUrl ? "url" : "host";
    const target = isUrl ? entity.value : (entity.parts.host ?? entity.value);
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (config.intel.urlhaus.authKey) headers["Auth-Key"] = config.intel.urlhaus.authKey;

    const { signals } = await withCache(ctx.cache, `${SOURCE}:${target}`, async () => {
      const res = await httpFetch(`https://urlhaus-api.abuse.ch/v1/${endpoint}/`, {
        method: "POST",
        timeoutMs: 3000,
        headers,
        parentSignal: ctx.signal,
        body: `${field}=${encodeURIComponent(target)}`,
      });
      if (!res.ok) throw new Error(`URLHaus HTTP ${res.status}`);
      return parseUrlhaus((await res.json()) as UrlhausResponse);
    });
    return signals;
  },
};

/**
 * Google Safe Browsing — Lookup API v4 (docs/threat-intelligence.md, Tier 1).
 *
 * A MALWARE / SOCIAL_ENGINEERING match is a HARD malicious override (R=100).
 * Key-gated: skipped unless GSB_API_KEY is set. NOTE: the free Safe Browsing API is
 * non-commercial — a commercial deploy must move to the Web Risk API (see the doc).
 */

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import { httpJson } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "gsb";

interface GsbResponse {
  matches?: { threatType?: string }[];
}

/** Map a GSB response to override signals. Pure — exported for tests. */
export function parseGsb(data: GsbResponse): Signal[] {
  const types = new Set((data.matches ?? []).map((m) => m.threatType));
  const out: Signal[] = [];
  if (types.has("SOCIAL_ENGINEERING")) out.push(signalFrom("ti.gsb.social_engineering", SOURCE, 1));
  if (types.has("MALWARE") || types.has("UNWANTED_SOFTWARE") || types.has("POTENTIALLY_HARMFUL_APPLICATION")) {
    out.push(signalFrom("ti.gsb.malware", SOURCE, 1));
  }
  return out;
}

export const gsbCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => e.type === "url",
  isConfigured: () => !!config.intel.gsb.apiKey && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${entity.value}`, async () => {
      const data = await httpJson<GsbResponse>(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(config.intel.gsb.apiKey)}`,
        {
          method: "POST",
          timeoutMs: 3000,
          headers: { "Content-Type": "application/json" },
          parentSignal: ctx.signal,
          body: JSON.stringify({
            client: { clientId: "neural-shield", clientVersion: "2.0.0" },
            threatInfo: {
              threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries: [{ url: entity.value }],
            },
          }),
        },
      );
      return parseGsb(data);
    });
    return signals;
  },
};

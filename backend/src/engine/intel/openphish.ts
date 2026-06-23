/**
 * OpenPhish — live phishing feed (docs/threat-intelligence.md, Tier 1/2).
 *
 * Feed-based (not per-query): the URL list is fetched and cached in-process, then
 * membership is checked locally — cheap and rate-limit-friendly. A match is a HARD
 * malicious override. Gated behind OPENPHISH_ENABLED.
 */

import { config } from "../../config";
import { signalFrom } from "../config/weights";
import { httpText } from "../net";
import type { Collector, CollectorContext } from "../collectors/types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "openphish";
const FEED_TTL_MS = 60 * 60 * 1000; // refresh hourly

let feedSet = new Set<string>();
let feedFetchedAt = 0;

/** Canonical form for feed comparison (lowercased, no trailing slash). */
export function normalizeForFeed(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

/** Pure membership check — exported for tests. */
export function openphishMatch(feed: Set<string>, url: string): boolean {
  return feed.has(normalizeForFeed(url));
}

/** Replace the in-process feed (used by the collector + tests). */
export function setFeedForTest(urls: string[]): void {
  feedSet = new Set(urls.map(normalizeForFeed));
  feedFetchedAt = Date.now();
}

async function getFeed(parentSignal: AbortSignal): Promise<Set<string>> {
  if (feedSet.size && Date.now() - feedFetchedAt < FEED_TTL_MS) return feedSet;
  const text = await httpText(config.intel.openphish.feedUrl, { timeoutMs: 5000, retries: 1, parentSignal });
  feedSet = new Set(text.split(/\r?\n/).map(normalizeForFeed).filter(Boolean));
  feedFetchedAt = Date.now();
  return feedSet;
}

export const openphishCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => e.type === "url",
  isConfigured: () => config.intel.openphish.enabled && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const feed = await getFeed(ctx.signal);
    return openphishMatch(feed, entity.value) ? [signalFrom("ti.openphish.match", SOURCE, 1)] : [];
  },
};

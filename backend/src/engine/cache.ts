/**
 * In-memory, verdict-aware TTL cache for collector results
 * (docs/evidence-collection-layer.md §4). A confirmed-malicious record stays hot
 * longer; "unknown" is re-checked quickly. Cache-first keeps popular bad entities
 * cheap and instant, and shields rate-limited/paid APIs.
 *
 * Process-local for Week 2 (a single instance). The persistent, cross-instance layer
 * is `entity_intel` (migration 0009), wired with its write RPC in Week 3.
 */

import type { Signal } from "./types";

export type CacheVerdict = "malicious" | "clean" | "unknown";

/** Verdict-aware TTLs (ms). */
const TTL: Record<CacheVerdict, number> = {
  malicious: 24 * 60 * 60 * 1000, // 24h
  clean: 7 * 24 * 60 * 60 * 1000, // 7d
  unknown: 60 * 60 * 1000, // 1h
};

const MAX_ENTRIES = 5000;

interface Entry {
  signals: Signal[];
  verdict: CacheVerdict;
  expiresAt: number;
}

/** Derive a cache verdict from a collector's signals. */
export function verdictOf(signals: Signal[]): CacheVerdict {
  if (signals.some((s) => s.override === "malicious")) return "malicious";
  if (signals.some((s) => s.weight > 0)) return "unknown"; // some risk, but not authoritative
  return "clean";
}

export class IntelCache {
  private map = new Map<string, Entry>();

  /** @returns cached signals (cloned) or null if missing/expired. */
  get(key: string): Signal[] | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() >= e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // Touch for LRU recency.
    this.map.delete(key);
    this.map.set(key, e);
    return e.signals.map((s) => ({ ...s }));
  }

  set(key: string, signals: Signal[]): void {
    const verdict = verdictOf(signals);
    this.map.set(key, { signals, verdict, expiresAt: Date.now() + TTL[verdict] });
    if (this.map.size > MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Run `fn` only on a cache miss, then store its result (cache-first). */
export async function withCache(
  cache: IntelCache,
  key: string,
  fn: () => Promise<Signal[]>,
): Promise<{ signals: Signal[]; cached: boolean }> {
  const hit = cache.get(key);
  if (hit) return { signals: hit, cached: true };
  const signals = await fn();
  cache.set(key, signals);
  return { signals, cached: false };
}

/** Process-wide singleton used by the collectors. */
export const intelCache = new IntelCache();

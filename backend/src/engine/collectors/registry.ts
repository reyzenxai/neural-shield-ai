/**
 * Collector registry + parallel, timeboxed runner (docs/trust-engine-architecture.md §1).
 *
 * Applicable + configured collectors run concurrently under a single global budget.
 * Each fails open: a throw (incl. budget abort) is recorded as `failed`, which lowers
 * confidence but never crashes the scan. Collectors that apply but aren't configured
 * are `skipped` (they don't count against coverage).
 */

import { config } from "../../config";
import { intelCache, type IntelCache } from "../cache";
import { gsbCollector } from "../intel/gsb";
import { openphishCollector } from "../intel/openphish";
import { phishtankCollector } from "../intel/phishtank";
import { urlhausCollector } from "../intel/urlhaus";
import { logger } from "../../utils/logger";
import { rdapCollector } from "./rdap";
import { tlsCollector } from "./tls";
import type { Collector, CollectionOutput } from "./types";
import type { Entity, Signal } from "../types";

/** All network collectors. (DNS = utilities; redirect = pre-step — not listed here.) */
export const COLLECTORS: Collector[] = [
  rdapCollector,
  tlsCollector,
  gsbCollector,
  urlhausCollector,
  phishtankCollector,
  openphishCollector,
];

export interface RunOptions {
  parentSignal?: AbortSignal;
  cache?: IntelCache;
  collectors?: Collector[];
  budgetMs?: number;
}

/** Run all applicable+configured collectors in parallel within the global budget. */
export async function runCollectors(entity: Entity, opts: RunOptions = {}): Promise<CollectionOutput> {
  const collectors = opts.collectors ?? COLLECTORS;
  const cache = opts.cache ?? intelCache;
  const budgetMs = opts.budgetMs ?? config.intel.budgetMs;

  const applicable = collectors.filter((c) => c.appliesTo(entity));
  const active = applicable.filter((c) => c.isConfigured());
  const skipped = applicable.filter((c) => !c.isConfigured()).map((c) => c.id);

  if (active.length === 0) {
    return { signals: [], queried: [], failed: [], skipped };
  }

  // Global collection budget — aborts any in-flight network call. When a parent
  // signal is supplied (the engine-level budget) we ride on it instead of starting a
  // competing timer; otherwise we own the timer.
  const controller = new AbortController();
  const onParentAbort = (): void => controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (opts.parentSignal) {
    if (opts.parentSignal.aborted) controller.abort();
    else opts.parentSignal.addEventListener("abort", onParentAbort, { once: true });
  } else {
    timer = setTimeout(() => controller.abort(), budgetMs);
  }

  const signals: Signal[] = [];
  const failed: Collector["id"][] = [];
  try {
    const results = await Promise.allSettled(
      active.map((c) => c.collect(entity, { cache, signal: controller.signal })),
    );
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        signals.push(...r.value);
      } else {
        failed.push(active[i].id);
        logger.warn(`collector ${active[i].id} failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      }
    });
  } finally {
    if (timer) clearTimeout(timer);
    opts.parentSignal?.removeEventListener("abort", onParentAbort);
  }

  return { signals, queried: active.map((c) => c.id), failed, skipped };
}

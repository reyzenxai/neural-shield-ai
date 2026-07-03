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
import { virusTotalCollector } from "../intel/virustotal";
import { spamhausCollector } from "../intel/spamhaus";
import { abuseIpDbCollector } from "../intel/abuseipdb";
import { dnsCheckCollector } from "../intel/dnscheck";
import { logger } from "../../utils/logger";
import { rdapCollector } from "./rdap";
import { tlsCollector } from "./tls";
import { spfCollector } from "./spf";
import type { Collector, CollectionOutput } from "./types";
import type { Entity, Signal } from "../types";

/** All network collectors — ordered: always-available first, key-gated last. */
export const COLLECTORS: Collector[] = [
  rdapCollector,
  tlsCollector,
  dnsCheckCollector,
  spfCollector,
  gsbCollector,
  urlhausCollector,
  phishtankCollector,
  openphishCollector,
  spamhausCollector,
  abuseIpDbCollector,
  virusTotalCollector,
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

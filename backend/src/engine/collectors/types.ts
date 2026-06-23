/**
 * Collector contract (docs/evidence-collection-layer.md §1). Each collector is
 * cache-first, timeboxed by the runner, and FAILS OPEN — it throws on error and the
 * runner records it as `failed` (which lowers confidence), never crashing the scan.
 */

import type { IntelCache } from "../cache";
import type { Entity, Signal, SourceId } from "../types";

export interface CollectorContext {
  cache: IntelCache;
  /** Global collection-budget signal; collectors should pass it to httpFetch. */
  signal: AbortSignal;
}

export interface Collector {
  id: SourceId;
  /** Does this collector apply to the entity type? */
  appliesTo(entity: Entity): boolean;
  /** Is it usable right now (enabled + has any required key)? Unconfigured ⇒ skipped. */
  isConfigured(): boolean;
  /** Produce signals. May throw → recorded as `failed`. */
  collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]>;
}

export type CollectorStatus = "ok" | "failed" | "skipped";

export interface CollectionOutput {
  signals: Signal[];
  queried: SourceId[]; // attempted (ok or failed)
  failed: SourceId[];
  skipped: SourceId[]; // applies to this entity but not configured
}

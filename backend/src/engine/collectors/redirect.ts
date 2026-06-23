/**
 * Redirect / shortener expansion (docs/evidence-collection-layer.md §3.1, fixes F-BE-2).
 *
 * A pre-processing step (not a parallel collector): it resolves a URL to its final
 * landing page so EVERY downstream collector (structural, RDAP, blocklists) analyzes
 * the real destination, not the shortener. Returns the effective entity + any
 * redirect-chain signal. Fails open — on error the original entity is used unchanged.
 */

import { config } from "../../config";
import { signalFrom } from "../config/weights";
import { httpFetch } from "../net";
import { normalizeUrl } from "../normalize";
import type { Entity, Signal } from "../types";

const MAX_HOPS = 5;

export interface ExpandResult {
  entity: Entity;
  hops: number;
  signals: Signal[];
}

/**
 * Follow up to MAX_HOPS redirects (manual, so we never auto-execute the destination).
 * @returns the final entity (or the original on failure) + a chain-length signal.
 */
export async function expandUrl(entity: Entity, parentSignal: AbortSignal): Promise<ExpandResult> {
  if (entity.type !== "url" || config.intel.disableNetwork || !config.intel.redirectEnabled) {
    return { entity, hops: 0, signals: [] };
  }

  let current = entity.value;
  let hops = 0;
  try {
    for (; hops < MAX_HOPS; hops++) {
      const res = await httpFetch(current, {
        method: "GET",
        timeoutMs: 3000,
        headers: { "User-Agent": "NeuralShield/1.0 (+https://neuralshield.ai)" },
        parentSignal,
      });
      const location = res.headers.get("location");
      // fetch follows redirects by default; `res.url` holds the final URL. We also
      // honor an explicit Location header for servers that 3xx without auto-follow.
      if (res.redirected && res.url) {
        current = res.url;
        break;
      }
      if (location && res.status >= 300 && res.status < 400) {
        current = new URL(location, current).toString();
        continue;
      }
      break;
    }
  } catch {
    return { entity, hops: 0, signals: [] }; // fail open — keep the original
  }

  const finalEntity = normalizeUrl(current);
  const signals: Signal[] = [];
  if (finalEntity.parts.host !== entity.parts.host) {
    if (hops >= 3) signals.push(signalFrom("infra.redirect_chain_long", "structural", 0.8, { from: entity.value, to: current, hops }));
  }
  return { entity: finalEntity, hops, signals };
}

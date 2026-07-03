/**
 * TLS certificate collector (docs/evidence-collection-layer.md §3.1). Connects over
 * 443 with verification DISABLED so it can *inspect* an invalid cert (self-signed,
 * hostname mismatch) instead of throwing. No key. Best-effort — fails open.
 */

import tls from "node:tls";

import { config } from "../../config";
import { withCache } from "../cache";
import { signalFrom } from "../config/weights";
import type { Collector, CollectorContext } from "./types";
import type { Entity, Signal, SourceId } from "../types";

const SOURCE: SourceId = "tls";

interface CertCheck {
  authorized: boolean;
  error: string;
}

/** Open a TLS connection and report the verification outcome (no throw on bad cert). */
function inspectCert(host: string, timeoutMs: number): Promise<CertCheck> {
  return new Promise<CertCheck>((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: timeoutMs, rejectUnauthorized: false },
      () => {
        const err = socket.authorizationError as (Error & { code?: string }) | undefined;
        const error = err ? `${err.code ?? ""} ${err.message ?? String(err)}`.trim() : "";
        resolve({ authorized: socket.authorized, error });
        socket.destroy();
      },
    );
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("tls timeout"));
    });
    socket.once("error", (e) => {
      socket.destroy();
      reject(e);
    });
  });
}

/** Map a verification outcome to signals. Pure — exported for tests. */
export function certCheckToSignals(check: CertCheck): Signal[] {
  if (check.authorized || !check.error) return [];
  const e = check.error.toUpperCase();
  if (e.includes("SELF_SIGNED") || e.includes("DEPTH_ZERO")) {
    return [signalFrom("infra.tls_self_signed", SOURCE, 0.85, { error: check.error })];
  }
  if (e.includes("ALTNAME") || e.includes("DOES NOT MATCH") || e.includes("HOSTNAME")) {
    return [signalFrom("infra.tls_cn_mismatch", SOURCE, 0.85, { error: check.error })];
  }
  return []; // expired / other — no dedicated signal in the matrix yet
}

export const tlsCollector: Collector = {
  id: SOURCE,
  appliesTo: (e) => (e.type === "url" || e.type === "domain") && !!e.parts.host && e.parts.scheme !== "http",
  isConfigured: () => config.intel.tlsEnabled && !config.intel.disableNetwork,
  async collect(entity: Entity, ctx: CollectorContext): Promise<Signal[]> {
    const host = entity.parts.host;
    if (!host) return [];
    const { signals } = await withCache(ctx.cache, `${SOURCE}:${host}`, async () => {
      const check = await inspectCert(host, 3000);
      return certCheckToSignals(check);
    });
    return signals;
  },
};

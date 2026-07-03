/**
 * DNS resolution utilities (docs/evidence-collection-layer.md §3.1). Used to resolve a
 * host's IPs (for IP-reputation collectors) and MX presence. Built-in node:dns — no
 * key. Each call is wrapped with a timeout so a slow resolver can't hang a scan.
 */

import { promises as dns } from "node:dns";

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("dns timeout")), ms)),
  ]);

/** Resolve A/AAAA records to IP strings. Returns [] on failure (fails open). */
export async function resolveIps(host: string, timeoutMs = 2000): Promise<string[]> {
  try {
    const [v4, v6] = await Promise.allSettled([
      withTimeout(dns.resolve4(host), timeoutMs),
      withTimeout(dns.resolve6(host), timeoutMs),
    ]);
    const ips: string[] = [];
    if (v4.status === "fulfilled") ips.push(...v4.value);
    if (v6.status === "fulfilled") ips.push(...v6.value);
    return ips;
  } catch {
    return [];
  }
}

/** Resolve MX hostnames for a domain. Returns [] on failure / none. */
export async function resolveMx(domain: string, timeoutMs = 2000): Promise<string[]> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), timeoutMs);
    return mx.map((m) => m.exchange);
  } catch {
    return [];
  }
}

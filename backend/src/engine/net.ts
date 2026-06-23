/**
 * Shared HTTP helper for collectors: explicit per-call timeout (AbortController),
 * a parent-signal link so the global collection budget can cancel in-flight calls,
 * and bounded retry-with-backoff for idempotent GETs. Never used on the legacy path.
 */

export interface HttpOptions {
  timeoutMs: number;
  /** Number of *retries* (total attempts = retries + 1). Only applied to GET. */
  retries?: number;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  /** Parent signal (global collection budget); aborts this call when it fires. */
  parentSignal?: AbortSignal;
}

/** True for transient failures worth retrying on a GET (5xx / 429). */
export function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Fetch with a hard timeout. Aborts if either the local timer or the parent fires. */
export async function httpFetch(url: string, opts: HttpOptions): Promise<Response> {
  const method = opts.method ?? "GET";
  const maxAttempts = method === "GET" ? (opts.retries ?? 0) + 1 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const onParentAbort = (): void => controller.abort();
    opts.parentSignal?.addEventListener("abort", onParentAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: opts.headers,
        body: opts.body,
        signal: controller.signal,
      });
      if (method === "GET" && isRetriableStatus(res.status) && attempt < maxAttempts - 1) {
        lastError = new Error(`HTTP ${res.status}`);
        await sleep(250 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      opts.parentSignal?.removeEventListener("abort", onParentAbort);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Fetch + parse JSON. Throws on non-OK so the collector fails open. */
export async function httpJson<T>(url: string, opts: HttpOptions): Promise<T> {
  const res = await httpFetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** Fetch + return text. Throws on non-OK. */
export async function httpText(url: string, opts: HttpOptions): Promise<string> {
  const res = await httpFetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * A small, runtime-agnostic client for the scan API. It has no dependency on
 * axios, on React Native, or on the browser. Each app passes in its own base URL
 * and a function that returns the current access token, and gets the same typed
 * methods and the same behavior in return.
 *
 * This is the shared core that the web, mobile, and extension clients can adopt,
 * replacing the three near-identical clients they each maintain today.
 */

import type { ScanType, SavedScan } from "@neural-shield/types";

export type TokenGetter = () => Promise<string | null> | string | null;

export interface ScanClientOptions {
  /** Backend base URL, with no trailing slash, e.g. https://api.example.com */
  baseUrl: string;
  /** Returns the current Supabase access token, or null when signed out. */
  getToken: TokenGetter;
  /** Optional fetch implementation. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class ScanApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ScanApiError";
    this.status = status;
    this.code = code;
  }
}

/** Turn a scan type and raw input into the request body the backend expects. */
export function buildScanPayload(type: ScanType, content: string): Record<string, string> {
  const c = content.trim();
  switch (type) {
    case "message":
      return { text: c };
    case "url":
      return { url: /^https?:\/\//i.test(c) ? c : `https://${c}` };
    case "email":
      return { body: c, subject: "", sender: "" };
    case "phone":
      return { phone: c };
    case "upi": {
      const match = c.match(/[?&]pa=([^&\s]+)/i);
      return { upiId: match ? match[1] : c };
    }
    default:
      return { text: c };
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
  details?: unknown;
}

export function createScanClient(opts: ScanClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, "");

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await opts.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function scan(type: ScanType, content: string): Promise<SavedScan> {
    const res = await doFetch(`${base}/api/scan/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(buildScanPayload(type, content)),
    });
    const json = (await res.json()) as Envelope<SavedScan>;
    if (!res.ok || !json.success) {
      const code =
        json.details && typeof json.details === "object"
          ? (json.details as { code?: string }).code
          : undefined;
      throw new ScanApiError(json.message || "Analysis failed", res.status, code);
    }
    return json.data;
  }

  return { scan, buildScanPayload };
}

export type ScanClient = ReturnType<typeof createScanClient>;

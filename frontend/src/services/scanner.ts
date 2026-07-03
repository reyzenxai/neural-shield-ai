import { AxiosError } from "axios";

import { api } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ApiEnvelope, SavedScan } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

/** Error carrying the backend's human-readable message + status. */
export class ScanError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ScanError";
    this.status = status;
    this.code = code;
  }
}

function toScanError(err: unknown): ScanError {
  if (err instanceof AxiosError) {
    // No response object → the request never reached the API (offline, DNS, the
    // API is down, or a CORS rejection). "Network Error" alone is confusing.
    if (!err.response) {
      return new ScanError(
        "Couldn't reach the analysis server. Check your connection and try again - if it persists, the API may be down or blocking this origin (CORS).",
        undefined,
        err.code,
      );
    }
    const data = err.response?.data as ApiEnvelope<unknown> | undefined;
    const detailCode =
      data && typeof data.details === "object" && data.details !== null
        ? (data.details as { code?: string }).code
        : undefined;
    return new ScanError(
      data?.message || err.message || "Request failed",
      err.response?.status,
      detailCode,
    );
  }
  return new ScanError(err instanceof Error ? err.message : "Request failed");
}

async function post(path: string, body: Record<string, unknown>): Promise<SavedScan> {
  try {
    const res = await api.post<ApiEnvelope<SavedScan>>(path, body);
    return res.data.data;
  } catch (err) {
    throw toScanError(err);
  }
}

/** Multipart upload (image scanners) - uses fetch so the browser sets the boundary. */
async function postFile(path: string, file: File): Promise<SavedScan> {
  const headers: Record<string, string> = {};
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }
  const form = new FormData();
  form.append("file", file);

  let json: ApiEnvelope<SavedScan>;
  try {
    const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form });
    json = await res.json();
    if (!res.ok) {
      const code =
        json.details && typeof json.details === "object"
          ? (json.details as { code?: string }).code
          : undefined;
      throw new ScanError(json.message || "Upload failed", res.status, code);
    }
  } catch (err) {
    if (err instanceof ScanError) throw err;
    throw new ScanError(err instanceof Error ? err.message : "Upload failed");
  }
  return json.data;
}

export const scanner = {
  message: (text: string) => post("/scan/message", { text }),
  url: (url: string) => post("/scan/url", { url }),
  email: (input: { subject: string; body: string; sender: string }) =>
    post("/scan/email", input),
  phone: (phone: string) => post("/scan/phone", { phone }),
  upi: (upiId: string) => post("/scan/upi", { upiId }),
  screenshot: (file: File) => postFile("/scan/screenshot", file),
  qr: (file: File) => postFile("/scan/qr", file),
};

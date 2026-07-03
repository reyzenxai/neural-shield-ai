import axios from "axios";
import { router } from "expo-router";
import { supabase } from "./supabase";
import type { Profile, ScanHistoryItem } from "../constants/types";

// No trailing slash — avoids double-slash when paths start with /api/...
export const API_BASE = "https://backend-one-gamma-9n6duzcmcq.vercel.app";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return Promise.reject(new Error("No active session. Please log in."));
  }
  config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await supabase.auth.signOut();
      router.replace("/(auth)/login");
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    return Promise.reject(err);
  },
);

function buildScanPayload(type: string, content: string): Record<string, string> {
  const c = content.trim();
  switch (type) {
    case "message":
      return { text: c };
    case "url":
      // auto-prefix if missing scheme
      return { url: /^https?:\/\//i.test(c) ? c : `https://${c}` };
    case "email":
      return { body: c, subject: "", sender: "" };
    case "phone":
      return { phone: c };
    case "upi": {
      // accept upi://pay?pa=xxx@bank or bare VPA
      const match = c.match(/[?&]pa=([^&\s]+)/i);
      return { upiId: match ? match[1] : c };
    }
    default:
      return { text: c };
  }
}

export async function scanContent(type: string, content: string) {
  const payload = buildScanPayload(type, content);
  const { data } = await api.post(`/api/scan/${type}`, payload);
  return data.data;
}

export async function scanImage(type: "screenshot" | "qr", uri: string, mimeType: string) {
  const form = new FormData();
  form.append("image", { uri, name: "image.jpg", type: mimeType } as any);
  const { data } = await api.post(`/api/scan/${type}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

function parseJsonField(v: any): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v as string[];
  try { return JSON.parse(v) as string[]; } catch { return undefined; }
}

export async function getScanHistory(page = 0, limit = 20): Promise<ScanHistoryItem[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, scan_type, input_text, input_url, scam_probability, trust_score, risk_level, confidence, scam_type, signals, flags, explanation, created_at")
    .order("created_at", { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    scan_type: row.scan_type,
    content_preview: (row.input_text || row.input_url || "").slice(0, 80),
    scam_probability: row.scam_probability ?? 0,
    trust_score: row.trust_score ?? 0,
    risk_level: row.risk_level ?? "safe",
    created_at: row.created_at,
    confidence:   row.confidence   ?? undefined,
    scam_type:    row.scam_type    ?? undefined,
    signals:      parseJsonField(row.signals),
    flags:        parseJsonField(row.flags),
    explanation:  row.explanation  ?? undefined,
  }));
}

const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 100,
  business: 999999,
};

async function fetchProfileRow(userId: string, attempt = 0): Promise<any> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, plan, daily_scan_count, daily_scan_reset_at, name, created_at, phone, is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // DB-02: Supabase trigger may not have created the row yet — retry once after 1.5s
  if (!data && attempt === 0) {
    await new Promise(r => setTimeout(r, 1500));
    return fetchProfileRow(userId, 1);
  }
  return data;
}

export async function getProfile(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const data = await fetchProfileRow(user.id);

  const { count: totalScans } = await supabase
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const plan = data?.plan ?? "free";
  const resetAt = data?.daily_scan_reset_at ? new Date(data.daily_scan_reset_at).getTime() : 0;
  const expired = Date.now() - resetAt >= 24 * 60 * 60 * 1000;
  const dailyUsed = expired ? 0 : (data?.daily_scan_count ?? 0);

  return {
    id: user.id,
    email: user.email ?? "",
    // Column is `name` in profiles; fall back to auth user_metadata.full_name for OTP-created users
    name: data?.name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    plan,
    daily_scans_used: dailyUsed,
    daily_scan_limit: PLAN_LIMITS[plan] ?? 5,
    total_scans: totalScans ?? 0,
    created_at: data?.created_at ?? undefined,
    phone: data?.phone ?? undefined,
    is_admin: data?.is_admin ?? false,
  };
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  active_users_30d: number;
  total_scans: number;
  scans_today: number;
  high_risk_scans: number;
  avg_scam_score: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  is_admin: boolean;
  created_at: string;
  total_scans: number;
  last_scan_at: string | null;
}

export interface AdminScanRow {
  id: string;
  user_id: string;
  scan_type: string;
  risk_level: string;
  scam_probability: number;
  trust_score: number;
  scam_type: string | null;
  created_at: string;
  user_email: string;
  user_name: string | null;
  input_preview: string | null;
  input_url: string | null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get("/api/admin/stats");
  return data.data as AdminStats;
}

export async function getAdminUsers(limit = 20, offset = 0): Promise<{ users: AdminUser[]; total: number }> {
  const { data } = await api.get("/api/admin/users", { params: { limit, offset, sort_by: "created_at", sort_dir: "desc" } });
  return data.data as { users: AdminUser[]; total: number };
}

export async function getAdminScans(limit = 20, offset = 0): Promise<{ scans: AdminScanRow[]; total: number }> {
  const { data } = await api.get("/api/admin/scans", { params: { limit, offset } });
  return data.data as { scans: AdminScanRow[]; total: number };
}

export async function submitFeedback(scanId: string, isAccurate: boolean, comment?: string) {
  const { data } = await api.post("/api/report", { scanId, isAccurate, comment });
  return data.data;
}

/**
 * Thin wrapper around the shared `api` axios client for admin endpoints.
 * Admin routes require an authenticated JWT with is_admin = true - the shared
 * interceptor already attaches the Bearer token, so no extra setup needed.
 */
import { api } from "@/lib/api";

export interface AdminStats {
  total_users: number;
  active_users_30d: number;
  total_scans: number;
  scans_today: number;
  high_risk_scans: number;
  avg_scam_score: number;
  total_feedback: number;
  users_by_plan: Record<string, number>;
  scans_by_risk: Record<string, number>;
  scans_by_type: Record<string, number>;
  daily_scans: { date: string; count: number }[];
  daily_signups: { date: string; count: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  effective_plan: string;
  is_admin: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  total_scans: number;
  last_scan_at: string | null;
}

export interface AdminUserDetail {
  profile: AdminUser;
  effective_plan: string;
  total_scans: number;
  scans_by_risk: Record<string, number>;
  recent_scans: AdminScanRow[];
  feedback_count: number;
  subscription: { plan: string; status: string; expires_at: string | null } | null;
}

export interface AdminScanRow {
  id: string;
  user_id: string;
  scan_type: string;
  risk_level: string;
  scam_probability: number;
  trust_score: number;
  scam_type: string | null;
  ai_model: string;
  processing_time_ms: number | null;
  created_at: string;
  user_email: string;
  user_name: string | null;
  input_preview: string | null;
  input_url: string | null;
}

export interface AdminFeedbackRow {
  id: string;
  is_accurate: boolean;
  comment: string | null;
  created_at: string;
  scan_id: string | null;
  review_status: "pending" | "safe" | "unsafe" | null;
  user_email: string | null;
  user_name: string | null;
  scan_type: string | null;
  risk_level: string | null;
  scam_probability: number | null;
}

export interface AdminLogRow {
  id: string;
  action: string;
  resource: string;
  target_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  admin_email: string;
  admin_name: string | null;
}

export interface AdminPaymentRow {
  id: string;
  user_id: string;
  user_email: string;
  plan: string;
  amount_inr: number;
  reference_note: string;
  upi_reference: string | null;
  screenshot_path: string | null;
  status: string;
  created_at: string;
}

export interface Paginated<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

async function unwrap<T>(promise: Promise<{ data: { success: boolean; data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

export const adminApi = {
  getStats: () =>
    unwrap<AdminStats>(api.get("/admin/stats")),

  getUsers: (params: { limit?: number; offset?: number; search?: string; plan?: string; sort_by?: string; sort_dir?: string } = {}) =>
    unwrap<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
      api.get("/admin/users", { params }),
    ),

  getUser: (id: string) =>
    unwrap<AdminUserDetail>(api.get(`/admin/users/${id}`)),

  getScans: (params: { limit?: number; offset?: number; risk_level?: string; scan_type?: string; date_from?: string; date_to?: string; user_id?: string } = {}) =>
    unwrap<{ scans: AdminScanRow[]; total: number; limit: number; offset: number }>(
      api.get("/admin/scans", { params }),
    ),

  getFeedback: (params: { limit?: number; offset?: number } = {}) =>
    unwrap<{ feedback: AdminFeedbackRow[]; total: number }>(
      api.get("/admin/feedback", { params }),
    ),

  getLogs: (params: { limit?: number; offset?: number } = {}) =>
    unwrap<{ logs: AdminLogRow[]; total: number }>(
      api.get("/admin/logs", { params }),
    ),

  getPayments: (status = "pending") =>
    unwrap<{ payments: AdminPaymentRow[] }>(api.get("/admin/payments", { params: { status } })),

  approvePayment: (id: string) =>
    unwrap<{ ok: boolean }>(api.post(`/admin/payments/${id}/approve`)),

  rejectPayment: (id: string, note?: string) =>
    unwrap<{ ok: boolean }>(api.post(`/admin/payments/${id}/reject`, { note })),
};

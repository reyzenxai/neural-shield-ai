import type { Request, Response } from "express";

import { getUserClient } from "../services/supabase.service";
import { failure, success } from "../utils/response";
import { logger } from "../utils/logger";

/** Fire-and-forget audit log insert. Never throws. */
async function auditLog(
  req: Request,
  action: string,
  resource: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!req.userToken || !req.user) return;
  const client = getUserClient(req.userToken);
  if (!client) return;
  try {
    await client.from("admin_logs").insert({
      admin_id: req.user.id,
      action,
      resource,
      target_id: targetId ?? null,
      ip_address: req.ip ?? null,
      user_agent: req.headers["user-agent"] ?? null,
      metadata: metadata ?? {},
    });
  } catch (e) {
    logger.warn(`admin_log insert failed: ${(e as Error).message}`);
  }
}

export async function getStats(req: Request, res: Response): Promise<void> {
  const client = getUserClient(req.userToken);
  if (!client) {
    // Dev mode: return zeros
    success(res, {
      total_users: 0, active_users_30d: 0, total_scans: 0, scans_today: 0,
      high_risk_scans: 0, avg_scam_score: 0, total_feedback: 0,
      users_by_plan: {}, scans_by_risk: {}, scans_by_type: {},
      daily_scans: [], daily_signups: [],
    });
    return;
  }
  const { data, error } = await client.rpc("admin_get_stats");
  if (error) {
    logger.error(`admin_get_stats failed: ${error.message}`);
    failure(res, "Failed to fetch stats.", 500);
    return;
  }
  void auditLog(req, "view_stats", "system");
  success(res, data as Record<string, unknown>);
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const limit  = Math.min(parseInt(String(req.query.limit  ?? 20), 10), 100);
  const offset = parseInt(String(req.query.offset ?? 0), 10);
  const search = (req.query.search as string | undefined) ?? null;
  const plan   = (req.query.plan   as string | undefined) ?? null;
  const sortBy  = (req.query.sort_by  as string | undefined) ?? "created_at";
  const sortDir = (req.query.sort_dir as string | undefined) ?? "desc";

  const client = getUserClient(req.userToken);
  if (!client) {
    success(res, { users: [], total: 0, limit, offset });
    return;
  }

  const { data, error } = await client.rpc("admin_get_users", {
    p_limit: limit, p_offset: offset,
    p_search: search, p_plan: plan,
    p_sort_by: sortBy, p_sort_dir: sortDir,
  });
  if (error) {
    logger.error(`admin_get_users failed: ${error.message}`);
    failure(res, "Failed to fetch users.", 500);
    return;
  }
  void auditLog(req, "view_users", "user", undefined, { limit, offset, search, plan });
  success(res, data as Record<string, unknown>);
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const client = getUserClient(req.userToken);
  if (!client) {
    failure(res, "Not available in dev mode.", 503);
    return;
  }

  const { data, error } = await client.rpc("admin_get_user", { p_id: id });
  if (error) {
    logger.error(`admin_get_user failed: ${error.message}`);
    failure(res, "Failed to fetch user.", 500);
    return;
  }
  if (!data) {
    failure(res, "User not found.", 404);
    return;
  }
  void auditLog(req, "view_user", "user", id);
  success(res, data as Record<string, unknown>);
}

export async function getScans(req: Request, res: Response): Promise<void> {
  const limit     = Math.min(parseInt(String(req.query.limit  ?? 20), 10), 100);
  const offset    = parseInt(String(req.query.offset ?? 0), 10);
  const riskLevel = (req.query.risk_level as string | undefined) ?? null;
  const scanType  = (req.query.scan_type  as string | undefined) ?? null;
  const dateFrom  = (req.query.date_from  as string | undefined) ?? null;
  const dateTo    = (req.query.date_to    as string | undefined) ?? null;
  const userId    = (req.query.user_id    as string | undefined) ?? null;

  const client = getUserClient(req.userToken);
  if (!client) {
    success(res, { scans: [], total: 0, limit, offset });
    return;
  }

  const { data, error } = await client.rpc("admin_get_scans", {
    p_limit:      limit,
    p_offset:     offset,
    p_risk_level: riskLevel,
    p_scan_type:  scanType,
    p_date_from:  dateFrom,
    p_date_to:    dateTo,
    p_user_id:    userId,
  });
  if (error) {
    logger.error(`admin_get_scans failed: ${error.message}`);
    failure(res, "Failed to fetch scans.", 500);
    return;
  }
  void auditLog(req, "view_scans", "scan", undefined, { limit, offset, riskLevel, scanType });
  success(res, data as Record<string, unknown>);
}

export async function getFeedback(req: Request, res: Response): Promise<void> {
  const limit  = Math.min(parseInt(String(req.query.limit  ?? 20), 10), 100);
  const offset = parseInt(String(req.query.offset ?? 0), 10);

  const client = getUserClient(req.userToken);
  if (!client) {
    success(res, { feedback: [], total: 0, limit, offset });
    return;
  }

  const { data, error } = await client.rpc("admin_get_feedback", {
    p_limit: limit, p_offset: offset,
  });
  if (error) {
    logger.error(`admin_get_feedback failed: ${error.message}`);
    failure(res, "Failed to fetch feedback.", 500);
    return;
  }
  void auditLog(req, "view_feedback", "feedback");
  success(res, data as Record<string, unknown>);
}

export async function getLogs(req: Request, res: Response): Promise<void> {
  const limit  = Math.min(parseInt(String(req.query.limit  ?? 50), 10), 200);
  const offset = parseInt(String(req.query.offset ?? 0), 10);

  const client = getUserClient(req.userToken);
  if (!client) {
    success(res, { logs: [], total: 0, limit, offset });
    return;
  }

  const { data, error } = await client.rpc("admin_get_logs", {
    p_limit: limit, p_offset: offset,
  });
  if (error) {
    logger.error(`admin_get_logs failed: ${error.message}`);
    failure(res, "Failed to fetch logs.", 500);
    return;
  }
  success(res, data as Record<string, unknown>);
}

export async function getPayments(req: Request, res: Response): Promise<void> {
  const client = getUserClient(req.userToken);
  if (!client) {
    success(res, { payments: [] });
    return;
  }
  const status = (req.query.status as string | undefined) ?? "pending";
  const { data, error } = await client.rpc("admin_list_payments", { p_status: status });
  if (error) {
    logger.error(`admin_list_payments failed: ${error.message}`);
    failure(res, "Failed to fetch payments.", 500);
    return;
  }
  success(res, { payments: data ?? [] });
}

export async function approvePayment(req: Request, res: Response): Promise<void> {
  const client = getUserClient(req.userToken);
  if (!client) {
    failure(res, "Not available in dev mode.", 503);
    return;
  }
  const { error } = await client.rpc("admin_approve_payment", { p_id: req.params.id });
  if (error) {
    logger.error(`admin_approve_payment failed: ${error.message}`);
    failure(res, "Could not approve the payment.", 500);
    return;
  }
  void auditLog(req, "approve_payment", "payment", req.params.id);
  success(res, { ok: true });
}

export async function rejectPayment(req: Request, res: Response): Promise<void> {
  const client = getUserClient(req.userToken);
  if (!client) {
    failure(res, "Not available in dev mode.", 503);
    return;
  }
  const note = (req.body as { note?: string } | undefined)?.note ?? null;
  const { error } = await client.rpc("admin_reject_payment", { p_id: req.params.id, p_note: note });
  if (error) {
    logger.error(`admin_reject_payment failed: ${error.message}`);
    failure(res, "Could not reject the payment.", 500);
    return;
  }
  void auditLog(req, "reject_payment", "payment", req.params.id);
  success(res, { ok: true });
}

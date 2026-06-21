import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../utils/logger";
import type { AuthUser, SavedScan, ScanResult, ScanType } from "../types";

const FREE_DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export class DailyLimitError extends Error {
  code = "DAILY_LIMIT_EXCEEDED" as const;
  constructor(message = "Daily scan limit reached.") {
    super(message);
    this.name = "DailyLimitError";
  }
}

/**
 * Enforce the free-tier daily scan cap. Resets the counter when the 24h window
 * has elapsed. No-op for pro/business, or when there is no DB client (dev mode).
 * @throws DailyLimitError when a free user is over the cap.
 */
export async function checkAndConsumeDailyLimit(
  client: SupabaseClient | null,
  user: AuthUser,
): Promise<void> {
  if (user.plan !== "free" || !client) return;

  const { data: profile, error } = await client
    .from("profiles")
    .select("daily_scan_count, daily_scan_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    logger.warn(`Could not read daily limit for ${user.id}: ${error?.message ?? "no profile"}`);
    return;
  }

  const resetAt = new Date(profile.daily_scan_reset_at).getTime();
  const expired = Date.now() - resetAt >= DAY_MS;
  const currentCount = expired ? 0 : (profile.daily_scan_count ?? 0);

  if (currentCount >= FREE_DAILY_LIMIT) {
    throw new DailyLimitError("Daily scan limit reached. Upgrade to Pro for unlimited scans.");
  }

  await client
    .from("profiles")
    .update({
      daily_scan_count: currentCount + 1,
      daily_scan_reset_at: expired ? new Date().toISOString() : profile.daily_scan_reset_at,
    })
    .eq("id", user.id);
}

/**
 * Persist a scan + its flags as the user (RLS). Returns the saved row joined with
 * the analysis. When there is no DB client, returns the analysis with scanId=null.
 */
export async function saveScan(
  client: SupabaseClient | null,
  user: AuthUser,
  scanType: ScanType,
  input: { text?: string; url?: string; filePath?: string },
  result: ScanResult,
): Promise<SavedScan> {
  const createdAt = new Date().toISOString();
  const base: SavedScan = { ...result, scanId: null, scanType, createdAt };
  if (!client) return base;

  const { data: scan, error } = await client
    .from("scans")
    .insert({
      user_id: user.id,
      scan_type: scanType,
      input_text: input.text ?? null,
      input_url: input.url ?? null,
      input_file_path: input.filePath ?? null,
      scam_probability: result.scamProbability,
      trust_score: result.trustScore,
      risk_level: result.riskLevel,
      scam_type: result.scamType,
      ai_model: result.aiModel,
      processing_time_ms: result.processingTimeMs,
    })
    .select("id, created_at")
    .single();

  if (error || !scan) {
    logger.error(`Failed to save scan for ${user.id}: ${error?.message}`);
    return base;
  }

  if (result.flags.length > 0) {
    const { error: flagError } = await client.from("scan_flags").insert(
      result.flags.map((f) => ({
        scan_id: scan.id,
        flag: f.flag,
        severity: f.severity,
        description: f.description,
      })),
    );
    if (flagError) logger.warn(`Failed to save flags for scan ${scan.id}: ${flagError.message}`);
  }

  return { ...base, scanId: scan.id as string, createdAt: scan.created_at as string };
}

/** Best-effort audit log (insert as the user under RLS). */
export async function audit(
  client: SupabaseClient | null,
  userId: string,
  action: string,
  resource: string,
  ip: string | undefined,
  userAgent: string | undefined,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!client) return;
  const { error } = await client.from("audit_logs").insert({
    user_id: userId,
    action,
    resource,
    ip_address: ip ?? null,
    user_agent: userAgent ?? null,
    metadata,
  });
  if (error) logger.warn(`Audit log failed: ${error.message}`);
}

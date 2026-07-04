import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { config, isSupabaseConfigured } from "../config";
import { logger } from "../utils/logger";
import type { AuthUser, ScanResult, ScanType } from "../types";

let anonClient: SupabaseClient | null = null;

/** Shared anon client — used internally for JWT validation and public RPC calls. */
function getAnonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!anonClient) {
    anonClient = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anonClient;
}

/** Public anon client for engine/reputation queries (no user context needed). */
export function getPublicClient(): SupabaseClient | null {
  return getAnonClient();
}

/**
 * Build a request-scoped client that acts as the user (their JWT is attached),
 * so every query runs under RLS as that user. Returns null in dev (no token).
 */
export function getUserClient(token?: string): SupabaseClient | null {
  if (!isSupabaseConfigured || !token) return null;
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Verify a Supabase access token and resolve the app user (id, email, plan).
 * @returns the user, or null if the token is invalid / Supabase is unconfigured.
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  const client = getAnonClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  // Resolve the effective plan (own plan, or a shared plan the user is a member of)
  // plus the admin flag, both as the user under RLS.
  const userClient = getUserClient(token);
  let plan: AuthUser["plan"] = "free";
  let isAdmin = false;
  if (userClient) {
    const [{ data: eff }, { data: profile }] = await Promise.all([
      userClient.rpc("app_effective_plan"),
      userClient.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle(),
    ]);
    if (eff) plan = eff as AuthUser["plan"];
    isAdmin = (profile as { is_admin?: boolean } | null)?.is_admin ?? false;
  }

  return { id: data.user.id, email: data.user.email ?? "", plan, isAdmin };
}

/**
 * Verify an API key (by its SHA-256 hash) via the SECURITY DEFINER RPC.
 * @returns the owning user (id, email, plan), or null if invalid/revoked.
 */
export async function verifyApiKey(hash: string): Promise<AuthUser | null> {
  const client = getAnonClient();
  if (!client) return null;
  const { data, error } = await client.rpc("app_verify_api_key", { p_hash: hash });
  if (error) {
    logger.warn(`API key verify failed: ${error.message}`);
    return null;
  }
  const row = (data as { user_id: string; email: string; plan: string }[] | null)?.[0];
  if (!row) return null;
  return { id: row.user_id, email: row.email ?? "", plan: row.plan as AuthUser["plan"] };
}

/**
 * Persist a scan made via an API key (privileged insert gated by key possession).
 * @returns the new scan id, or null on failure.
 */
export async function recordApiScan(
  hash: string,
  scanType: ScanType,
  input: { text?: string; url?: string },
  result: ScanResult,
): Promise<string | null> {
  const client = getAnonClient();
  if (!client) return null;
  const { data, error } = await client.rpc("app_record_api_scan", {
    p_hash: hash,
    p_scan_type: scanType,
    p_input_text: input.text ?? null,
    p_input_url: input.url ?? null,
    p_scam_probability: result.scamProbability,
    p_trust_score: result.trustScore,
    p_risk_level: result.riskLevel,
    p_scam_type: result.scamType,
    p_ai_model: result.aiModel,
    p_processing_time_ms: result.processingTimeMs,
    p_flags: result.flags,
  });
  if (error) {
    logger.warn(`API scan record failed: ${error.message}`);
    return null;
  }
  return (data as string) ?? null;
}

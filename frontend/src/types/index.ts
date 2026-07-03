/**
 * Frontend types. The scan contract lives in @neural-shield/types and is
 * re-exported here, so existing `@/types` imports keep working. Types that are
 * specific to the web app (profile rows, API keys, the API envelope, DB row
 * shapes) stay local.
 */

export type {
  ScanType,
  RiskLevel,
  FlagSeverity,
  ScanFlag,
  Plan,
  ScanResult,
  SavedScan,
} from "@neural-shield/types";

import type { FlagSeverity, Plan, RiskLevel, ScanType } from "@neural-shield/types";

export interface NotificationPrefs {
  scam_alerts: boolean;
  weekly_digest: boolean;
  product_updates: boolean;
}

/** A row from `public.profiles` (1:1 with the Supabase auth user). */
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  is_admin: boolean;
  daily_scan_count: number;
  daily_scan_reset_at: string;
  avatar_url: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
}

/** A row from `public.api_keys` (the secret itself is never stored). */
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_four: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

/** Standard API envelope returned by the backend. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  details?: unknown;
  timestamp: string;
}

/** A persisted scan row from `public.scans`. */
export interface ScanRow {
  id: string;
  user_id: string;
  scan_type: ScanType;
  input_text: string | null;
  input_url: string | null;
  input_file_path: string | null;
  scam_probability: number;
  trust_score: number;
  risk_level: RiskLevel;
  scam_type: string | null;
  ai_model: string;
  processing_time_ms: number | null;
  created_at: string;
}

export interface ScanFlagRow {
  id: string;
  scan_id: string;
  flag: string;
  severity: FlagSeverity;
  description: string | null;
}

export type ScanRowWithFlags = ScanRow & { scan_flags: ScanFlagRow[] };

/** Shared application types. */

export type Plan = "free" | "pro" | "business";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export type ScanType =
  | "message"
  | "url"
  | "email"
  | "screenshot"
  | "qr"
  | "phone"
  | "upi";

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

export type FlagSeverity = "info" | "warning" | "danger";

export interface ScanFlag {
  flag: string;
  severity: FlagSeverity;
  description: string;
}

/** Analysis returned by the backend scan API. */
export interface ScanResult {
  scamProbability: number; // 0.0–1.0
  trustScore: number; // 0–100
  riskLevel: RiskLevel;
  scamType: string | null;
  flags: ScanFlag[];
  recommendation: string;
  detailedAnalysis: string;
  aiModel: string;
  processingTimeMs: number;
}

export interface SavedScan extends ScanResult {
  scanId: string | null;
  scanType: ScanType;
  createdAt: string;
  /** OCR text (screenshot scans) */
  extractedText?: string;
  /** decoded QR payload (qr scans) */
  decodedText?: string;
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

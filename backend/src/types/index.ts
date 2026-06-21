/** Canonical scan contract shared (by convention) with the frontend. */

export type ScanType =
  | "message"
  | "url"
  | "email"
  | "screenshot"
  | "qr"
  | "phone"
  | "upi";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export type FlagSeverity = "info" | "warning" | "danger";

export interface ScanFlag {
  flag: string;
  severity: FlagSeverity;
  description: string;
}

/** Raw analysis returned by the AI service. */
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

/** Persisted scan + analysis returned to the client. */
export interface SavedScan extends ScanResult {
  scanId: string | null;
  scanType: ScanType;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  plan: "free" | "pro" | "business";
}

export interface ScanInput {
  type: ScanType;
  content: string;
  extractedText?: string;
}

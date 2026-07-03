/**
 * Canonical shared types for Neural Shield AI.
 *
 * These are the scan contract types that the backend produces and the clients
 * consume. They live here so the same shape is used everywhere instead of being
 * copied into each app and drifting apart. This is a declaration-only package,
 * so importing from it never adds anything to a runtime bundle.
 */

export type ScanType =
  | "message"
  | "url"
  | "email"
  | "screenshot"
  | "qr"
  | "phone"
  | "upi";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export type Plan = "free" | "pro" | "business";

export type FlagSeverity = "info" | "warning" | "danger";

export interface ScanFlag {
  flag: string;
  severity: FlagSeverity;
  description: string;
}

/** Analysis returned by the backend scan API. */
export interface ScanResult {
  scamProbability: number; // 0.0 to 1.0
  trustScore: number; // 0 to 100
  riskLevel: RiskLevel;
  scamType: string | null;
  flags: ScanFlag[];
  recommendation: string;
  detailedAnalysis: string;
  aiModel: string;
  processingTimeMs: number;
}

/** A persisted scan plus its analysis, as returned to a client. */
export interface SavedScan extends ScanResult {
  scanId: string | null;
  scanType: ScanType;
  createdAt: string;
  /** OCR text, present on screenshot scans. */
  extractedText?: string;
  /** Decoded payload, present on QR scans. */
  decodedText?: string;
}

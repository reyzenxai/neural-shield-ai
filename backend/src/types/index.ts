/**
 * Backend types. The scan contract now lives in @neural-shield/types and is
 * re-exported here so existing imports (`../types`) keep working unchanged.
 * Types that are backend only (the authenticated user, the AI input shape) stay
 * local.
 */

export type {
  ScanType,
  RiskLevel,
  FlagSeverity,
  ScanFlag,
  ScanResult,
  SavedScan,
  Plan,
} from "@neural-shield/types";

import type { Plan, ScanType } from "@neural-shield/types";

export interface AuthUser {
  id: string;
  email: string;
  plan: Plan;
  isAdmin?: boolean;
}

export interface ScanInput {
  type: ScanType;
  content: string;
  extractedText?: string;
}

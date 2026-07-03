import type { Plan, ScanType } from "../types";

export interface PlanRules {
  /** Scans per user per month. null means unlimited. */
  monthlyScans: number | null;
  /** Scans per user per day. null means unlimited. */
  dailyScans: number | null;
  /** Scanners this plan may use. */
  scanners: ScanType[];
  /** Days of scan history the user can see. */
  historyDays: number;
}

const TEXT: ScanType[] = ["message", "url", "email", "phone", "upi"];
const ALL: ScanType[] = [...TEXT, "screenshot", "qr"];

/**
 * Plan rules for scan-limit enforcement. This mirrors the PLANS catalog in
 * packages/config (the frontend source of truth). It is a local copy because the
 * backend compiles with tsc and deploys to Vercel, so it cannot consume the runtime
 * workspace package without a build step. Keep the two in sync.
 */
export const PLAN_RULES: Record<Plan, PlanRules> = {
  free: { monthlyScans: null, dailyScans: 10, scanners: TEXT, historyDays: 7 },
  individual: { monthlyScans: 150, dailyScans: 30, scanners: TEXT, historyDays: 30 },
  two_person: { monthlyScans: 110, dailyScans: 22, scanners: TEXT, historyDays: 30 },
  family: { monthlyScans: 75, dailyScans: 15, scanners: TEXT, historyDays: 30 },
  pro: { monthlyScans: null, dailyScans: null, scanners: ALL, historyDays: 60 },
};

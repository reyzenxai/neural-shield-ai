import type { Plan, ScanType } from "../types";

export interface PlanRules {
  /** Scans per user per month. null means unlimited/disabled. */
  monthlyScans: number | null;
  /** Total scans per user per day across all scanners (used by Free). null = not used. */
  dailyScans: number | null;
  /**
   * Scans per user per day for EACH scanner type (used by paid plans). null = not used.
   * e.g. 30 means 30 message + 30 url + 30 email + 30 phone + 30 upi per day.
   */
  dailyScansPerType: number | null;
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
 *
 * Free is metered by a single daily total (dailyScans). Paid plans are metered
 * PER scanner type (dailyScansPerType). Monthly caps were dropped.
 */
export const PLAN_RULES: Record<Plan, PlanRules> = {
  free: { monthlyScans: null, dailyScans: 10, dailyScansPerType: null, scanners: TEXT, historyDays: 7 },
  individual: { monthlyScans: null, dailyScans: null, dailyScansPerType: 30, scanners: TEXT, historyDays: 30 },
  two_person: { monthlyScans: null, dailyScans: null, dailyScansPerType: 22, scanners: TEXT, historyDays: 30 },
  family: { monthlyScans: null, dailyScans: null, dailyScansPerType: 15, scanners: TEXT, historyDays: 30 },
  pro: { monthlyScans: null, dailyScans: null, dailyScansPerType: null, scanners: ALL, historyDays: 60 },
};

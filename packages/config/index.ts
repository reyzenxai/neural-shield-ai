/**
 * Shared, runtime-agnostic constants. These are plain data (no environment
 * access), so any app can import them. The values here are the single source of
 * truth for risk vocabulary, plan limits, and the scanner catalog, which are
 * currently copied into the mobile app and the extension.
 */

import type { Plan, RiskLevel, ScanType } from "@neural-shield/types";

export const RISK_LEVELS: RiskLevel[] = ["safe", "low", "medium", "high", "critical"];

export const RISK_LABELS: Record<string, string> = {
  safe: "Safe",
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical",
  unknown: "Unknown",
  error: "Error",
};

export const RISK_COLORS: Record<string, string> = {
  safe: "#22c55e",
  low: "#84cc16",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
  unknown: "#6b7280",
  error: "#6b7280",
};

/**
 * Legacy per-plan daily limit map. Superseded by the PLANS catalog below, which is
 * the source of truth for quotas. Kept for older consumers; mirrors PLANS.dailyScans
 * (Pro is unlimited, shown here as a large number).
 */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 10,
  individual: 30,
  two_person: 22,
  family: 15,
  pro: 999999,
};

export interface ScanTypeConfig {
  type: ScanType;
  label: string;
  description: string;
  icon: string;
  placeholder: string;
  proOnly: boolean;
}

export const SCAN_TYPES: ScanTypeConfig[] = [
  {
    type: "message",
    label: "Message",
    description: "SMS, WhatsApp, or any text",
    icon: "message-square",
    placeholder: "Paste the suspicious message here (min 10 characters)...",
    proOnly: false,
  },
  {
    type: "url",
    label: "URL / Link",
    description: "Check any website or link",
    icon: "link",
    placeholder: "https://suspicious-link.com",
    proOnly: false,
  },
  {
    type: "email",
    label: "Email",
    description: "Paste full email body to analyze",
    icon: "mail",
    placeholder: "Paste the email content here, subject, body, any suspicious text...",
    proOnly: false,
  },
  {
    type: "phone",
    label: "Phone Number",
    description: "Verify any phone number",
    icon: "phone",
    placeholder: "9876543210  or  +91 98765 43210",
    proOnly: false,
  },
  {
    type: "upi",
    label: "UPI / Payment",
    description: "Check UPI ID or payment request",
    icon: "credit-card",
    placeholder: "someone@paytm  or  name@okaxis",
    proOnly: false,
  },
  {
    type: "screenshot",
    label: "Screenshot",
    description: "Scan image for scam text (Pro)",
    icon: "image",
    placeholder: "",
    proOnly: true,
  },
  {
    type: "qr",
    label: "QR Code",
    description: "Scan QR with camera (Pro)",
    icon: "qr-code",
    placeholder: "",
    proOnly: true,
  },
];

// ---------------------------------------------------------------------------
// Plan catalog: the single source of truth for pricing and quotas.
// Quotas are per user. Screenshot and QR scanning are Pro only.
// ---------------------------------------------------------------------------

export type PlanId = "free" | "individual" | "two_person" | "family" | "pro";

export interface PlanDef {
  id: PlanId;
  name: string;
  priceInr: number;
  /** Total users including the owner. */
  seats: number;
  /** Scans per user per month. null means unlimited. */
  monthlyScans: number | null;
  /** Scans per user per day across the allowed scanners. null means unlimited. */
  dailyScans: number | null;
  /** Which scanners this plan can use. */
  scanners: ScanType[];
  /** How many days of scan history the user can see. */
  historyDays: number;
  pdfExport: boolean;
}

const TEXT_SCANNERS: ScanType[] = ["message", "url", "email", "phone", "upi"];
const ALL_SCANNERS: ScanType[] = [...TEXT_SCANNERS, "screenshot", "qr"];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free", name: "Free", priceInr: 0, seats: 1,
    monthlyScans: null, dailyScans: 10, scanners: TEXT_SCANNERS, historyDays: 7, pdfExport: false,
  },
  individual: {
    id: "individual", name: "Individual", priceInr: 149, seats: 1,
    monthlyScans: 150, dailyScans: 30, scanners: TEXT_SCANNERS, historyDays: 30, pdfExport: true,
  },
  two_person: {
    id: "two_person", name: "Two-person", priceInr: 219, seats: 2,
    monthlyScans: 110, dailyScans: 22, scanners: TEXT_SCANNERS, historyDays: 30, pdfExport: true,
  },
  family: {
    id: "family", name: "Family", priceInr: 299, seats: 4,
    monthlyScans: 75, dailyScans: 15, scanners: TEXT_SCANNERS, historyDays: 30, pdfExport: true,
  },
  pro: {
    id: "pro", name: "Pro", priceInr: 499, seats: 1,
    monthlyScans: null, dailyScans: null, scanners: ALL_SCANNERS, historyDays: 60, pdfExport: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "individual", "two_person", "family", "pro"];

/** Human-readable feature bullets for a plan, used on the pricing page. */
export function planFeatureLines(p: PlanDef): string[] {
  const lines: string[] = [];
  if (p.monthlyScans == null && p.dailyScans == null) {
    lines.push("Unlimited scans");
  } else if (p.monthlyScans == null) {
    lines.push(`${p.dailyScans} scans / day`);
  } else {
    const perUser = p.seats > 1 ? " per user" : "";
    lines.push(`${p.monthlyScans} scans / month${perUser} (${p.dailyScans} / day)`);
  }
  lines.push(
    p.scanners.length === 7
      ? "All 7 scanners (+ Screenshot, QR)"
      : "5 core scanners: Message, URL, Email, Phone, UPI",
  );
  if (p.seats > 1) lines.push(`${p.seats} users (you + ${p.seats - 1})`);
  lines.push(`${p.historyDays}-day scan history`);
  if (p.pdfExport) lines.push("PDF export");
  return lines;
}

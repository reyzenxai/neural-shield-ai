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
 * Daily scan limit per plan, as shown to users in the clients. Note: the backend
 * currently enforces a free limit of 10 in scan.service.ts, which disagrees with
 * the 5 shown here. That drift is exactly what this shared value is meant to fix,
 * but the backend number should be reconciled deliberately rather than silently,
 * so it is left as is for now. See docs/refactoring-report.md.
 */
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 5,
  pro: 100,
  business: 999999,
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

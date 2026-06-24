export type Plan = "free" | "pro" | "business";

export type ScanType = "message" | "url" | "email" | "phone" | "upi" | "screenshot" | "qr";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface ScanResult {
  scanId: string;
  scanType: ScanType;
  scamProbability: number;
  trustScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  signals: string[];
  flags: string[];
  explanation: string;
  scamType?: string;
  createdAt: string;
}

export interface ScanHistoryItem {
  id: string;
  scan_type: ScanType;
  content_preview: string;
  scam_probability: number;
  trust_score: number;
  risk_level: RiskLevel;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  daily_scans_used: number;
  daily_scan_limit: number;
}

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
    placeholder: "Paste the suspicious message here...",
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
    description: "Paste email content + sender",
    icon: "mail",
    placeholder: "From: sender@domain.com\n\nEmail body here...",
    proOnly: false,
  },
  {
    type: "phone",
    label: "Phone Number",
    description: "Verify any phone number",
    icon: "phone",
    placeholder: "+91 98765 43210",
    proOnly: false,
  },
  {
    type: "upi",
    label: "UPI / Payment",
    description: "Check UPI ID or payment request",
    icon: "credit-card",
    placeholder: "someone@paytm or upi://pay?pa=...",
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

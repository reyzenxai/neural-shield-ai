export const colors = {
  background: "#0a0a12",
  surface: "#12101f",
  surfaceAlt: "#1a1730",
  border: "#2a2545",
  primary: "#8B5CF6",
  primaryLight: "#A855F7",
  primaryDim: "rgba(139,92,246,0.15)",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.35)",
  safe: "#22c55e",
  suspicious: "#f59e0b",
  dangerous: "#f97316",
  critical: "#ef4444",
  riskBg: {
    safe: "rgba(34,197,94,0.12)",
    suspicious: "rgba(245,158,11,0.12)",
    dangerous: "rgba(249,115,22,0.12)",
    critical: "rgba(239,68,68,0.12)",
  },
} as const;

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export function riskColor(level: string) {
  switch (level?.toLowerCase()) {
    case "safe": return colors.safe;
    case "low":
    case "suspicious": return colors.suspicious;
    case "medium":
    case "dangerous": return colors.dangerous;
    case "high":
    case "critical": return colors.critical;
    default: return colors.textMuted;
  }
}

export function riskBg(level: string) {
  switch (level?.toLowerCase()) {
    case "safe": return colors.riskBg.safe;
    case "low":
    case "suspicious": return colors.riskBg.suspicious;
    case "medium":
    case "dangerous": return colors.riskBg.dangerous;
    case "high":
    case "critical": return colors.riskBg.critical;
    default: return colors.primaryDim;
  }
}

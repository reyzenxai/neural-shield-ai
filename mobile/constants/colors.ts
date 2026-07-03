/* Neural Shield AI — Design Tokens
   Matched to the website (globals.css OKLCH values converted to hex).
   Primary palette: deep-purple background + purple-500 accent + fuchsia secondary.
*/
export const colors = {
  // ── Backgrounds ──────────────────────────────────────────────
  bg:          "#0D0721",  // oklch(0.11 0.06 295) — website --background
  surface:     "#130D2E",  // oklch(0.19 0.06 295) — website --surface
  card:        "#110B28",  // oklch(0.17 0.05 295) — website --card
  cardHigh:    "#1A1038",

  // ── Borders ──────────────────────────────────────────────────
  border:      "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.12)",
  borderFocus: "rgba(168,85,247,0.55)",

  // ── Brand / Accent ───────────────────────────────────────────
  accent:      "#A855F7",  // purple-500  — website --primary
  accentGlow:  "#C084FC",  // purple-400  — website --accent
  accentDim:   "rgba(168,85,247,0.15)",
  accentMid:   "rgba(168,85,247,0.30)",
  secondary:   "#D946EF",  // fuchsia-500 — website --secondary

  // ── Semantic ─────────────────────────────────────────────────
  success:     "#10B981",  // emerald-500 — matches website
  successDim:  "rgba(16,185,129,0.15)",
  warning:     "#F59E0B",
  warningDim:  "rgba(245,158,11,0.15)",
  danger:      "#EF4444",
  dangerDim:   "rgba(239,68,68,0.15)",

  // ── Text ─────────────────────────────────────────────────────
  text:        "#FFFFFF",
  textSub:     "#94A3B8",
  textDim:     "rgba(148,163,184,0.55)",
  textFaint:   "rgba(148,163,184,0.30)",

  // ── Backward-compat aliases ───────────────────────────────────
  background:  "#0D0721",
  primary:     "#A855F7",
  primaryDim:  "rgba(168,85,247,0.15)",
  primaryGlow: "rgba(168,85,247,0.30)",
  accentDimOld:"rgba(168,85,247,0.15)",
  safe:        "#10B981",
  suspicious:  "#F59E0B",
  dangerous:   "#F97316",
  critical:    "#EF4444",
  borderStrong:"rgba(255,255,255,0.12)",
  textMuted:   "#94A3B8",
};

export function riskColor(level?: string): string {
  switch (level?.toLowerCase()) {
    case "safe":                     return colors.success;
    case "low": case "suspicious":   return colors.warning;
    case "medium": case "dangerous": return "#F97316";
    case "high": case "critical":    return colors.danger;
    default:                         return colors.accent;
  }
}

export function riskGradient(level?: string): [string, string] {
  switch (level?.toLowerCase()) {
    case "safe":                     return ["#10B981", "#059669"];
    case "low": case "suspicious":   return ["#F59E0B", "#D97706"];
    case "medium": case "dangerous": return ["#F97316", "#EA580C"];
    case "high": case "critical":    return ["#EF4444", "#DC2626"];
    default:                         return ["#A855F7", "#D946EF"];
  }
}

export const G = {
  primary:  ["#A855F7", "#D946EF"] as const,  // purple → fuchsia
  cyber:    ["#C084FC", "#A855F7"] as const,  // purple-400 → purple-500
  success:  ["#10B981", "#059669"] as const,
  danger:   ["#EF4444", "#DC2626"] as const,
  card:     ["#110B28", "#0D0721"] as const,
};

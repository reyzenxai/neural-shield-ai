import { Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { riskColor, riskGradient } from "../../constants/colors";

type Size = "xs" | "sm" | "md" | "lg";

const LABELS: Record<string, string> = {
  safe: "SAFE", low: "LOW", suspicious: "SUSPICIOUS",
  medium: "MEDIUM", dangerous: "DANGEROUS", high: "HIGH", critical: "CRITICAL",
};
const ICONS: Record<string, string> = {
  safe: "✓", low: "↓", suspicious: "!", medium: "⚠",
  dangerous: "⚡", high: "▲", critical: "✗",
};

interface RiskBadgeProps { level?: string; size?: Size }

export function RiskBadge({ level = "safe", size = "md" }: RiskBadgeProps) {
  const color  = riskColor(level);
  const [g1, g2] = riskGradient(level);
  const label  = LABELS[level?.toLowerCase()] ?? level?.toUpperCase();
  const icon   = ICONS[level?.toLowerCase()] ?? "?";

  const dim = size === "xs" ? { px: 6,  py: 3, fs: 8.5, iFs: 7,   gap: 3 }
            : size === "sm" ? { px: 8,  py: 4, fs: 9.5, iFs: 9,   gap: 4 }
            : size === "lg" ? { px: 16, py: 7, fs: 13,  iFs: 13,  gap: 7 }
            :                 { px: 11, py: 5, fs: 11,  iFs: 11,  gap: 5 };

  return (
    <LinearGradient
      colors={[g1 + "25", g2 + "0E"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.badge, { paddingHorizontal: dim.px, paddingVertical: dim.py, borderColor: color + "55", gap: dim.gap }]}
    >
      <Text style={[styles.icon, { fontSize: dim.iFs, color }]}>{icon}</Text>
      <Text style={[styles.label, { fontSize: dim.fs, color }]}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 999, borderWidth: 1, alignSelf: "flex-start",
  },
  icon:  { fontWeight: "900" },
  label: { fontWeight: "800", letterSpacing: 0.8 },
});

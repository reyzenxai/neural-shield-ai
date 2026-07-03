import { View, ViewStyle, StyleSheet } from "react-native";
import { colors } from "../../constants/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "accent" | "danger";
  padding?: number;
}

export function GlassCard({ children, style, variant = "default", padding = 16 }: GlassCardProps) {
  const variantStyle = variant === "elevated" ? styles.elevated
    : variant === "accent" ? styles.accent
    : variant === "danger" ? styles.danger
    : styles.default;

  return (
    <View style={[styles.base, variantStyle, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  default: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.cardHigh,
    borderColor: colors.borderStrong,
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  accent: {
    backgroundColor: colors.card,
    borderColor: colors.primaryDim,
  },
  danger: {
    backgroundColor: colors.card,
    borderColor: "rgba(255,77,109,0.2)",
  },
});

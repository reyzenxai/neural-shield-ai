import { View, Text, StyleSheet } from "react-native";
import { riskColor, riskBg } from "../../constants/colors";

interface Props {
  level: string;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ level, size = "md" }: Props) {
  const label = level?.toUpperCase() ?? "UNKNOWN";
  const color = riskColor(level);
  const bg = riskBg(level);

  const padH = size === "sm" ? 8 : size === "lg" ? 18 : 12;
  const padV = size === "sm" ? 3 : size === "lg" ? 8 : 5;
  const fontSize = size === "sm" ? 10 : size === "lg" ? 15 : 12;

  return (
    <View style={[styles.badge, { backgroundColor: bg, paddingHorizontal: padH, paddingVertical: padV }]}>
      <Text style={[styles.text, { color, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

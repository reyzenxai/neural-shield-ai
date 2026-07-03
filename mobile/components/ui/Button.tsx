import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { colors } from "../../constants/colors";

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
}

export function Button({ title, onPress, loading, disabled, variant = "primary", style }: Props) {
  const bg = variant === "primary" ? colors.primary
    : variant === "secondary" ? colors.surface
    : "transparent";
  const border = variant === "ghost" ? colors.border : "transparent";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === "ghost" ? 1 : 0, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.text, { color: variant === "primary" ? "#fff" : colors.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

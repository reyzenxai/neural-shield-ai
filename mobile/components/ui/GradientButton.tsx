import { useRef } from "react";
import { TouchableOpacity, Text, ActivityIndicator, Animated, ViewStyle, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../constants/colors";

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  size?: "sm" | "md" | "lg";
  icon?: string;
}

const GRADIENTS: Record<string, [string, string]> = {
  primary: ["#4F7CFF", "#7C5CFF"],
  secondary: ["#7C5CFF", "#9D6FFF"],
  danger: ["#FF4D6D", "#CC2244"],
  success: ["#22C55E", "#15803D"],
  ghost: ["transparent", "transparent"],
};

export function GradientButton({
  title, onPress, variant = "primary", loading, disabled, style, size = "md", icon,
}: GradientButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scaleAnim, { toValue: 0.965, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }

  function onPressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }

  const isGhost = variant === "ghost";
  const [c1, c2] = GRADIENTS[variant];
  const padV = size === "lg" ? 18 : size === "sm" ? 10 : 15;
  const textSize = size === "lg" ? 17 : size === "sm" ? 13 : 15;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, disabled && styles.dimmed, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={1}
      >
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradient,
            { paddingVertical: padV },
            isGhost && styles.ghost,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={isGhost ? colors.primary : "#fff"} size="small" />
          ) : (
            <>
              {icon ? <Text style={styles.icon}>{icon}</Text> : null}
              <Text style={[styles.text, { fontSize: textSize }, isGhost && styles.ghostText]}>
                {title}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 8,
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  ghostText: {
    color: colors.textMuted,
  },
  icon: {
    fontSize: 18,
  },
  dimmed: {
    opacity: 0.4,
  },
});

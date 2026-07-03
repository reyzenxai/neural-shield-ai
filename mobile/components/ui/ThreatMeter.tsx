import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ThreatMeterProps {
  value: number;
  color: string;
  label?: string;
  size?: number;
}

export function ThreatMeter({ value, color, label = "scam risk", size = 164 }: ThreatMeterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const scaleAnim  = useRef(new Animated.Value(0.65)).current;
  const outerGlow  = useRef(new Animated.Value(0.1)).current;
  const midPulse   = useRef(new Animated.Value(0.3)).current;
  const ringGlow   = useRef(new Animated.Value(0.5)).current;
  const rotAnim    = useRef(new Animated.Value(0)).current;

  const stroke = Math.round(size * 0.068);

  useEffect(() => {
    // Entrance
    Animated.spring(scaleAnim, { toValue: 1, tension: 52, friction: 8, useNativeDriver: true }).start();

    // Outer halo slow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(outerGlow, { toValue: 0.28, duration: 2800, useNativeDriver: true }),
      Animated.timing(outerGlow, { toValue: 0.1,  duration: 2800, useNativeDriver: true }),
    ])).start();

    // Mid ring pulse (offset phase)
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(midPulse, { toValue: 0.75, duration: 2000, useNativeDriver: true }),
        Animated.timing(midPulse, { toValue: 0.3,  duration: 2000, useNativeDriver: true }),
      ])).start();
    }, 900);

    // Main ring breathe
    Animated.loop(Animated.sequence([
      Animated.timing(ringGlow, { toValue: 1,   duration: 2400, useNativeDriver: true }),
      Animated.timing(ringGlow, { toValue: 0.5, duration: 2400, useNativeDriver: true }),
    ])).start();

    // Slow outer ring rotation (subtle depth cue)
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 12000, useNativeDriver: true })
    ).start();

    // Count-up
    const duration = 1500;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration) { setDisplayValue(value); clearInterval(timer); return; }
      const t = elapsed / duration;
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(value * eased));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  const spin = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const outerSize = size + 72;
  const midSize   = size + 40;
  const outerRingSize = size + 18;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Outermost halo — very large, very faint */}
      <Animated.View style={{
        position: "absolute", width: outerSize, height: outerSize,
        borderRadius: outerSize / 2,
        backgroundColor: color + "0D",
        opacity: outerGlow,
      }} />

      {/* Rotating decorative ring */}
      <Animated.View style={{
        position: "absolute", width: midSize, height: midSize,
        borderRadius: midSize / 2,
        borderWidth: 1, borderColor: color + "30",
        opacity: midPulse,
        transform: [{ rotate: spin }],
      }} />

      {/* Static accent ring */}
      <View style={{
        position: "absolute", width: outerRingSize, height: outerRingSize,
        borderRadius: outerRingSize / 2,
        borderWidth: 1, borderColor: color + "20",
      }} />

      {/* Main ring with gradient shadow */}
      <Animated.View style={{
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        backgroundColor: color + "0C",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
        elevation: 24,
        opacity: ringGlow,
      }}>
        {/* Inner gradient */}
        <LinearGradient
          colors={[color + "14", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />

        {/* Value */}
        <Text style={{
          fontSize: size * 0.30,
          fontWeight: "900",
          color,
          letterSpacing: -3,
          lineHeight: size * 0.33,
          includeFontPadding: false,
        }}>
          {displayValue}
        </Text>
        <Text style={{
          fontSize: size * 0.082,
          color: "rgba(240,246,255,0.4)",
          fontWeight: "700",
          letterSpacing: 0.8,
          marginTop: 2,
          textTransform: "uppercase",
        }}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
});

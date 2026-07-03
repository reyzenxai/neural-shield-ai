import { useEffect, useState, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";

const ONBOARDING_KEY = "ns_onboarding_done";

export default function Index() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const { setSession } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const shieldScale  = useRef(new Animated.Value(0.6)).current;
  const shieldFade   = useRef(new Animated.Value(0)).current;
  const textFade     = useRef(new Animated.Value(0)).current;
  const ring1        = useRef(new Animated.Value(0.15)).current;
  const ring2        = useRef(new Animated.Value(0.15)).current;
  const dotFade      = useRef(new Animated.Value(0)).current;
  const dot1         = useRef(new Animated.Value(0)).current;
  const dot2         = useRef(new Animated.Value(0)).current;
  const dot3         = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSession(session as any); setHasSession(true); }
      setSessionChecked(true);
    });

    // Shield entrance
    Animated.parallel([
      Animated.spring(shieldScale, { toValue: 1, tension: 45, friction: 7, useNativeDriver: true }),
      Animated.timing(shieldFade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Rings pulse
    Animated.loop(Animated.sequence([
      Animated.timing(ring1, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(ring1, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
    ])).start();
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(ring2, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
      ])).start();
    }, 700);

    // Text fade
    setTimeout(() => {
      Animated.timing(textFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 300);

    // Dots bounce in
    Animated.loop(Animated.sequence([
      Animated.timing(dot1, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(dot1, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.delay(200),
    ])).start();
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(dot2, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(200),
      ])).start();
    }, 133);
    setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(dot3, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(200),
      ])).start();
    }, 266);
    setTimeout(() => {
      Animated.timing(dotFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 700);
  }, []);

  useEffect(() => {
    if (!navState?.key || !sessionChecked) return;
    (async () => {
      if (hasSession) {
        router.replace("/(tabs)/home");
        return;
      }
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        router.replace("/onboarding");
      } else {
        router.replace("/(auth)/login");
      }
    })();
  }, [navState?.key, sessionChecked, hasSession]);

  const dot1Y = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const dot2Y = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const dot3Y = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.12)", "rgba(13,7,33,0)", "rgba(217,70,239,0.07)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Shield hero */}
      <Animated.View style={[styles.heroWrap, { opacity: shieldFade, transform: [{ scale: shieldScale }] }]}>
        <Animated.View style={[styles.ring, styles.ringOuter, { opacity: ring1 }]} />
        <Animated.View style={[styles.ring, styles.ringMid, { opacity: ring2 }]} />
        <View style={styles.iconBox}>
          <Text style={styles.shield}>🛡️</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View style={{ opacity: textFade, alignItems: "center" }}>
        <Text style={styles.title}>Neural Shield <Text style={styles.titleAccent}>AI</Text></Text>
        <Text style={styles.subtitle}>Verifying your session…</Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: dotFade }]}>
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1Y }] }]} />
        <Animated.View style={[styles.dot, { backgroundColor: "#D946EF", transform: [{ translateY: dot2Y }] }]} />
        <Animated.View style={[styles.dot, { backgroundColor: "#C084FC", transform: [{ translateY: dot3Y }] }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0721", alignItems: "center", justifyContent: "center", gap: 24 },

  heroWrap: { alignItems: "center", justifyContent: "center", width: 140, height: 140 },
  ring: { position: "absolute", borderRadius: 999 },
  ringOuter: { width: 140, height: 140, borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", backgroundColor: "rgba(168,85,247,0.06)" },
  ringMid:   { width: 108, height: 108, borderWidth: 1, borderColor: "rgba(168,85,247,0.4)", backgroundColor: "rgba(168,85,247,0.08)" },
  iconBox: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: "#111827",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.4)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#A855F7", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 12,
  },
  shield: { fontSize: 38 },

  title: { fontSize: 24, fontWeight: "900", color: "#F0F4FF", letterSpacing: -0.5, textAlign: "center" },
  titleAccent: { color: "#A855F7" },
  subtitle: { fontSize: 13, color: "rgba(240,244,255,0.45)", marginTop: 6 },

  dotsRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#A855F7" },
});

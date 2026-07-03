import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthListener } from "../hooks/useAuth";
import { supabaseReady } from "../lib/supabase";
import { Shield } from "../lib/icons";
import { colors } from "../constants/colors";

SplashScreen.preventAutoHideAsync();

// PERF-02: generous stale/gc times eliminate loading flicker on tab switches
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      retryDelay: 1000,
    },
  },
});

// BUG-07: shown when EXPO_PUBLIC_SUPABASE_URL / ANON_KEY are missing
function MissingConfigScreen() {
  return (
    <View style={cfg.root}>
      <LinearGradient colors={["rgba(168,85,247,0.1)", colors.bg]} style={StyleSheet.absoluteFillObject} />
      <View style={cfg.card}>
        <View style={cfg.iconWrap}>
          <Shield size={36} color={colors.danger} strokeWidth={1.6} />
        </View>
        <Text style={cfg.title}>Configuration Missing</Text>
        <Text style={cfg.body}>
          Supabase credentials are not set.{"\n"}
          Copy <Text style={cfg.mono}>.env.example</Text> to <Text style={cfg.mono}>.env</Text> and fill in your project URL and anon key, then restart the app.
        </Text>
        <Text style={cfg.contact}>Contact: pranjal2876@gmail.com</Text>
      </View>
    </View>
  );
}

// AUTH-02: pulse-shimmer splash while getSession() resolves
function AuthSplash() {
  const pulse = useRef(new Animated.Value(0.6)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={sp.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.1)", colors.bg, "rgba(217,70,239,0.05)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[sp.wrap, { opacity: fade }]}>
        <Animated.View style={[sp.glow, { opacity: pulse }]} />
        <LinearGradient colors={["#2D1458", "#150A32"]} style={sp.icon}>
          <Shield size={38} color={colors.accent} strokeWidth={1.6} />
        </LinearGradient>
        <Animated.View style={[sp.dotRow, { opacity: fade }]}>
          {[0, 1, 2].map(i => (
            <Animated.View key={i} style={[sp.dot, { opacity: pulse, backgroundColor: i === 1 ? colors.secondary : colors.accent }]} />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  useAuthListener();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Small delay lets Supabase attempt to restore session from SecureStore
    // before the navigator renders — prevents flash of login screen for
    // already-authenticated users.
    const t = setTimeout(() => {
      setReady(true);
      SplashScreen.hideAsync();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  if (!supabaseReady) return <MissingConfigScreen />;
  if (!ready) return <AuthSplash />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="result" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
            <Stack.Screen name="phone-setup" options={{ animation: "slide_from_right", gestureEnabled: false }} />
            <Stack.Screen name="privacy-policy" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="terms" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="permissions-setup" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
            <Stack.Screen name="admin" options={{ animation: "slide_from_right" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const cfg = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 28 },
  card:    { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.danger + "40", padding: 28, alignItems: "center", gap: 14, maxWidth: 340, width: "100%" },
  iconWrap:{ width: 66, height: 66, borderRadius: 22, backgroundColor: colors.danger + "18", alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  body:    { fontSize: 13.5, color: colors.textSub, textAlign: "center", lineHeight: 21 },
  mono:    { fontFamily: "monospace", color: colors.accent, fontSize: 12 },
  contact: { fontSize: 11.5, color: colors.textFaint, marginTop: 4 },
});

const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  wrap: { alignItems: "center", gap: 28 },
  glow: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(168,85,247,0.2)" },
  icon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(168,85,247,0.3)" },
  dotRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot:    { width: 7, height: 7, borderRadius: 3.5 },
});

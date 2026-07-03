import { useState, useRef, useEffect, memo } from "react";
import { Tabs, usePathname, router } from "expo-router";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  Animated, Pressable, Image, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Home, Shield, MessageSquare, Link2, Mail, Phone,
  CreditCard, ImageIcon, QrCode, X,
} from "../../lib/icons";
import { colors } from "../../constants/colors";
import { useAuthStore } from "../../lib/store";
import { AVATAR_KEY, AVATAR_OPTIONS } from "../../constants/avatar";

const SCAN_OPTIONS = [
  { type: "message",    label: "Text / SMS",    sub: "Analyze messages & WhatsApp for scams", Icon: MessageSquare, color: "#3B82F6", proOnly: false },
  { type: "url",        label: "URL / Link",    sub: "Check websites & domains for threats",  Icon: Link2,         color: "#7C3AED", proOnly: false },
  { type: "email",      label: "Email",         sub: "Detect phishing & fraud emails",        Icon: Mail,          color: "#06B6D4", proOnly: false },
  { type: "phone",      label: "Phone Number",  sub: "Verify caller identity & risk level",   Icon: Phone,         color: "#F59E0B", proOnly: false },
  { type: "upi",        label: "UPI / Payment", sub: "Validate UPI IDs & payment handles",    Icon: CreditCard,    color: "#22C55E", proOnly: false },
  { type: "screenshot", label: "Screenshot",    sub: "Scan images & fake payment screenshots", Icon: ImageIcon,     color: "#F97316", proOnly: true },
  { type: "qr",         label: "QR Code",       sub: "Decode & analyze QR codes for threats", Icon: QrCode,        color: "#EF4444", proOnly: true },
] as const;

const ScanModal = memo(function ScanModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets  = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const isPro   = profile?.plan === "pro" || profile?.plan === "business";

  const overlayAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim   = useRef(new Animated.Value(500)).current;
  const itemAnims   = useRef(SCAN_OPTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(sheetAnim,   { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
      ]).start();
      SCAN_OPTIONS.forEach((_, i) => {
        Animated.spring(itemAnims[i], {
          toValue: 1, delay: 80 + i * 55,
          tension: 72, friction: 10, useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(sheetAnim,   { toValue: 500, duration: 200, useNativeDriver: true }),
      ]).start();
      itemAnims.forEach(a => a.setValue(0));
    }
  }, [visible]);

  function handleOption(type: string, proOnly: boolean) {
    if (proOnly && !isPro) {
      Alert.alert(
        "Pro Feature Required",
        "Screenshot and QR code scanning require the Pro plan.\n\nUpgrade to Pro to unlock image scanning, QR code analysis, and 100 scans/day.",
        [
          {
            text: "Upgrade to Pro",
            onPress: () => {
              onClose();
              setTimeout(() => router.navigate("/(tabs)/profile"), 220);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
      return;
    }
    onClose();
    setTimeout(() => {
      router.navigate({ pathname: "/(tabs)/scan", params: { type } } as any);
    }, 200);
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[m.overlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <Animated.View style={[m.sheet, { transform: [{ translateY: sheetAnim }], paddingBottom: Math.max(insets.bottom, 20) }]}>
          <LinearGradient colors={["#0F0A24", "#070410"]} style={StyleSheet.absoluteFillObject} />

          <View style={m.handle} />
          <Text style={m.title}>What do you want to scan?</Text>
          <Text style={m.sub}>Tap a category to start analyzing</Text>

          {SCAN_OPTIONS.map((opt, i) => {
            const slide = itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
            return (
              <Animated.View key={opt.type} style={{ opacity: itemAnims[i], transform: [{ translateY: slide }] }}>
                <TouchableOpacity
                  style={m.optRow}
                  onPress={() => handleOption(opt.type, opt.proOnly)}
                  activeOpacity={0.72}
                >
                  <View style={[m.optIcon, { backgroundColor: opt.color + "1A" }]}>
                    <opt.Icon size={19} color={opt.proOnly && !isPro ? colors.textSub : opt.color} strokeWidth={2} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[m.optLabel, opt.proOnly && !isPro && { color: colors.textSub }]}>
                        {opt.label}
                      </Text>
                      {opt.proOnly && (
                        <View style={m.proBadge}>
                          <Text style={m.proText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={m.optSub}>{opt.sub}</Text>
                  </View>

                  <View style={[m.optChevron, { backgroundColor: opt.proOnly && !isPro ? colors.border : opt.color + "14" }]}>
                    <Text style={[m.optChevronText, { color: opt.proOnly && !isPro ? colors.textDim : opt.color }]}>›</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.82}>
            <X size={17} color={colors.textSub} />
            <Text style={m.closeTxt}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const CustomTabBar = memo(function CustomTabBar({ onFabPress }: { onFabPress: () => void }) {
  const insets   = useSafeAreaInsets();
  const pathname = usePathname();
  const { session, avatarIndex } = useAuthStore();

  const isHome    = pathname.includes("/home");
  const isProfile = pathname.includes("/profile");

  const avatarUrl    = (session?.user as any)?.user_metadata?.avatar_url as string | undefined;
  const isGoogleUser = (session?.user as any)?.app_metadata?.provider === "google";
  const email        = session?.user?.email ?? "";
  const initials     = email.split("@")[0].slice(0, 2).toUpperCase() || "?";
  const hasCustomAvatar = !isGoogleUser && avatarIndex >= 0;
  const chosenAvatar    = AVATAR_OPTIONS[Math.max(0, avatarIndex)];

  const fabScale = useRef(new Animated.Value(1)).current;

  function pressFab() {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.86, tension: 220, friction: 6, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1,    tension: 180, friction: 7, useNativeDriver: true }),
    ]).start();
    onFabPress();
  }

  return (
    <View style={[b.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={b.border} />
      <LinearGradient colors={["rgba(13,7,33,0.97)", "#0D0721"]} style={StyleSheet.absoluteFillObject} />

      {/* Home */}
      <TouchableOpacity style={b.tab} onPress={() => router.navigate("/(tabs)/home")} activeOpacity={0.72}>
        <Home size={21} color={isHome ? colors.accent : colors.textSub} />
        <Text style={[b.label, isHome && b.labelActive]}>Home</Text>
        {isHome && <View style={b.dot} />}
      </TouchableOpacity>

      {/* Centre FAB — purple gradient matching website */}
      <View style={b.fabCol}>
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <TouchableOpacity onPress={pressFab} activeOpacity={1} style={b.fabTouch}>
            <LinearGradient colors={["#C084FC", "#7C3AED"]} style={b.fab}>
              <Shield size={25} color="#fff" strokeWidth={1.8} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        <Text style={b.fabLabel}>SCAN</Text>
      </View>

      {/* Profile */}
      <TouchableOpacity style={b.tab} onPress={() => router.navigate("/(tabs)/profile")} activeOpacity={0.72}>
        {isGoogleUser && avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[b.avatar, isProfile && { borderColor: colors.accent }]} />
        ) : hasCustomAvatar ? (
          <View style={[b.avatarFallback, { backgroundColor: chosenAvatar.bg }, isProfile && { borderColor: colors.accent }]}>
            <Text style={b.avatarEmoji}>{chosenAvatar.emoji}</Text>
          </View>
        ) : (
          <View style={[b.avatarFallback, isProfile && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}>
            <Text style={[b.avatarText, isProfile && { color: colors.accent }]}>{initials}</Text>
          </View>
        )}
        <Text style={[b.label, isProfile && b.labelActive]}>You</Text>
        {isProfile && <View style={b.dot} />}
      </TouchableOpacity>
    </View>
  );
});

export default function TabsLayout() {
  const [fabOpen, setFabOpen] = useState(false);
  const { setAvatarIndex } = useAuthStore();

  // Hydrate avatar from AsyncStorage so the tab bar reflects a persisted choice immediately
  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(v => {
      if (v !== null) setAvatarIndex(parseInt(v, 10));
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* PERF-01: lazy:false pre-renders all tabs — eliminates first-visit jank */}
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" }, lazy: false }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="history" />
      </Tabs>

      <CustomTabBar onFabPress={() => setFabOpen(true)} />
      <ScanModal visible={fabOpen} onClose={() => setFabOpen(false)} />
    </View>
  );
}

/* ─── Modal styles ─── */
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,2,18,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0F0A24",
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 22, paddingTop: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 22 },
  title: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginBottom: 4 },
  sub:   { fontSize: 13, color: colors.textSub, marginBottom: 20 },

  optRow:         { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.06)" },
  optIcon:        { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optLabel:       { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 2 },
  optSub:         { fontSize: 12, color: colors.textSub },
  optChevron:     { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optChevronText: { fontSize: 22, fontWeight: "500", marginTop: -3 },

  proBadge: { backgroundColor: "#EF4444", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  proText:  { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.6 },

  closeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 16, height: 48, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  closeTxt: { fontSize: 14, fontWeight: "600", color: colors.textSub },
});

/* ─── Bottom bar styles ─── */
const b = StyleSheet.create({
  bar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 10,
    minHeight: 70,
  },
  border: { position: "absolute", top: 0, left: 0, right: 0, height: 0.5, backgroundColor: "rgba(255,255,255,0.07)" },

  tab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 2 },
  label: { fontSize: 10, fontWeight: "600", color: colors.textSub },
  labelActive: { color: colors.accent },
  dot: { position: "absolute", bottom: -4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },

  fabCol:   { alignItems: "center", gap: 5, paddingBottom: 2 },
  fabTouch: { marginTop: -22 },
  fab: {
    width: 58, height: 58, borderRadius: 29,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#A855F7", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55, shadowRadius: 18, elevation: 20,
  },
  fabLabel: { fontSize: 9, fontWeight: "900", color: colors.accentGlow, letterSpacing: 1.4 },

  avatar:        { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: colors.border },
  avatarFallback:{ width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  avatarText:    { fontSize: 9, fontWeight: "800", color: colors.textSub },
  avatarEmoji:   { fontSize: 14 },
});

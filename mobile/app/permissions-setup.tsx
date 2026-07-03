import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Linking, PermissionsAndroid, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Shield, CheckCircle, ChevronRight, Link2 } from "../lib/icons";
import { colors } from "../constants/colors";

export const PERMISSIONS_KEY = "ns_permissions_granted_v1";

const PERMISSIONS = [
  {
    id: "overlay",
    icon: "🪟",
    title: "Display Over Other Apps",
    desc: "Allows Neural Shield to show a safety warning as a pop-up when harmful content is detected while you are using another app.",
    why: "Required to display real-time alerts over any open app.",
    action: "open_overlay_settings",
    btnLabel: "Open Settings",
  },
  {
    id: "background",
    icon: "🔋",
    title: "Run in Background",
    desc: "Keeps Neural Shield active even when you switch to another app, so monitoring never stops.",
    why: "Required to keep the protection engine running continuously.",
    action: "open_battery_settings",
    btnLabel: "Open Settings",
  },
  {
    id: "usage",
    icon: "📊",
    title: "Usage Access",
    desc: "Lets Neural Shield see which app is in the foreground so it knows when to activate content scanning.",
    why: "Required to detect which app you are using and trigger scans at the right time.",
    action: "open_usage_settings",
    btnLabel: "Open Settings",
  },
  {
    id: "media",
    icon: "📂",
    title: "Files, Calls and Messages",
    desc: "Allows Neural Shield to scan incoming SMS messages, shared files, and call metadata for scam patterns.",
    why: "Required to scan SMS texts, shared links, and call data in real time.",
    action: "request_runtime",
    btnLabel: "Allow Access",
  },
] as const;

type PermId = typeof PERMISSIONS[number]["id"];

async function openOverlaySettings() {
  if (Platform.OS !== "android") return;
  try {
    await Linking.openURL("android.settings.action.MANAGE_OVERLAY_PERMISSION");
  } catch {
    await Linking.openSettings();
  }
}

async function openBatterySettings() {
  if (Platform.OS !== "android") return;
  try {
    await Linking.openURL("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
}

async function openUsageSettings() {
  if (Platform.OS !== "android") return;
  try {
    await Linking.openURL("android.settings.USAGE_ACCESS_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
}

async function requestRuntimePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    ]);
    return Object.values(results).some(
      r => r === PermissionsAndroid.RESULTS.GRANTED,
    );
  } catch {
    return false;
  }
}

export default function PermissionsSetupScreen() {
  const [step,    setStep]    = useState(0);
  const [granted, setGranted] = useState<Set<PermId>>(new Set());

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    animateIn();
  }, [step]);

  function animateIn() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }

  async function handleAction() {
    const perm = PERMISSIONS[step];
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (perm.action === "open_overlay_settings")  await openOverlaySettings();
    if (perm.action === "open_battery_settings")  await openBatterySettings();
    if (perm.action === "open_usage_settings")    await openUsageSettings();
    if (perm.action === "request_runtime") {
      await requestRuntimePermissions();
      markGranted();
      return;
    }
    // For settings-based permissions, show "I've allowed" confirmation
  }

  function markGranted() {
    setGranted(prev => new Set([...prev, PERMISSIONS[step].id]));
  }

  async function handleNext() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step < PERMISSIONS.length - 1) {
      setStep(s => s + 1);
    } else {
      await finish();
    }
  }

  async function finish() {
    await AsyncStorage.setItem(PERMISSIONS_KEY, "true");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/home");
  }

  async function skipAll() {
    await AsyncStorage.setItem(PERMISSIONS_KEY, "skipped");
    router.replace("/(tabs)/home");
  }

  const perm       = PERMISSIONS[step];
  const isLast     = step === PERMISSIONS.length - 1;
  const isGranted  = granted.has(perm.id);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.14)", "#0D0721", "rgba(217,70,239,0.06)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[s.orb, s.orbPurple]} />
      <View style={[s.orb, s.orbFuchsia]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.topRow}>
            <View style={s.shieldBg}>
              <Shield size={24} color={colors.accent} strokeWidth={1.8} />
            </View>
            <Text style={s.topLabel}>REAL-TIME PROTECTION SETUP</Text>
          </View>

          {/* Step indicator */}
          <View style={s.stepsRow}>
            {PERMISSIONS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.stepDot,
                  i < step  && s.stepDotDone,
                  i === step && s.stepDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={s.stepCount}>Step {step + 1} of {PERMISSIONS.length}</Text>

          {/* Card */}
          <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={["rgba(168,85,247,0.06)", "transparent"]} style={StyleSheet.absoluteFillObject} />

            <Text style={s.permIcon}>{perm.icon}</Text>
            <Text style={s.permTitle}>{perm.title}</Text>
            <Text style={s.permDesc}>{perm.desc}</Text>

            <View style={s.whyBox}>
              <Text style={s.whyLabel}>Why we need this</Text>
              <Text style={s.whyText}>{perm.why}</Text>
            </View>

            {/* Action button */}
            <TouchableOpacity
              onPress={handleAction}
              activeOpacity={0.85}
              style={s.actionBtnWrap}
            >
              <LinearGradient
                colors={isGranted ? [colors.success + "33", colors.success + "22"] : ["#C084FC", "#7C3AED"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.actionBtn}
              >
                {isGranted
                  ? <CheckCircle size={18} color={colors.success} />
                  : <Link2 size={16} color="#fff" />}
                <Text style={[s.actionBtnText, isGranted && { color: colors.success }]}>
                  {isGranted ? "Permission Granted" : perm.btnLabel}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* For settings-based perms: "I've allowed" confirmation */}
            {perm.action !== "request_runtime" && !isGranted && (
              <TouchableOpacity onPress={markGranted} style={s.confirmRow} activeOpacity={0.7}>
                <CheckCircle size={14} color={colors.accent} />
                <Text style={s.confirmText}>I have allowed this in Settings</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Next / Finish */}
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={s.nextBtnWrap}
          >
            <LinearGradient
              colors={["#C084FC", "#7C3AED"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.nextBtn}
            >
              <Text style={s.nextBtnText}>{isLast ? "Enable Protection" : "Next"}</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={skipAll} style={s.skipRow} activeOpacity={0.7}>
            <Text style={s.skipText}>Skip for now (protection will be limited)</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, alignItems: "center" },

  orb:        { position: "absolute", borderRadius: 999 },
  orbPurple:  { width: 280, height: 280, top: -60,   left: -80,  backgroundColor: "rgba(168,85,247,0.07)" },
  orbFuchsia: { width: 200, height: 200, bottom: 80, right: -60, backgroundColor: "rgba(217,70,239,0.05)" },

  topRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24, alignSelf: "flex-start" },
  shieldBg:  { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent + "30" },
  topLabel:  { fontSize: 10.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2 },

  stepsRow:      { flexDirection: "row", gap: 8, marginBottom: 8 },
  stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { width: 24, backgroundColor: colors.accent, shadowColor: colors.accent, shadowRadius: 6, shadowOpacity: 0.7, elevation: 3 },
  stepDotDone:   { backgroundColor: colors.success },
  stepCount:     { fontSize: 12, color: colors.textSub, marginBottom: 20 },

  card: {
    width: "100%", backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    padding: 24, gap: 16, overflow: "hidden", marginBottom: 20,
    alignItems: "center",
  },
  permIcon:  { fontSize: 52, textAlign: "center" },
  permTitle: { fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center", letterSpacing: -0.4 },
  permDesc:  { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 22 },

  whyBox:   { backgroundColor: colors.surface, borderRadius: 14, padding: 14, width: "100%", borderWidth: 1, borderColor: colors.border },
  whyLabel: { fontSize: 10.5, fontWeight: "800", color: colors.accent, letterSpacing: 1, marginBottom: 6 },
  whyText:  { fontSize: 13, color: colors.textSub, lineHeight: 20 },

  actionBtnWrap: { width: "100%", borderRadius: 14, overflow: "hidden" },
  actionBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15 },
  actionBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  confirmRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 4 },
  confirmText:{ fontSize: 13, color: colors.accent, fontWeight: "600" },

  nextBtnWrap: { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  nextBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 17 },
  nextBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },

  skipRow: { paddingVertical: 8 },
  skipText: { fontSize: 13, color: colors.textDim, textAlign: "center" },
});

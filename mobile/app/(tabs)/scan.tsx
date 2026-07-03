import { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Animated, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  Shield, MessageSquare, Phone, Link2, Mail,
  CreditCard, QrCode, ImageIcon, Zap,
} from "../../lib/icons";
import { ScannerProgress } from "../../components/ui/ScannerProgress";
import { colors } from "../../constants/colors";
import { SCAN_TYPES, type ScanType } from "../../constants/types";
import { scanContent, scanImage, getScanHistory } from "../../lib/api";
import { useScanStore, useAuthStore } from "../../lib/store";
import { useQuery } from "@tanstack/react-query";

const { width: W } = Dimensions.get("window");

const TYPE_CONFIG: Record<ScanType, { Icon: any; color: string; label: string }> = {
  message:    { Icon: MessageSquare, color: "#3B82F6", label: "Message" },
  url:        { Icon: Link2,         color: "#7C3AED", label: "URL" },
  email:      { Icon: Mail,          color: "#06B6D4", label: "Email" },
  phone:      { Icon: Phone,         color: "#F59E0B", label: "Phone" },
  upi:        { Icon: CreditCard,    color: "#22C55E", label: "UPI" },
  screenshot: { Icon: ImageIcon,     color: "#F97316", label: "Screenshot" },
  qr:         { Icon: QrCode,        color: "#EF4444", label: "QR" },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// Pulsing live dot
function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success + "40", transform: [{ scale }] }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success }} />
    </View>
  );
}

export default function ScanScreen() {
  const { type: paramType } = useLocalSearchParams<{ type?: string }>();
  const [activeType, setActiveType] = useState<ScanType>((paramType as ScanType) ?? "message");
  const [content, setContent]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [focused, setFocused]       = useState(false);
  const { setLastResult } = useScanStore();
  const { profile, session } = useAuthStore();
  const { data: history } = useQuery({ queryKey: ["history", 0], queryFn: () => getScanHistory(0, 50), staleTime: 60_000 });

  const headerFade = useRef(new Animated.Value(0)).current;
  const cardFade   = useRef(new Animated.Value(0)).current;
  const cardY      = useRef(new Animated.Value(20)).current;
  const inputFade  = useRef(new Animated.Value(0)).current;
  const btnFade    = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;
  const btnPulse   = useRef(new Animated.Value(0.6)).current;

  const scanConfig = SCAN_TYPES.find(s => s.type === activeType)!;
  const cfg        = TYPE_CONFIG[activeType];
  const usage      = profile?.daily_scans_used ?? 0;
  const limit      = profile?.daily_scan_limit ?? 5;
  const isPro      = profile?.plan === "pro" || profile?.plan === "business";
  const hasContent = content.trim().length > 0;
  const userName   = session?.user?.email?.split("@")[0] ?? "there";

  // Real stats derived from cached history
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const threatsToday = (history ?? []).filter(h =>
    (h.risk_level === "high" || h.risk_level === "critical") &&
    new Date(h.created_at) >= todayStart
  ).length;
  const protectionScore = history
    ? Math.max(30, Math.min(99, 100 - threatsToday * 8 - Math.floor((usage / Math.max(limit, 1)) * 5)))
    : 98;
  const scoreColor = protectionScore >= 80 ? colors.success : protectionScore >= 55 ? colors.warning : colors.danger;

  useEffect(() => {
    const seq = [
      [headerFade, 0],
      [cardFade,   80],
      [inputFade,  180],
      [btnFade,    280],
    ] as [Animated.Value, number][];
    seq.forEach(([v, delay]) => {
      setTimeout(() => Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: true }).start(), delay);
    });
    Animated.spring(cardY, { toValue: 0, delay: 80, tension: 55, friction: 9, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(btnPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(btnPulse, { toValue: 0.6, duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);

  // Pre-select scan type when arriving from the FAB modal
  useEffect(() => {
    if (paramType && SCAN_TYPES.some(s => s.type === paramType)) {
      setActiveType(paramType as ScanType);
      setContent("");
    }
  }, [paramType]);

  useEffect(() => {
    Animated.timing(borderAnim, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({ inputRange: [0,1], outputRange: [colors.border, cfg.color + "80"] });

  function getInputHint(): string | null {
    const c = content.trim();
    if (activeType === "message" && c.length > 0 && c.length < 10)
      return `Message needs at least 10 characters (${c.length}/10)`;
    if (activeType === "url" && c.length > 0 && !/^https?:\/\//i.test(c) && !c.includes("."))
      return "Enter a full URL or domain (e.g. example.com)";
    if (activeType === "phone" && c.length > 0 && !/^[+\d\s\-()]{6,}$/.test(c))
      return "Enter a valid phone number (e.g. 9876543210)";
    if (activeType === "upi" && c.length > 0 && !c.includes("@") && !c.includes("upi://"))
      return "UPI ID must contain @ (e.g. name@okaxis)";
    return null;
  }

  async function handleScan() {
    if (!hasContent) return Alert.alert("Empty", "Enter something to scan.");
    const hint = getInputHint();
    if (hint) return Alert.alert("Check your input", hint);
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await scanContent(activeType, content.trim());
      setLastResult(result);
      const risk = result.riskLevel ?? result.risk_level;
      if (risk === "high" || risk === "critical") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "⚠️ Threat Detected",
          `Neural Shield flagged this as ${risk.toUpperCase()} risk — scam probability ${Math.round((result.scamProbability ?? 0) * 100)}%. View the full AI analysis for details.`,
          [{ text: "View Analysis", onPress: () => router.push("/result") }],
          { cancelable: false },
        );
      } else {
        if (risk === "safe" || risk === "low") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.push("/result");
      }
    } catch (e: any) {
      const raw = e.response?.data?.message ?? e.message ?? "Scan failed.";
      // Translate common backend validation messages into friendly hints
      const msg = raw.includes("min") || raw.includes("Invalid") || raw.includes("valid")
        ? friendlyError(activeType, raw)
        : raw;
      if (raw.includes("limit") || raw.includes("429")) {
        Alert.alert("Daily limit reached", "Upgrade to Pro for unlimited scans.", [
          { text: "Upgrade", onPress: () => router.push("/(tabs)/profile") },
          { text: "Cancel", style: "cancel" },
        ]);
      } else {
        Alert.alert("Scan failed", msg);
      }
    } finally { setLoading(false); }
  }

  function friendlyError(type: string, raw: string): string {
    if (type === "message") return "Message must be at least 10 characters long.";
    if (type === "url")     return "Enter a valid URL (e.g. https://example.com).";
    if (type === "email")   return "Email content must be at least 5 characters.";
    if (type === "phone")   return "Enter a valid Indian phone number (e.g. 9876543210).";
    if (type === "upi")     return "Enter a valid UPI ID (e.g. name@okaxis or name@paytm).";
    return raw;
  }

  function detectType(text: string): ScanType {
    const t = text.trim();
    if (/^https?:\/\//i.test(t) || /^[\w-]+\.\w{2,}/.test(t)) return "url";
    if (/^upi:\/\//i.test(t) || t.includes("@") && /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(t)) return "upi";
    if (/^[+\d][\d\s\-().]{6,14}$/.test(t)) return "phone";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "email";
    return "message";
  }

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text?.trim()) return Alert.alert("Clipboard empty", "Nothing to paste from clipboard.");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const detected = detectType(text.trim());
      if (detected !== activeType) setActiveType(detected);
      setContent(text.trim());
    } catch {
      Alert.alert("Cannot access clipboard", "Allow clipboard access in your device settings.");
    }
  }

  async function handleImageScan(type: "screenshot" | "qr") {
    if (!isPro) return Alert.alert("Pro Feature", "Upgrade to Pro for this scan type.", [
      { text: "Upgrade", onPress: () => router.push("/(tabs)/profile") },
      { text: "Cancel", style: "cancel" },
    ]);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLoading(true);
    try {
      const r = await scanImage(type, asset.uri, asset.mimeType ?? "image/jpeg");
      setLastResult(r);
      router.push("/result");
    } catch (e: any) { Alert.alert("Scan failed", e.response?.data?.message ?? e.message); }
    finally { setLoading(false); }
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={["rgba(59,130,246,0.05)", colors.bg, colors.bg]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScannerProgress visible={loading} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Greeting ── */}
          <Animated.View style={[s.header, { opacity: headerFade }]}>
            <View>
              <Text style={s.greet}>{greeting()}, {userName.charAt(0).toUpperCase() + userName.slice(1)}</Text>
              <Text style={s.greetSub}>Your AI Protection Status</Text>
            </View>
            <View style={[s.planBadge, { backgroundColor: profile?.plan === "pro" ? colors.accentDim : colors.surface }]}>
              <Text style={[s.planText, { color: profile?.plan === "pro" ? colors.accent : colors.textSub }]}>
                {(profile?.plan ?? "FREE").toUpperCase()}
              </Text>
            </View>
          </Animated.View>

          {/* ── Protection Card ── */}
          <Animated.View style={{ opacity: cardFade, transform: [{ translateY: cardY }] }}>
            <LinearGradient colors={["#1A0B3B", "#120826", "#0D0721"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.protCard}>
              <View style={s.protCardInner}>
                <View style={s.protLeft}>
                  <View style={s.liveRow}>
                    <LiveDot />
                    <Text style={s.liveText}>LIVE · AI Engine Running</Text>
                  </View>
                  <Text style={s.protTitle}>Protected</Text>
                  <Text style={s.protSub}>Neural Shield is active</Text>
                </View>
                <View style={s.shieldWrap}>
                  <View style={s.shieldGlow} />
                  <Shield size={44} color={colors.accent} strokeWidth={1.5} />
                </View>
              </View>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: threatsToday > 0 ? colors.danger : colors.text }]}>{threatsToday}</Text>
                  <Text style={s.statLabel}>Threats Today</Text>
                </View>
                <View style={s.statSep} />
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: scoreColor }]}>{protectionScore}%</Text>
                  <Text style={s.statLabel}>Protection</Text>
                </View>
                <View style={s.statSep} />
                <View style={s.statItem}>
                  <Text style={s.statVal}>{Math.max(0, limit - usage)}</Text>
                  <Text style={s.statLabel}>Scans Left</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Scan Type Grid ── */}
          <Animated.View style={{ opacity: inputFade }}>
            <Text style={s.sectionLabel}>QUICK SCAN</Text>
            <View style={s.typeGrid}>
              {SCAN_TYPES.map((sc) => {
                const c = TYPE_CONFIG[sc.type];
                const active = activeType === sc.type;
                return (
                  <TouchableOpacity
                    key={sc.type}
                    onPress={() => { setActiveType(sc.type); setContent(""); }}
                    style={[s.typeBtn, active && { borderColor: c.color + "60", backgroundColor: c.color + "12" }]}
                    activeOpacity={0.75}
                  >
                    <c.Icon size={20} color={active ? c.color : colors.textSub} strokeWidth={active ? 2 : 1.6} />
                    <Text style={[s.typeLabel, active && { color: c.color }]}>{c.label}</Text>
                    {sc.proOnly && !isPro && <View style={s.proBadge}><Text style={s.proText}>PRO</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Input ── */}
          <Animated.View style={{ opacity: inputFade }}>
            <View style={s.inputCard}>
              <View style={s.inputCardHead}>
                <cfg.Icon size={16} color={cfg.color} strokeWidth={2} />
                <Text style={[s.inputCardTitle, { flex: 1 }]}>{scanConfig.label} Scanner</Text>
                {!["screenshot", "qr"].includes(activeType) && (
                  <TouchableOpacity onPress={handlePaste} style={s.pasteBtn} activeOpacity={0.8}>
                    <Text style={s.pasteBtnText}>📋 Paste</Text>
                  </TouchableOpacity>
                )}
              </View>
              {["screenshot", "qr"].includes(activeType) ? (
                <TouchableOpacity onPress={() => handleImageScan(activeType as any)} style={s.imagePicker} activeOpacity={0.8}>
                  <cfg.Icon size={36} color={cfg.color} strokeWidth={1.4} />
                  <Text style={s.imagePickerLabel}>{activeType === "qr" ? "Scan QR Code" : "Choose Screenshot"}</Text>
                  <Text style={s.imagePickerSub}>Tap to open {activeType === "qr" ? "camera" : "gallery"}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Animated.View style={[s.inputWrap, { borderColor }]}>
                    <TextInput
                      style={s.textInput}
                      value={content}
                      onChangeText={setContent}
                      placeholder={scanConfig.placeholder}
                      placeholderTextColor={colors.textFaint}
                      multiline
                      textAlignVertical="top"
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      keyboardType={activeType === "url" ? "url" : activeType === "phone" ? "phone-pad" : "default"}
                      autoCapitalize={["url", "phone", "upi"].includes(activeType) ? "none" : "sentences"}
                    />
                    {hasContent && (
                      <TouchableOpacity onPress={() => setContent("")} style={s.clearBtn}>
                        <Text style={s.clearText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                  {getInputHint() !== null && (
                    <Text style={s.inputHint}>{getInputHint()}</Text>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {/* ── Scan Button ── */}
          {!["screenshot", "qr"].includes(activeType) && (
            <Animated.View style={{ opacity: btnFade }}>
              {hasContent && (
                <Animated.View style={[s.btnGlow, { opacity: btnPulse }]} />
              )}
              <TouchableOpacity onPress={handleScan} disabled={loading || !hasContent} activeOpacity={0.87} style={[s.scanBtnOuter, !hasContent && s.scanBtnDim]}>
                <LinearGradient colors={hasContent ? ["#C084FC", "#7C3AED"] : [colors.card, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.scanBtn}>
                  <Zap size={18} color={hasContent ? "#fff" : colors.textSub} strokeWidth={2} fill={hasContent ? "#fff" : "none"} />
                  <Text style={[s.scanBtnText, !hasContent && { color: colors.textSub }]}>Scan Now</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Footer Tags ── */}
          <Animated.View style={[s.tagRow, { opacity: btnFade }]}>
            {["11 TI Sources", "AI Engine", "Real-time", "Zero Logs"].map(t => (
              <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 18, paddingBottom: 16 },
  greet:  { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  greetSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  planBadge:{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  planText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },

  protCard:     { borderRadius: 22, borderWidth: 1, borderColor: "rgba(168,85,247,0.22)", marginBottom: 20, overflow: "hidden" },
  protCardInner:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 14 },
  protLeft:     { flex: 1 },
  liveRow:      { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  liveText:     { fontSize: 11, color: colors.success, fontWeight: "700", letterSpacing: 0.5 },
  protTitle:    { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  protSub:      { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  shieldWrap:   { alignItems: "center", justifyContent: "center" },
  shieldGlow:   { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(168,85,247,0.14)" },
  statsRow:     { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4 },
  statItem:     { flex: 1, alignItems: "center" },
  statVal:      { fontSize: 18, fontWeight: "900", color: colors.text },
  statLabel:    { fontSize: 10, color: colors.textSub, marginTop: 2, fontWeight: "600" },
  statSep:      { width: 0.5, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 8 },

  sectionLabel: { fontSize: 10.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 12 },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  typeBtn: {
    width: (W - 40 - 30) / 4, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4,
    borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.2, borderColor: colors.border, gap: 6,
  },
  typeLabel:{ fontSize: 10, color: colors.textSub, fontWeight: "600" },
  proBadge: { position: "absolute", top: 4, right: 4, backgroundColor: colors.accent, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  proText:  { color: "#fff", fontSize: 7, fontWeight: "900" },

  inputCard:     { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  inputCardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  inputCardTitle:{ fontSize: 13.5, fontWeight: "700", color: colors.text },
  inputWrap:     { borderWidth: 1.5, borderRadius: 14, backgroundColor: colors.surface, overflow: "hidden" },
  textInput:     { padding: 14, color: colors.text, fontSize: 14.5, minHeight: 140, lineHeight: 22 },
  clearBtn:      { position: "absolute", top: 10, right: 10 },
  clearText:     { color: colors.textSub, fontSize: 15 },
  inputHint:     { fontSize: 12, color: colors.warning, marginTop: 8, paddingHorizontal: 4 },
  pasteBtn:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pasteBtnText:  { fontSize: 11.5, fontWeight: "700", color: colors.textSub },
  imagePicker:   { alignItems: "center", paddingVertical: 36, gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  imagePickerLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  imagePickerSub:   { fontSize: 12, color: colors.textSub },

  btnGlow: { position: "absolute", bottom: 10, left: "20%", right: "20%", height: 40, borderRadius: 20, backgroundColor: "#A855F7", shadowColor: "#A855F7", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 24, elevation: 20, zIndex: -1 },
  scanBtnOuter: { borderRadius: 16, overflow: "hidden", marginBottom: 18 },
  scanBtnDim:   { opacity: 0.38 },
  scanBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  scanBtnText:  { color: "#fff", fontSize: 17, fontWeight: "800" },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tagText:{ fontSize: 11, color: colors.textDim, fontWeight: "600" },
});

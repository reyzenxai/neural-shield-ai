import { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Share, Animated, Linking,
  BackHandler, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Share2, ShieldCheck, ShieldAlert, Shield, AlertTriangle, CheckCircle, XCircle, Zap, Flag } from "../lib/icons";
import { RiskBadge } from "../components/ui/RiskBadge";
import { ReportModal } from "../components/ui/ReportModal";
import { colors, riskColor, riskGradient } from "../constants/colors";
import { useScanStore } from "../lib/store";
import { submitFeedback } from "../lib/api";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 58, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

function CountUp({ target, color, suffix = "" }: { target: number; color: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 1400;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * ease));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <Text style={[r.ringNum, { color }]}>{val}{suffix}</Text>;
}

interface Recommendation {
  title: string;
  text: string;
  color: string;
  action: string | null;
  actionUrl: string | null;
}

function getRecommendation(prob: number): Recommendation {
  if (prob < 20) return {
    title: "Safe to Proceed",
    text: "This content shows no scam indicators. It appears legitimate and safe to interact with. Our AI found no suspicious patterns, fraudulent links, or known threat signatures.",
    color: colors.success,
    action: null,
    actionUrl: null,
  };
  if (prob < 45) return {
    title: "Exercise Caution",
    text: "Some suspicious patterns were detected. Verify this through official channels before responding, clicking links, or sharing any personal or financial information.",
    color: colors.warning,
    action: "Report to Cybercrime Portal",
    actionUrl: "https://cybercrime.gov.in",
  };
  if (prob < 72) return {
    title: "High Risk — Do Not Respond",
    text: "Strong scam signals detected. Do not share personal details, click links, or make payments. If you've already shared sensitive info, contact your bank immediately.",
    color: "#F97316",
    action: "File Complaint — cybercrime.gov.in",
    actionUrl: "https://cybercrime.gov.in",
  };
  return {
    title: "SCAM DETECTED — Block Now",
    text: "This is almost certainly a scam. Block the sender immediately. Do not engage further. If you've made a payment, call the National Cybercrime Helpline at 1930 right now.",
    color: colors.danger,
    action: "Call 1930 — National Helpline",
    actionUrl: "tel:1930",
  };
}

export default function ResultScreen() {
  const { lastResult } = useScanStore();
  const [feedbackSent,  setFeedbackSent]  = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  // BUG-09: guard against stale/empty result state
  useEffect(() => {
    if (!lastResult) router.replace("/(tabs)/scan");
  }, [lastResult]);

  // BUG-09: Android hardware back — dismiss modal-style screen correctly
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const h = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(tabs)/scan");
      return true;
    });
    return () => h.remove();
  }, []);

  if (!lastResult) return null;

  const prob  = Math.round((lastResult.scamProbability ?? 0) * 100);
  const trust = lastResult.trustScore ?? 0;
  const conf  = Math.round((lastResult.confidence ?? 0) * 100);
  const color = riskColor(lastResult.riskLevel);
  const [g1, g2] = riskGradient(lastResult.riskLevel);
  const rec   = getRecommendation(prob);

  const RiskIcon = prob < 30 ? ShieldCheck : prob < 60 ? ShieldAlert : Shield;

  async function handleFeedback(accurate: boolean) {
    try {
      await submitFeedback(lastResult!.scanId, accurate);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedbackSent(true);
    } catch { Alert.alert("Error", "Could not submit feedback."); }
  }

  async function handleShare() {
    await Share.share({
      message: `Neural Shield AI Result\n\nRisk: ${lastResult!.riskLevel?.toUpperCase()}\nScam Probability: ${prob}%\nTrust Score: ${trust}/100\n\nRecommendation: ${rec.title}\n\n${lastResult!.explanation}`,
      title: "Neural Shield AI Scan Result",
    });
  }

  async function handleAction(url: string) {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch { Alert.alert("Cannot open link", url); }
  }

  return (
    <View style={r.root}>
      <LinearGradient colors={[color + "08", colors.bg, colors.bg]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={r.header}>
          <TouchableOpacity onPress={() => router.back()} style={r.backBtn} activeOpacity={0.75}>
            <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={r.headerTitle}>Scan Result</Text>
          <TouchableOpacity onPress={handleShare} style={r.shareBtn} activeOpacity={0.75}>
            <Share2 size={18} color={colors.textSub} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={r.scroll}>

          {/* ── Circular Risk Meter ── */}
          <Reveal delay={0}>
            <View style={r.meterWrap}>
              <View style={[r.ring, r.ringOuter, { borderColor: color + "14" }]} />
              <View style={[r.ring, r.ringMid,   { borderColor: color + "22" }]} />
              <View style={[r.ringMain, { borderColor: color, shadowColor: color }]}>
                <LinearGradient colors={[color + "18", "transparent"]} style={StyleSheet.absoluteFillObject} />
                <CountUp target={prob} color={color} suffix="%" />
                <Text style={r.ringLabel}>Scam Risk</Text>
              </View>
              <View style={[r.iconBadge, { backgroundColor: color + "18", borderColor: color + "30" }]}>
                <RiskIcon size={18} color={color} strokeWidth={2} />
              </View>
            </View>
            <View style={{ alignItems: "center", marginTop: 16, gap: 8 }}>
              <RiskBadge level={lastResult.riskLevel} size="lg" />
              {lastResult.scamType && (
                <View style={r.scamTypeChip}><Text style={r.scamTypeText}>{lastResult.scamType}</Text></View>
              )}
            </View>
          </Reveal>

          {/* ── Metrics ── */}
          <Reveal delay={100}>
            <View style={r.metricsRow}>
              {[
                { label: "Trust Score",   val: `${trust}`, sub: "/100", c: colors.success },
                { label: "AI Confidence", val: `${conf}%`, sub: "",     c: colors.accent },
                { label: "Signals",       val: String(lastResult.signals?.length ?? 0), sub: "found", c: color },
              ].map(({ label, val, sub, c }) => (
                <View key={label} style={r.metric}>
                  <LinearGradient colors={[c + "12", "transparent"]} style={StyleSheet.absoluteFillObject} />
                  <Text style={[r.metricVal, { color: c }]}>{val}</Text>
                  {sub ? <Text style={r.metricSub}>{sub}</Text> : null}
                  <Text style={r.metricLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          {/* ── AI Analysis ── */}
          {lastResult.explanation && (
            <Reveal delay={180}>
              <View style={r.section}>
                <View style={r.sectionHead}>
                  <Zap size={14} color={colors.accent} strokeWidth={2} fill={colors.accent} />
                  <Text style={r.sectionTitle}>AI ANALYSIS</Text>
                </View>
                <View style={r.card}>
                  <Text style={r.analysisText}>{lastResult.explanation}</Text>
                </View>
              </View>
            </Reveal>
          )}

          {/* ── Recommendation ── */}
          <Reveal delay={220}>
            <View style={r.section}>
              <View style={r.sectionHead}>
                <ShieldCheck size={14} color={rec.color} strokeWidth={2} />
                <Text style={r.sectionTitle}>RECOMMENDATION</Text>
              </View>
              <View style={[r.recCard, { borderColor: rec.color + "35", backgroundColor: rec.color + "09" }]}>
                <Text style={[r.recTitle, { color: rec.color }]}>{rec.title}</Text>
                <Text style={r.recText}>{rec.text}</Text>
                {rec.action && rec.actionUrl && (
                  <TouchableOpacity
                    style={[r.recAction, { backgroundColor: rec.color + "1C", borderColor: rec.color + "40" }]}
                    onPress={() => handleAction(rec.actionUrl!)}
                    activeOpacity={0.8}
                  >
                    <Text style={[r.recActionText, { color: rec.color }]}>{rec.action} →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Reveal>

          {/* ── Warning Signals ── */}
          {lastResult.signals?.length > 0 && (
            <Reveal delay={280}>
              <View style={r.section}>
                <View style={r.sectionHead}>
                  <AlertTriangle size={14} color={color} strokeWidth={2} />
                  <Text style={r.sectionTitle}>WARNING SIGNALS</Text>
                  <View style={[r.countPill, { backgroundColor: color + "18" }]}>
                    <Text style={[r.countText, { color }]}>{lastResult.signals.length}</Text>
                  </View>
                </View>
                <View style={r.card}>
                  {lastResult.signals.map((sig, i) => (
                    <View key={i} style={[r.signalRow, i > 0 && r.signalBorder]}>
                      <LinearGradient colors={[g1, g2]} style={r.signalDot} />
                      <Text style={r.signalText}>{sig}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Reveal>
          )}

          {/* ── Threat Flags ── */}
          {lastResult.flags?.length > 0 && (
            <Reveal delay={340}>
              <View style={r.section}>
                <View style={r.sectionHead}>
                  <XCircle size={14} color={color} strokeWidth={2} />
                  <Text style={r.sectionTitle}>THREAT FLAGS</Text>
                </View>
                <View style={r.flagsWrap}>
                  {lastResult.flags.map((f, i) => (
                    <View key={i} style={[r.flag, { backgroundColor: color + "14", borderColor: color + "30" }]}>
                      <Text style={[r.flagText, { color }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Reveal>
          )}

          {/* ── Feedback ── */}
          <Reveal delay={400}>
            <View style={r.section}>
              <View style={r.sectionHead}>
                <CheckCircle size={14} color={colors.textSub} strokeWidth={2} />
                <Text style={r.sectionTitle}>WAS THIS ACCURATE?</Text>
              </View>
              {feedbackSent ? (
                <View style={r.feedbackDone}><Text style={r.feedbackDoneText}>✓  Thanks for your feedback</Text></View>
              ) : (
                <View style={r.feedbackRow}>
                  {[{ label: "👍  Yes", val: true }, { label: "👎  No", val: false }].map(({ label, val }) => (
                    <TouchableOpacity key={String(val)} onPress={() => handleFeedback(val)} style={r.feedbackBtn} activeOpacity={0.8}>
                      <Text style={r.feedbackBtnText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </Reveal>

          {/* ── Report & Scan Again ── */}
          <Reveal delay={460}>
            <View style={r.bottomRow}>
              <TouchableOpacity onPress={() => router.back()} style={[r.scanAgain, { flex: 1 }]} activeOpacity={0.85}>
                <Text style={r.scanAgainText}>← Scan Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReportVisible(true)}
                style={r.reportBtn}
                activeOpacity={0.85}
              >
                <Flag size={15} color="#EF4444" />
                <Text style={r.reportBtnText}>Report</Text>
              </TouchableOpacity>
            </View>
          </Reveal>
        </ScrollView>
      </SafeAreaView>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        scanType={lastResult?.scanType ?? lastResult?.scamType ?? "unknown"}
        scannedContent={lastResult?.explanation ?? ""}
        riskLevel={lastResult?.riskLevel ?? "unknown"}
      />
    </View>
  );
}

const r = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 52 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:  { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  shareBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.text },

  meterWrap:{ alignItems: "center", justifyContent: "center", marginVertical: 24, height: 220 },
  ring:     { position: "absolute", borderRadius: 999, borderWidth: 1 },
  ringOuter:{ width: 200, height: 200 },
  ringMid:  { width: 170, height: 170 },
  ringMain: {
    width: 148, height: 148, borderRadius: 74, borderWidth: 3,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  ringNum:   { fontSize: 38, fontWeight: "900", letterSpacing: -1 },
  ringLabel: { fontSize: 11, color: colors.textSub, fontWeight: "600", marginTop: 2 },
  iconBadge: { position: "absolute", bottom: 42, right: "28%", width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  scamTypeChip: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  scamTypeText: { color: colors.textSub, fontSize: 12, fontStyle: "italic" },

  metricsRow:{ flexDirection: "row", gap: 10, marginBottom: 18 },
  metric: { flex: 1, alignItems: "center", paddingVertical: 14, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden", gap: 2 },
  metricVal:  { fontSize: 20, fontWeight: "900" },
  metricSub:  { fontSize: 10, color: colors.textDim },
  metricLabel:{ fontSize: 10, color: colors.textSub, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },

  section:    { marginBottom: 16 },
  sectionHead:{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  sectionTitle:{ fontSize: 10.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, flex: 1 },
  countPill:  { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  countText:  { fontSize: 10, fontWeight: "900" },

  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 },
  analysisText: { color: colors.text, fontSize: 14, lineHeight: 24 },

  recCard:    { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  recTitle:   { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  recText:    { fontSize: 13.5, color: colors.textSub, lineHeight: 22 },
  recAction:  { borderRadius: 12, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 16, alignSelf: "flex-start", marginTop: 4 },
  recActionText: { fontSize: 13, fontWeight: "700" },

  signalRow:   { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  signalBorder:{ borderTopWidth: 0.5, borderTopColor: colors.border },
  signalDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 9, flexShrink: 0 },
  signalText:  { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 22 },

  flagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flag:      { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  flagText:  { fontSize: 12.5, fontWeight: "700" },

  feedbackRow: { flexDirection: "row", gap: 10 },
  feedbackBtn: { flex: 1, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  feedbackBtnText: { fontSize: 14.5, color: colors.text, fontWeight: "600" },
  feedbackDone: { backgroundColor: colors.successDim, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.success + "30" },
  feedbackDoneText: { color: colors.success, fontSize: 14, fontWeight: "700" },

  bottomRow:    { flexDirection: "row", gap: 10 },
  scanAgain:    { paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card },
  scanAgainText:{ color: colors.accent, fontSize: 15, fontWeight: "700" },
  reportBtn:    { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 15, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(239,68,68,0.35)", borderRadius: 16, backgroundColor: "rgba(239,68,68,0.08)" },
  reportBtnText:{ color: "#EF4444", fontSize: 14, fontWeight: "700" },
});

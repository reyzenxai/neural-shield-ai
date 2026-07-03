import { useRef, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  Shield, MessageSquare, Link2, Mail, Phone, CreditCard,
  AlertTriangle, CheckCircle, Clock, TrendingUp, Wifi, Bell,
} from "../../lib/icons";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { colors, riskColor } from "../../constants/colors";
import { getProfile, getScanHistory } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import type { ScanHistoryItem } from "../../constants/types";

const { width: W } = Dimensions.get("window");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PROTECT_KEY    = "ns_realtime_protection";
const PERMISSIONS_KEY = "ns_permissions_granted_v1";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function buildWeeklyData(history: ScanHistoryItem[] | undefined) {
  if (!history) return Array(7).fill({ label: "", scans: 0, threats: 0 });
  const counts  = new Array(7).fill(0);
  const threats = new Array(7).fill(0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  history.forEach(item => {
    const d = new Date(item.created_at);
    if (d.getTime() >= weekAgo) {
      const idx = d.getDay();
      counts[idx]++;
      if (item.risk_level === "high" || item.risk_level === "critical") threats[idx]++;
    }
  });
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const idx = (today - 6 + i + 7) % 7;
    return { label: i === 6 ? "Today" : DAYS[idx], scans: counts[idx], threats: threats[idx] };
  });
}

function computeSecurityScore(
  history: ScanHistoryItem[] | undefined,
  used: number,
  limit: number,
): number {
  if (!history) return 75;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let deduction = 0;
  history.forEach(item => {
    if (new Date(item.created_at).getTime() >= weekAgo) {
      if (item.risk_level === "high" || item.risk_level === "critical") deduction += 8;
      else if (item.risk_level === "medium") deduction += 3;
    }
  });
  // Usage pressure: using all daily scans adds slight deduction
  if (limit > 0) deduction += Math.floor((used / limit) * 8);
  return Math.min(100, Math.max(0, 100 - deduction));
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Protected";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "At Risk";
  return "Critical";
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return "#F59E0B";
  if (score >= 40) return "#F97316";
  return colors.danger;
}

// ── Shared sub-components at module scope (avoid keyboard-dismiss bug) ────────

function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
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

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

function SkeletonBar({ w }: { w: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w, height: 36, borderRadius: 6, backgroundColor: colors.surface, opacity: anim }} />;
}

function CountUp({ target, color, suffix = "" }: { target: number; color: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 1200;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * ease));
      if (t >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <Text style={[h.meterNum, { color }]}>{val}{suffix}</Text>;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { session } = useAuthStore();
  const { data: profile } = useQuery({ queryKey: ["profile"],    queryFn: getProfile });
  const { data: history } = useQuery({ queryKey: ["history", 0], queryFn: () => getScanHistory(0, 50) });
  const [protectionOn, setProtectionOn] = useState(true);

  const email    = session?.user?.email ?? "";
  const userName = profile?.name ?? email.split("@")[0] ?? "there";
  const name     = userName.charAt(0).toUpperCase() + userName.slice(1);
  const plan     = profile?.plan ?? "free";
  const used     = profile?.daily_scans_used ?? 0;
  const limit    = profile?.daily_scan_limit ?? 5;

  const weekData      = buildWeeklyData(history);
  const maxBar        = Math.max(...weekData.map(d => d.scans), 1);
  const totalScans    = profile?.total_scans ?? 0;
  const totalThreats  = history?.filter(h => h.risk_level === "high" || h.risk_level === "critical").length ?? 0;
  const createdAt     = profile?.created_at;
  const daysProtected = createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
    : 1;
  const recent   = history?.slice(0, 5) ?? [];
  const threats  = history?.filter(i =>
    i.risk_level === "high" || i.risk_level === "critical" || i.risk_level === "medium"
  ).slice(0, 8) ?? [];

  const score = computeSecurityScore(history, used, limit);
  const sColor = scoreColor(score);

  // UI-05: load protection toggle state from AsyncStorage
  useEffect(() => {
    async function loadState() {
      const v    = await AsyncStorage.getItem(PROTECT_KEY);
      const perm = await AsyncStorage.getItem(PERMISSIONS_KEY);
      if (v !== null) setProtectionOn(v === "true");
      // Auto-enable protection once permissions flow is completed
      if (perm === "true" && v === null) {
        setProtectionOn(true);
        AsyncStorage.setItem(PROTECT_KEY, "true");
      }
    }
    loadState();
  }, []);

  async function toggleProtection(val: boolean) {
    if (val) {
      // Check if permissions have been set up
      const permState = await AsyncStorage.getItem(PERMISSIONS_KEY);
      if (!permState) {
        // Navigate to permissions setup before enabling
        router.push("/permissions-setup" as any);
        return;
      }
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProtectionOn(val);
    AsyncStorage.setItem(PROTECT_KEY, String(val));
  }

  function scanTypeIcon(type: string): React.ReactNode {
    const map: Record<string, typeof MessageSquare> = {
      message: MessageSquare, url: Link2, email: Mail,
      phone: Phone, upi: CreditCard,
    };
    const Icon = map[type] ?? Shield;
    const color = { message: "#3B82F6", url: "#7C3AED", email: "#06B6D4", phone: "#F59E0B", upi: "#22C55E" }[type] ?? colors.accent;
    return <Icon size={16} color={color} strokeWidth={1.8} />;
  }

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  async function handleSeeAll() {
    await Haptics.selectionAsync();
    router.navigate("/(tabs)/history");
  }

  return (
    <View style={h.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.06)", colors.bg, colors.bg]}
        locations={[0, 0.25, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={h.scroll}>

          {/* ── Header ── */}
          <Reveal delay={0}>
            <View style={h.header}>
              <View>
                <Text style={h.greet}>{greeting()}, {name}</Text>
                <View style={h.liveRow}>
                  <LiveDot />
                  <Text style={h.liveText}>AI Engine Active</Text>
                </View>
              </View>
              <View style={[h.planBadge, plan !== "free" && { backgroundColor: colors.accentDim, borderColor: colors.accent + "40" }]}>
                <Text style={[h.planText, plan !== "free" && { color: colors.accent }]}>{plan.toUpperCase()}</Text>
              </View>
            </View>
          </Reveal>

          {/* ── UI-01: Security Score Meter ── */}
          <Reveal delay={60}>
            <View style={h.meterCard}>
              <LinearGradient colors={["#1A0B3B", "#120826", "#0D0721"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
              <View style={h.meterInner}>
                {/* Animated concentric ring meter */}
                <View style={h.meterWrap}>
                  <View style={[h.ring, h.ringOuter, { borderColor: sColor + "14" }]} />
                  <View style={[h.ring, h.ringMid,   { borderColor: sColor + "28" }]} />
                  <View style={[h.ringMain, { borderColor: sColor, shadowColor: sColor }]}>
                    <LinearGradient colors={[sColor + "18", "transparent"]} style={StyleSheet.absoluteFillObject} />
                    <CountUp target={score} color={sColor} />
                    <Text style={h.meterLabel}>Security Score</Text>
                  </View>
                  <View style={[h.scoreBadge, { backgroundColor: sColor + "18", borderColor: sColor + "30" }]}>
                    <Shield size={14} color={sColor} strokeWidth={2} />
                  </View>
                </View>

                {/* Right side stats */}
                <View style={h.meterStats}>
                  <View style={h.meterStatusRow}>
                    <Text style={[h.meterStatus, { color: sColor }]}>{scoreLabel(score)}</Text>
                  </View>
                  <Text style={h.meterSub}>Neural Shield is {protectionOn ? "active" : "paused"}</Text>
                  <View style={h.meterStatsGrid}>
                    {[
                      { val: String(used),                   label: "Today",        color: colors.text },
                      { val: `${Math.max(0, limit - used)}`, label: "Remaining",    color: colors.success },
                      { val: `${daysProtected}d`,            label: "Protected",    color: colors.accent },
                    ].map(({ val, label, color }) => (
                      <View key={label} style={h.meterStat}>
                        <Text style={[h.meterStatVal, { color }]}>{val}</Text>
                        <Text style={h.meterStatLabel}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </Reveal>

          {/* ── UI-05: Real-time Protection Toggle ── */}
          <Reveal delay={100}>
            <View style={h.toggleCard}>
              <View style={h.toggleLeft}>
                <View style={[h.toggleIcon, { backgroundColor: protectionOn ? colors.success + "18" : colors.surface }]}>
                  <Wifi size={18} color={protectionOn ? colors.success : colors.textSub} strokeWidth={1.8} />
                </View>
                <View>
                  <Text style={h.toggleTitle}>Real-time Protection</Text>
                  <Text style={h.toggleSub}>{protectionOn ? "All content is being monitored" : "Protection is paused"}</Text>
                </View>
              </View>
              <Switch
                value={protectionOn}
                onValueChange={toggleProtection}
                trackColor={{ false: colors.surface, true: colors.success + "60" }}
                thumbColor={protectionOn ? colors.success : colors.textSub}
                ios_backgroundColor={colors.surface}
              />
            </View>
          </Reveal>

          {/* ── All-time Stats ── */}
          <Reveal delay={140}>
            <View style={h.statsCards}>
              <View style={[h.statCard, { borderColor: colors.accent + "20" }]}>
                <LinearGradient colors={[colors.accent + "0E", "transparent"]} style={StyleSheet.absoluteFillObject} />
                <TrendingUp size={18} color={colors.accent} strokeWidth={1.8} />
                <Text style={h.statCardVal}>{totalScans}</Text>
                <Text style={h.statCardLabel}>Total Scans</Text>
              </View>
              <View style={[h.statCard, { borderColor: "#EF444420" }]}>
                <LinearGradient colors={["#EF44440E", "transparent"]} style={StyleSheet.absoluteFillObject} />
                <AlertTriangle size={18} color="#EF4444" strokeWidth={1.8} />
                <Text style={[h.statCardVal, { color: "#EF4444" }]}>{totalThreats}</Text>
                <Text style={h.statCardLabel}>Threats Caught</Text>
              </View>
              <View style={[h.statCard, { borderColor: "#22C55E20" }]}>
                <LinearGradient colors={["#22C55E0E", "transparent"]} style={StyleSheet.absoluteFillObject} />
                <CheckCircle size={18} color="#22C55E" strokeWidth={1.8} />
                <Text style={[h.statCardVal, { color: "#22C55E" }]}>{totalScans - totalThreats}</Text>
                <Text style={h.statCardLabel}>Verified Safe</Text>
              </View>
            </View>
          </Reveal>

          {/* ── UI-02: Latest Threats Carousel ── */}
          {threats.length > 0 && (
            <Reveal delay={170}>
              <View style={h.recentHead}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Bell size={12} color={colors.danger} strokeWidth={2} />
                  <Text style={h.sectionLabel}>LATEST THREATS</Text>
                </View>
                <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.75}>
                  <Text style={h.seeAll}>See all →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingRight: 4 }}
                style={{ marginBottom: 22, marginHorizontal: -4 }}
              >
                {threats.map(item => {
                  const c = riskColor(item.risk_level);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[h.threatCard, { borderColor: c + "35" }]}
                      activeOpacity={0.8}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        router.navigate("/(tabs)/history");
                      }}
                    >
                      <LinearGradient colors={[c + "10", "transparent"]} style={StyleSheet.absoluteFillObject} />
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <RiskBadge level={item.risk_level} size="sm" />
                        <View style={[h.threatTypeIcon, { backgroundColor: c + "15" }]}>
                          {scanTypeIcon(item.scan_type)}
                        </View>
                      </View>
                      <Text style={h.threatContent} numberOfLines={2}>
                        {item.content_preview || item.scan_type}
                      </Text>
                      <View style={h.recentMeta}>
                        <Clock size={10} color={colors.textFaint} />
                        <Text style={h.recentTime}>{timeAgo(item.created_at)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Reveal>
          )}

          {/* ── Weekly Activity ── */}
          <Reveal delay={200}>
            <View style={h.chartCard}>
              <LinearGradient colors={["rgba(59,130,246,0.04)", "transparent"]} style={StyleSheet.absoluteFillObject} />
              <View style={h.chartHead}>
                <Text style={h.sectionLabel}>WEEKLY ACTIVITY</Text>
                <Text style={h.chartTotal}>{weekData.reduce((a, d) => a + d.scans, 0)} scans this week</Text>
              </View>
              <View style={h.bars}>
                {weekData.map((d, i) => {
                  const barH = maxBar > 0 ? Math.max(4, (d.scans / maxBar) * 56) : 4;
                  const isToday = i === 6;
                  return (
                    <View key={i} style={h.barCol}>
                      <View style={h.barTrack}>
                        <View style={[
                          h.bar,
                          { height: barH, backgroundColor: d.threats > 0 ? "#EF4444" : isToday ? colors.accent : colors.accent + "55" },
                        ]} />
                      </View>
                      <Text style={[h.barLabel, isToday && { color: colors.accent, fontWeight: "700" }]}>
                        {d.label.slice(0, 3)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={h.legend}>
                <View style={h.legendItem}><View style={[h.legendDot, { backgroundColor: colors.accent }]} /><Text style={h.legendText}>Scans</Text></View>
                <View style={h.legendItem}><View style={[h.legendDot, { backgroundColor: "#EF4444" }]} /><Text style={h.legendText}>Threats</Text></View>
              </View>
            </View>
          </Reveal>

          {/* ── Recent Scans ── */}
          <Reveal delay={240}>
            <View style={h.recentHead}>
              <Text style={h.sectionLabel}>RECENT SCANS</Text>
              <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.75}>
                <Text style={h.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>

            {history === undefined ? (
              <View style={{ gap: 10 }}>
                {[140, 130, 145].map(w => <SkeletonBar key={w} w={w} />)}
              </View>
            ) : recent.length === 0 ? (
              <View style={h.emptyBox}>
                <Shield size={28} color={colors.textFaint} strokeWidth={1.4} />
                <Text style={h.emptyText}>No scans yet — tap SCAN to start</Text>
              </View>
            ) : (
              recent.map((item, i) => {
                const c = riskColor(item.risk_level);
                return (
                  <View key={item.id} style={[h.recentCard, i > 0 && { marginTop: 8 }]}>
                    <View style={[h.recentIconWrap, { backgroundColor: c + "14" }]}>
                      {scanTypeIcon(item.scan_type)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={h.recentContent} numberOfLines={1}>
                        {item.content_preview || item.scan_type}
                      </Text>
                      <View style={h.recentMeta}>
                        <Clock size={11} color={colors.textFaint} />
                        <Text style={h.recentTime}>{timeAgo(item.created_at)}</Text>
                      </View>
                    </View>
                    <RiskBadge level={item.risk_level} size="sm" />
                  </View>
                );
              })
            )}
          </Reveal>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const h = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 18, paddingBottom: 16 },
  greet:    { fontSize: 21, fontWeight: "900", color: colors.text, letterSpacing: -0.5, marginBottom: 5 },
  liveRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  liveText: { fontSize: 11, color: colors.success, fontWeight: "700", letterSpacing: 0.3 },
  planBadge:{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  planText: { fontSize: 10, fontWeight: "900", color: colors.textSub, letterSpacing: 0.8 },

  // UI-01: Security score card
  meterCard:  { borderRadius: 22, borderWidth: 1, borderColor: "rgba(168,85,247,0.22)", marginBottom: 16, overflow: "hidden" },
  meterInner: { flexDirection: "row", alignItems: "center", padding: 20, gap: 18 },
  meterWrap:  { alignItems: "center", justifyContent: "center", width: 140, height: 140 },
  ring:       { position: "absolute", borderRadius: 999, borderWidth: 1 },
  ringOuter:  { width: 130, height: 130 },
  ringMid:    { width: 108, height: 108 },
  ringMain:   {
    width: 90, height: 90, borderRadius: 45, borderWidth: 3,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  meterNum:    { fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  meterLabel:  { fontSize: 9, color: colors.textSub, fontWeight: "700", marginTop: 1 },
  scoreBadge:  { position: "absolute", bottom: 12, right: 12, width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  meterStats:  { flex: 1, gap: 6 },
  meterStatusRow: { flexDirection: "row", alignItems: "center" },
  meterStatus: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  meterSub:    { fontSize: 11, color: colors.textSub, marginBottom: 8 },
  meterStatsGrid: { flexDirection: "row", gap: 12 },
  meterStat:      { alignItems: "center" },
  meterStatVal:   { fontSize: 15, fontWeight: "900", color: colors.text },
  meterStatLabel: { fontSize: 9, color: colors.textSub, fontWeight: "600", marginTop: 2 },

  // UI-05: Protection toggle
  toggleCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 16,
  },
  toggleLeft:  { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  toggleIcon:  { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  toggleSub:   { fontSize: 11.5, color: colors.textSub, marginTop: 2 },

  statsCards:  { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard:    { flex: 1, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 6, overflow: "hidden" },
  statCardVal: { fontSize: 22, fontWeight: "900", color: colors.text },
  statCardLabel:{ fontSize: 10, color: colors.textSub, fontWeight: "600" },

  sectionLabel: { fontSize: 10.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 0 },

  // UI-02: Threat carousel
  threatCard: {
    width: W * 0.56, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1,
    padding: 14, overflow: "hidden",
  },
  threatTypeIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  threatContent:  { fontSize: 12.5, color: colors.text, fontWeight: "600", lineHeight: 18, marginBottom: 8, flex: 1 },

  chartCard: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 22, overflow: "hidden" },
  chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  chartTotal:{ fontSize: 12, color: colors.textSub, fontWeight: "600" },
  bars:      { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 72 },
  barCol:    { flex: 1, alignItems: "center", gap: 6 },
  barTrack:  { flex: 1, justifyContent: "flex-end", width: "100%" },
  bar:       { width: "100%", borderRadius: 5, minHeight: 4 },
  barLabel:  { fontSize: 9, color: colors.textFaint, fontWeight: "600" },
  legend:    { flexDirection: "row", gap: 16, marginTop: 14 },
  legendItem:{ flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText:{ fontSize: 11, color: colors.textSub, fontWeight: "600" },

  recentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  seeAll:     { fontSize: 12, color: colors.accent, fontWeight: "700" },

  recentCard:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 },
  recentIconWrap:{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  recentContent: { fontSize: 13.5, fontWeight: "600", color: colors.text, marginBottom: 4 },
  recentMeta:    { flexDirection: "row", alignItems: "center", gap: 4 },
  recentTime:    { fontSize: 11, color: colors.textFaint, fontWeight: "500" },

  emptyBox:  { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: 10, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 13, color: colors.textFaint, fontWeight: "500" },
});

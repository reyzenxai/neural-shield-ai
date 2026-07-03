import { useRef, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Animated, ScrollView, TextInput, Modal, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  MessageSquare, Phone, Link2, Mail, CreditCard, QrCode, ImageIcon,
  Search, ShieldCheck, Shield, X, Clock, AlertTriangle, CheckCircle,
  Zap, XCircle,
} from "../../lib/icons";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { colors, riskColor, riskGradient } from "../../constants/colors";
import { getScanHistory } from "../../lib/api";
import type { ScanHistoryItem, ScanType } from "../../constants/types";

const ICONS: Record<ScanType, any> = {
  message: MessageSquare, url: Link2, email: Mail,
  phone: Phone, upi: CreditCard, screenshot: ImageIcon, qr: QrCode,
};

const DATE_FILTERS = ["All", "Today", "Yesterday", "This Week"] as const;
type DateFilter = typeof DATE_FILTERS[number];

const RISK_FILTERS = ["All", "Threats", "Medium", "Safe"] as const;
type RiskFilter = typeof RISK_FILTERS[number];

// ── Pure helpers (no React) ───────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function matchesDate(iso: string, filter: DateFilter) {
  const now = Date.now();
  const ts  = new Date(iso).getTime();
  const day = 86_400_000;
  if (filter === "All")       return true;
  if (filter === "Today")     return now - ts < day;
  if (filter === "Yesterday") return now - ts >= day && now - ts < 2 * day;
  if (filter === "This Week") return now - ts < 7 * day;
  return true;
}

function matchesRisk(level: string | undefined, filter: RiskFilter) {
  if (filter === "All") return true;
  const l = level?.toLowerCase() ?? "";
  if (filter === "Threats") return l === "high" || l === "critical";
  if (filter === "Medium")  return l === "medium";
  if (filter === "Safe")    return l === "safe" || l === "low";
  return true;
}

// ── Sub-components at module scope ────────────────────────────────────────────

function HistoryCard({
  item, index, onPress,
}: {
  item: ScanHistoryItem;
  index: number;
  onPress: () => void;
}) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(14)).current;
  const Icon  = ICONS[item.scan_type] ?? Shield;
  const color = riskColor(item.risk_level);
  const prob  = Math.round((item.scam_probability ?? 0) * 100);

  useEffect(() => {
    const delay = Math.min(index * 40, 200);
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  async function handlePress() {
    await Haptics.selectionAsync();
    onPress();
  }

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <TouchableOpacity style={s.card} activeOpacity={0.78} onPress={handlePress}>
        <LinearGradient colors={[color + "18", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 0.4, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
        <View style={[s.accentBar, { backgroundColor: color }]} />
        <View style={[s.iconWrap, { backgroundColor: color + "14" }]}>
          <Icon size={18} color={color} strokeWidth={1.8} />
        </View>
        <View style={s.body}>
          <Text style={s.preview} numberOfLines={1}>{item.content_preview || item.scan_type}</Text>
          <View style={s.meta}>
            <Text style={s.time}>{timeAgo(item.created_at)}</Text>
            <Text style={s.sep}> · </Text>
            <Text style={s.type}>{item.scan_type}</Text>
          </View>
        </View>
        <View style={s.right}>
          <Text style={[s.prob, { color }]}>{prob}%</Text>
          <RiskBadge level={item.risk_level} size="sm" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SkeletonCard({ i }: { i: number }) {
  const shimmer = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.65, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3,  duration: 800, useNativeDriver: true }),
      ])).start();
    }, i * 80);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View style={[s.card, { opacity: shimmer }]}>
      <View style={[s.accentBar, { backgroundColor: colors.border }]} />
      <View style={[s.iconWrap, { backgroundColor: colors.surface }]} />
      <View style={s.body}>
        <View style={{ height: 13, width: "55%", backgroundColor: colors.surface, borderRadius: 6, marginBottom: 6 }} />
        <View style={{ height: 10, width: "35%", backgroundColor: colors.surface, borderRadius: 6 }} />
      </View>
      <View style={{ width: 44, height: 32, backgroundColor: colors.surface, borderRadius: 10 }} />
    </Animated.View>
  );
}

function Empty({ hasFilter }: { hasFilter: boolean }) {
  const pulse = useRef(new Animated.Value(0.9)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.9,  duration: 1800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[s.empty, { opacity: fade }]}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <ShieldCheck size={64} color={colors.accent + "60"} strokeWidth={1.2} />
      </Animated.View>
      <Text style={s.emptyTitle}>{hasFilter ? "No matches" : "No scans yet"}</Text>
      <Text style={s.emptySub}>
        {hasFilter
          ? "Try clearing the filter or search term."
          : "Scan messages, URLs, emails and more — your history will appear here."}
      </Text>
    </Animated.View>
  );
}

function DetailModal({ item, onClose }: { item: ScanHistoryItem; onClose: () => void }) {
  const slide = useRef(new Animated.Value(400)).current;
  const color = riskColor(item.risk_level);
  const [g1, g2] = riskGradient(item.risk_level);
  const prob = Math.round((item.scam_probability ?? 0) * 100);
  const conf = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const Icon = ICONS[item.scan_type] ?? Shield;

  useEffect(() => {
    Animated.spring(slide, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }).start();
  }, []);

  function handleClose() {
    Animated.timing(slide, { toValue: 400, duration: 220, useNativeDriver: true }).start(onClose);
  }

  return (
    <Modal transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose}>
        <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Handle */}
            <View style={s.handle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <View style={[s.sheetIcon, { backgroundColor: color + "18" }]}>
                <Icon size={22} color={color} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetType}>{item.scan_type.toUpperCase()}</Text>
                <Text style={s.sheetTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.75}>
                <X size={16} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
              {/* Score ring */}
              <View style={s.sheetRing}>
                <View style={[s.ringOuter2, { borderColor: color + "20" }]} />
                <View style={[s.ringInner2, { borderColor: color, shadowColor: color }]}>
                  <LinearGradient colors={[color + "18", "transparent"]} style={StyleSheet.absoluteFillObject} />
                  <Text style={[s.ringNum2, { color }]}>{prob}%</Text>
                  <Text style={s.ringLabel2}>Scam Risk</Text>
                </View>
              </View>

              <View style={{ alignItems: "center", marginBottom: 16 }}>
                <RiskBadge level={item.risk_level} size="lg" />
                {!!item.scam_type && (
                  <View style={s.scamTypeChip}>
                    <Text style={s.scamTypeText}>{item.scam_type}</Text>
                  </View>
                )}
              </View>

              {/* Content preview */}
              <View style={[s.sheetPreview, { borderColor: color + "25" }]}>
                <Text style={s.sheetPreviewLabel}>SCANNED CONTENT</Text>
                <Text style={s.sheetPreviewText}>{item.content_preview || "—"}</Text>
              </View>

              {/* Meta chips */}
              <View style={s.sheetMetaRow}>
                {[
                  { label: "Risk Level",        val: (item.risk_level ?? "Unknown").toUpperCase(), c: color },
                  { label: "Scam Probability",   val: `${prob}%`, c: prob > 60 ? colors.danger : prob > 30 ? colors.warning : colors.success },
                  conf !== null
                    ? { label: "AI Confidence",  val: `${conf}%`, c: colors.accent }
                    : { label: "Scan Type",       val: item.scan_type.toUpperCase(), c: colors.accent },
                ].map(({ label, val, c }) => (
                  <View key={label} style={[s.metaChip, { borderColor: c + "30", backgroundColor: c + "0C" }]}>
                    <Text style={[s.metaChipVal, { color: c }]}>{val}</Text>
                    <Text style={s.metaChipLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* AI Analysis */}
              {!!item.explanation && (
                <View style={s.detailSection}>
                  <View style={s.detailSectionHead}>
                    <Zap size={13} color={colors.accent} strokeWidth={2} />
                    <Text style={s.detailSectionTitle}>AI ANALYSIS</Text>
                  </View>
                  <View style={s.detailCard}>
                    <Text style={s.detailAnalysisText}>{item.explanation}</Text>
                  </View>
                </View>
              )}

              {/* Warning Signals */}
              {!!item.signals?.length && (
                <View style={s.detailSection}>
                  <View style={s.detailSectionHead}>
                    <AlertTriangle size={13} color={color} strokeWidth={2} />
                    <Text style={s.detailSectionTitle}>WARNING SIGNALS</Text>
                    <View style={[s.countPill, { backgroundColor: color + "18" }]}>
                      <Text style={[s.countPillText, { color }]}>{item.signals.length}</Text>
                    </View>
                  </View>
                  <View style={s.detailCard}>
                    {item.signals.map((sig, i) => (
                      <View key={i} style={[s.signalRow, i > 0 && s.signalBorder]}>
                        <LinearGradient colors={[g1, g2]} style={s.signalDot} />
                        <Text style={s.signalText}>{sig}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Threat Flags */}
              {!!item.flags?.length && (
                <View style={s.detailSection}>
                  <View style={s.detailSectionHead}>
                    <XCircle size={13} color={color} strokeWidth={2} />
                    <Text style={s.detailSectionTitle}>THREAT FLAGS</Text>
                  </View>
                  <View style={s.flagsWrap}>
                    {item.flags.map((f, i) => (
                      <View key={i} style={[s.flagChip, { backgroundColor: color + "14", borderColor: color + "30" }]}>
                        <Text style={[s.flagChipText, { color }]}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [dateFilter,  setDateFilter]  = useState<DateFilter>("All");
  const [riskFilter,  setRiskFilter]  = useState<RiskFilter>("All");
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected,    setSelected]    = useState<ScanHistoryItem | null>(null);
  const searchRef   = useRef<TextInput>(null);
  const searchAnim  = useRef(new Animated.Value(0)).current;
  const searchHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });

  const { data, isLoading, refetch } = useQuery({ queryKey: ["history"], queryFn: () => getScanHistory() });

  async function toggleSearch() {
    await Haptics.selectionAsync();
    if (showSearch) {
      Animated.timing(searchAnim, { toValue: 0, duration: 220, useNativeDriver: false }).start(() => {
        setShowSearch(false);
        setSearchQuery("");
      });
    } else {
      setShowSearch(true);
      Animated.timing(searchAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start(() => {
        searchRef.current?.focus();
      });
    }
  }

  async function handleDateFilter(f: DateFilter) {
    await Haptics.selectionAsync();
    setDateFilter(f);
  }

  async function handleRiskFilter(f: RiskFilter) {
    await Haptics.selectionAsync();
    setRiskFilter(f);
  }

  const filtered = (data ?? []).filter(item => {
    if (!matchesDate(item.created_at, dateFilter)) return false;
    if (!matchesRisk(item.risk_level, riskFilter))  return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (item.content_preview ?? item.scan_type).toLowerCase().includes(q);
    }
    return true;
  });

  const total     = data?.length ?? 0;
  const threats   = data?.filter(i => i.risk_level === "high" || i.risk_level === "critical").length ?? 0;
  const medium    = data?.filter(i => i.risk_level === "medium").length ?? 0;
  const safe      = data?.filter(i => i.risk_level === "safe"   || i.risk_level === "low").length ?? 0;
  const hasFilter = dateFilter !== "All" || riskFilter !== "All" || searchQuery.trim().length > 0;

  return (
    <View style={s.root}>
      <LinearGradient colors={["rgba(59,130,246,0.04)", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.3 }} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Scan History</Text>
            {data && <Text style={s.sub}>{total} total scan{total !== 1 ? "s" : ""}</Text>}
          </View>
          <TouchableOpacity onPress={toggleSearch} style={[s.searchBtn, showSearch && { borderColor: colors.accent + "50", backgroundColor: colors.accentDim }]} activeOpacity={0.75}>
            {showSearch
              ? <X size={15} color={colors.accent} strokeWidth={2} />
              : <Search size={15} color={colors.textSub} strokeWidth={1.8} />}
          </TouchableOpacity>
        </View>

        {/* Animated search input */}
        <Animated.View style={[s.searchWrap, { height: searchHeight, overflow: "hidden" }]}>
          <View style={s.searchInputWrap}>
            <Search size={14} color={colors.textSub} strokeWidth={1.8} />
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search scans…"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color={colors.textSub} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Threat summary bar */}
        {!isLoading && total > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.summaryScroll} contentContainerStyle={s.summaryContent}>
            {[
              { val: threats, label: "Threats",   color: colors.danger,   onPress: () => handleRiskFilter(riskFilter === "Threats" ? "All" : "Threats") },
              { val: medium,  label: "Medium",    color: colors.warning,  onPress: () => handleRiskFilter(riskFilter === "Medium"  ? "All" : "Medium") },
              { val: safe,    label: "Safe",      color: colors.success,  onPress: () => handleRiskFilter(riskFilter === "Safe"    ? "All" : "Safe") },
              { val: total,   label: "Total",     color: colors.accent,   onPress: () => handleRiskFilter("All") },
            ].map(({ val, label, color, onPress }) => (
              <TouchableOpacity key={label} onPress={onPress} style={[s.summaryChip, { borderColor: color + "35", backgroundColor: color + "0D" }]} activeOpacity={0.8}>
                <Text style={[s.summaryVal, { color }]}>{val}</Text>
                <Text style={s.summaryLabel}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Date filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
          {DATE_FILTERS.map(f => (
            <TouchableOpacity key={f} onPress={() => handleDateFilter(f)} style={[s.chip, dateFilter === f && s.chipActive]} activeOpacity={0.75}>
              {dateFilter === f && <LinearGradient colors={[colors.accentDim, colors.accentMid]} style={StyleSheet.absoluteFillObject} />}
              <Text style={[s.chipText, dateFilter === f && { color: colors.accent }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Risk filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={s.filterContent}>
          {RISK_FILTERS.map(f => {
            const rColor = f === "Threats" ? colors.danger : f === "Medium" ? colors.warning : f === "Safe" ? colors.success : colors.textSub;
            return (
              <TouchableOpacity key={f} onPress={() => handleRiskFilter(f)} style={[s.riskChip, riskFilter === f && { borderColor: rColor + "70", backgroundColor: rColor + "14" }]} activeOpacity={0.75}>
                <Text style={[s.chipText, riskFilter === f && { color: rColor }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={s.list}>
            {[0,1,2,3,4].map(i => <SkeletonCard key={i} i={i} />)}
          </View>
        ) : !filtered.length ? (
          <Empty hasFilter={hasFilter} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            renderItem={({ item, index }) => (
              <HistoryCard
                item={item}
                index={index}
                onPress={() => setSelected(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            onRefresh={refetch}
            refreshing={isLoading}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
          />
        )}
      </SafeAreaView>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title:  { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  sub:    { fontSize: 12, color: colors.textSub, marginTop: 2 },
  searchBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },

  searchWrap:     { marginHorizontal: 20, marginBottom: 0 },
  searchInputWrap:{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.borderFocus, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12 },
  searchInput:    { flex: 1, color: colors.text, fontSize: 14 },

  summaryScroll:  { flexGrow: 0, marginBottom: 14 },
  summaryContent: { paddingHorizontal: 20, gap: 8 },
  summaryChip:    { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, alignItems: "center", minWidth: 60 },
  summaryVal:     { fontSize: 17, fontWeight: "900" },
  summaryLabel:   { fontSize: 9.5, color: colors.textSub, fontWeight: "700", letterSpacing: 0.3, marginTop: 1 },

  filterScroll:  { flexGrow: 0, marginBottom: 10 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  chip:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  riskChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  chipActive: { borderColor: colors.accent + "50" },
  chipText:   { fontSize: 12.5, color: colors.textSub, fontWeight: "600" },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  card:      { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden", paddingRight: 14, paddingVertical: 13, gap: 12 },
  accentBar: { width: 3, alignSelf: "stretch" },
  iconWrap:  { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body:      { flex: 1 },
  preview:   { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  meta:      { flexDirection: "row", alignItems: "center" },
  time:      { color: colors.textSub, fontSize: 11.5 },
  sep:       { color: colors.textDim, fontSize: 11 },
  type:      { color: colors.textDim, fontSize: 11.5, textTransform: "capitalize" },
  right:     { alignItems: "flex-end", gap: 6 },
  prob:      { fontSize: 14, fontWeight: "900" },

  empty:      { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 44, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptySub:   { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 22 },

  // Detail modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 22, paddingTop: 12, maxHeight: "90%" },
  handle:  { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 18 },

  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  sheetIcon:   { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  sheetType:   { fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 0.5 },
  sheetTime:   { fontSize: 12, color: colors.textSub, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  sheetRing: { alignItems: "center", justifyContent: "center", height: 140, marginBottom: 12 },
  ringOuter2:{ position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1 },
  ringInner2:{ width: 90, height: 90, borderRadius: 45, borderWidth: 3, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 12 },
  ringNum2:  { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  ringLabel2:{ fontSize: 9, color: colors.textSub, fontWeight: "700" },

  scamTypeChip: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  scamTypeText: { color: colors.textSub, fontSize: 12, fontStyle: "italic" },

  sheetPreview:     { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  sheetPreviewLabel:{ fontSize: 9.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1, marginBottom: 8 },
  sheetPreviewText: { color: colors.text, fontSize: 13.5, lineHeight: 22 },

  sheetMetaRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metaChip:     { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  metaChipVal:  { fontSize: 12.5, fontWeight: "900" },
  metaChipLabel:{ fontSize: 9, color: colors.textSub, fontWeight: "700", letterSpacing: 0.3 },

  // Rich detail sections
  detailSection:     { marginBottom: 14 },
  detailSectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  detailSectionTitle:{ fontSize: 10, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, flex: 1 },
  detailCard:        { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 },
  detailAnalysisText:{ color: colors.text, fontSize: 13.5, lineHeight: 22 },
  signalRow:         { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 7 },
  signalBorder:      { borderTopWidth: 0.5, borderTopColor: colors.border },
  signalDot:         { width: 5, height: 5, borderRadius: 2.5, marginTop: 9, flexShrink: 0 },
  signalText:        { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20 },
  flagsWrap:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flagChip:          { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  flagChipText:      { fontSize: 12, fontWeight: "700" },
  countPill:         { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  countPillText:     { fontSize: 10, fontWeight: "900" },
});

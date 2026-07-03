import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Users, Shield, MessageSquare, Link2, Mail,
  Phone, CreditCard, ImageIcon, QrCode, BarChart2, Calendar,
} from "../lib/icons";
import { RiskBadge } from "../components/ui/RiskBadge";
import { colors } from "../constants/colors";
import {
  getAdminStats, getAdminUsers, getAdminScans,
  type AdminStats, type AdminUser, type AdminScanRow,
} from "../lib/api";
import type { ScanType } from "../constants/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string | null, email: string) {
  const src = name ?? email.split("@")[0];
  return src.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "??";
}

const SCAN_ICONS: Partial<Record<ScanType, any>> = {
  message: MessageSquare, url: Link2, email: Mail,
  phone: Phone, upi: CreditCard, screenshot: ImageIcon, qr: QrCode,
};

const PLAN_COLORS: Record<string, string> = {
  free: colors.textSub,
  pro: colors.accent,
  business: "#C084FC",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <View style={[s.statCard, { borderColor: color + "30" }]}>
      <LinearGradient colors={[color + "14", "transparent"]} style={StyleSheet.absoluteFillObject} />
      <Icon size={16} color={color} strokeWidth={1.8} />
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function UserRow({ item }: { item: AdminUser }) {
  const ini = initials(item.name, item.email);
  const planColor = PLAN_COLORS[item.plan] ?? colors.textSub;
  return (
    <View style={s.row}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{ini}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.rowPrimary} numberOfLines={1}>{item.email}</Text>
          <View style={[s.planBadge, { borderColor: planColor + "50", backgroundColor: planColor + "14" }]}>
            <Text style={[s.planBadgeText, { color: planColor }]}>{item.plan.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={s.rowSub}>
          {item.total_scans} scan{item.total_scans !== 1 ? "s" : ""}  ·  Joined {fmtDate(item.created_at)}
        </Text>
      </View>
    </View>
  );
}

function ScanRow({ item }: { item: AdminScanRow }) {
  const Icon = SCAN_ICONS[item.scan_type as ScanType] ?? Shield;
  const preview = item.input_preview ?? item.input_url ?? "—";
  return (
    <View style={s.row}>
      <View style={s.scanIcon}>
        <Icon size={16} color={colors.accent} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.rowPrimary} numberOfLines={1}>{preview}</Text>
          <RiskBadge level={item.risk_level as any} />
        </View>
        <Text style={s.rowSub}>
          {item.user_email}  ·  {timeAgo(item.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type Tab = "users" | "scans";

export default function AdminScreen() {
  const [tab, setTab] = useState<Tab>("users");

  const statsQ = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    staleTime: 60_000,
    retry: 1,
  });

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => getAdminUsers(20, 0),
    staleTime: 60_000,
    retry: 1,
  });

  const scansQ = useQuery({
    queryKey: ["admin-scans"],
    queryFn: () => getAdminScans(20, 0),
    staleTime: 60_000,
    retry: 1,
  });

  const isError = statsQ.isError || usersQ.isError || scansQ.isError;
  const anyErr  = statsQ.error ?? usersQ.error ?? scansQ.error;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["rgba(124,58,237,0.08)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.25 }}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Admin Panel</Text>
          </View>
          <View style={s.adminBadge}>
            <Text style={s.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

        {/* Error state */}
        {isError && (
          <View style={s.errorBox}>
            <Shield size={28} color={colors.danger} strokeWidth={1.6} />
            <Text style={s.errorTitle}>Access Denied</Text>
            <Text style={s.errorSub}>
              {(anyErr as any)?.response?.status === 403
                ? "Your account does not have admin privileges."
                : "Could not load admin data. Check your connection."}
            </Text>
          </View>
        )}

        {!isError && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {/* Stats */}
            <Text style={s.sectionLabel}>OVERVIEW</Text>
            {statsQ.isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
            ) : statsQ.data ? (
              <View style={s.statsRow}>
                <StatCard icon={Users}    label="Total Users"  value={statsQ.data.total_users}  color={colors.accent} />
                <StatCard icon={BarChart2} label="Total Scans" value={statsQ.data.total_scans}  color="#7C3AED" />
                <StatCard icon={Calendar}  label="Today"       value={statsQ.data.scans_today}  color={colors.warning} />
              </View>
            ) : null}

            {statsQ.data && (
              <View style={s.statsRow2}>
                <View style={[s.statCard2, { flex: 1 }]}>
                  <Text style={s.stat2Label}>Active (30d)</Text>
                  <Text style={s.stat2Val}>{statsQ.data.active_users_30d}</Text>
                </View>
                <View style={[s.statCard2, { flex: 1 }]}>
                  <Text style={s.stat2Label}>High-Risk Scans</Text>
                  <Text style={[s.stat2Val, { color: colors.danger }]}>{statsQ.data.high_risk_scans}</Text>
                </View>
                <View style={[s.statCard2, { flex: 1 }]}>
                  <Text style={s.stat2Label}>Avg Scam Score</Text>
                  <Text style={[s.stat2Val, { color: colors.warning }]}>
                    {Math.round((statsQ.data.avg_scam_score ?? 0) * 100)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={s.tabs}>
              {(["users", "scans"] as Tab[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabBtn, tab === t && s.tabBtnActive]}
                  onPress={() => setTab(t)}
                  activeOpacity={0.78}
                >
                  {tab === t && (
                    <LinearGradient colors={["#7C3AED22", "transparent"]} style={StyleSheet.absoluteFillObject} />
                  )}
                  <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                    {t === "users" ? "Users" : "Scans"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Users list */}
            {tab === "users" && (
              usersQ.isLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
              ) : (
                <View style={s.listCard}>
                  {(usersQ.data?.users ?? []).length === 0 ? (
                    <Text style={s.empty}>No users found.</Text>
                  ) : (
                    (usersQ.data?.users ?? []).map((u, i) => (
                      <View key={u.id}>
                        {i > 0 && <View style={s.separator} />}
                        <UserRow item={u} />
                      </View>
                    ))
                  )}
                </View>
              )
            )}

            {/* Scans list */}
            {tab === "scans" && (
              scansQ.isLoading ? (
                <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
              ) : (
                <View style={s.listCard}>
                  {(scansQ.data?.scans ?? []).length === 0 ? (
                    <Text style={s.empty}>No scans found.</Text>
                  ) : (
                    (scansQ.data?.scans ?? []).map((sc, i) => (
                      <View key={sc.id}>
                        {i > 0 && <View style={s.separator} />}
                        <ScanRow item={sc} />
                      </View>
                    ))
                  )}
                </View>
              )
            )}

            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  adminBadge: {
    backgroundColor: "#7C3AED22", borderWidth: 1, borderColor: "#7C3AED60",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  adminBadgeText: { fontSize: 10, fontWeight: "900", color: "#C084FC", letterSpacing: 1 },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  sectionLabel: { fontSize: 10, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 10 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, alignItems: "center", gap: 6, padding: 14,
    backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, overflow: "hidden",
  },
  statVal:   { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 10, fontWeight: "600", color: colors.textSub },

  statsRow2: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard2: {
    alignItems: "center", paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  stat2Label: { fontSize: 10, fontWeight: "600", color: colors.textSub, marginBottom: 4, textAlign: "center" },
  stat2Val:   { fontSize: 18, fontWeight: "800", color: colors.text },

  tabs: {
    flexDirection: "row", gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden",
  },
  tabBtnActive: { borderColor: "#7C3AED60" },
  tabText:       { fontSize: 13, fontWeight: "700", color: colors.textSub },
  tabTextActive: { color: colors.accent },

  listCard: {
    backgroundColor: colors.card, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },

  row: {
    flexDirection: "row", alignItems: "center",
    gap: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  rowPrimary: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  rowSub:     { fontSize: 11, color: colors.textSub },

  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "800", color: colors.accent },

  scanIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },

  planBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1,
  },
  planBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  separator: { height: 0.5, backgroundColor: colors.border, marginLeft: 66 },
  empty:     { fontSize: 14, color: colors.textSub, textAlign: "center", paddingVertical: 32 },

  errorBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12, paddingTop: 80,
  },
  errorTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  errorSub:   { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 20 },
});

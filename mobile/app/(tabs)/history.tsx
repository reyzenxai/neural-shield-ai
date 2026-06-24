import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeScreen } from "../../components/layout/SafeScreen";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { colors, riskColor } from "../../constants/colors";
import { getScanHistory } from "../../lib/api";
import type { ScanHistoryItem, ScanType } from "../../constants/types";

const SCAN_EMOJIS: Record<ScanType, string> = {
  message: "💬", url: "🔗", email: "📧",
  phone: "📞", upi: "💸", screenshot: "📸", qr: "📷",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function HistoryItem({ item }: { item: ScanHistoryItem }) {
  const color = riskColor(item.risk_level);
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.75}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Text style={styles.icon}>{SCAN_EMOJIS[item.scan_type] ?? "🔍"}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemPreview} numberOfLines={1}>
          {item.content_preview || item.scan_type}
        </Text>
        <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
      </View>
      <View style={styles.itemRight}>
        <RiskBadge level={item.risk_level} size="sm" />
        <Text style={[styles.itemProb, { color }]}>
          {Math.round((item.scam_probability ?? 0) * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["history"],
    queryFn: () => getScanHistory(),
  });

  return (
    <SafeScreen>
      <View style={styles.header}>
        <Text style={styles.title}>Scan History</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !data?.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySub}>Your scan history will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItem item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 16, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  list: { paddingBottom: 32 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 20 },
  itemContent: { flex: 1 },
  itemPreview: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 3 },
  itemTime: { color: colors.textMuted, fontSize: 12 },
  itemRight: { alignItems: "flex-end", gap: 4 },
  itemProb: { fontSize: 13, fontWeight: "700" },
  separator: { height: 1, backgroundColor: colors.border },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  emptySub: { fontSize: 14, color: colors.textMuted },
});

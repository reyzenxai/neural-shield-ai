import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { SafeScreen } from "../../components/layout/SafeScreen";
import { Button } from "../../components/ui/Button";
import { colors } from "../../constants/colors";
import { getProfile } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { signOut } from "../../hooks/useAuth";

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    perks: ["5 scans/day", "Text, URL, Email, Phone, UPI"],
    planKey: "free",
  },
  {
    name: "Pro",
    price: "₹299/mo",
    perks: ["100 scans/day", "All scan types", "Screenshot & QR scanning", "Priority support"],
    planKey: "pro",
  },
  {
    name: "Business",
    price: "₹999/mo",
    perks: ["Unlimited scans", "REST API access", "SLA guarantee", "Dedicated support"],
    planKey: "business",
  },
];

export default function ProfileScreen() {
  const { session } = useAuthStore();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: !!session,
  });

  const currentPlan = profile?.plan ?? "free";

  function handleUpgrade(planKey: string) {
    Alert.alert(
      "Upgrade Plan",
      `Upgrading to ${planKey} plan. You'll be redirected to payment.`,
      [{ text: "Continue", onPress: () => {} }, { text: "Cancel", style: "cancel" }]
    );
  }

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Sign Out", style: "destructive", onPress: signOut },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeScreen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
          </Text>
        </View>
        <View>
          <Text style={styles.email}>{session?.user?.email}</Text>
          <View style={styles.planChip}>
            <Text style={styles.planChipText}>{currentPlan.toUpperCase()} PLAN</Text>
          </View>
        </View>
      </View>

      {/* Usage */}
      {profile && (
        <View style={styles.usageCard}>
          <Text style={styles.usageLabel}>Daily Scans</Text>
          <Text style={styles.usageCount}>
            {profile.daily_scans_used ?? 0} / {profile.daily_scan_limit ?? 5}
          </Text>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min(100, ((profile.daily_scans_used ?? 0) / (profile.daily_scan_limit ?? 5)) * 100)}%`,
                  backgroundColor:
                    (profile.daily_scans_used ?? 0) >= (profile.daily_scan_limit ?? 5)
                      ? colors.critical
                      : colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Plans */}
      <Text style={styles.sectionTitle}>Plans</Text>
      {PLANS.map((plan) => {
        const isCurrent = plan.planKey === currentPlan;
        return (
          <View
            key={plan.planKey}
            style={[styles.planCard, isCurrent && styles.planCardActive]}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              {isCurrent ? (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentText}>Current</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => handleUpgrade(plan.planKey)}
                >
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
            {plan.perks.map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <Text style={styles.perkDot}>✓</Text>
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>
        );
      })}

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Sign Out" onPress={handleSignOut} variant="ghost" />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 16, paddingBottom: 20 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryDim, borderWidth: 2, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.primary },
  email: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 4 },
  planChip: { backgroundColor: colors.primaryDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  planChipText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  usageCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 20,
  },
  usageLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  usageCount: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 8 },
  usageBar: { height: 6, backgroundColor: colors.background, borderRadius: 4 },
  usageFill: { height: 6, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  planCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 12,
  },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  planName: { fontSize: 17, fontWeight: "800", color: colors.text },
  planPrice: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  currentBadge: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  currentText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  upgradeBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  upgradeBtnText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  perkRow: { flexDirection: "row", gap: 8, marginBottom: 5 },
  perkDot: { color: colors.safe, fontSize: 13, fontWeight: "700" },
  perkText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  actions: { marginTop: 8, marginBottom: 40, gap: 12 },
});

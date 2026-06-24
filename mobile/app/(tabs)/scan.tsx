import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { SafeScreen } from "../../components/layout/SafeScreen";
import { RiskBadge } from "../../components/ui/RiskBadge";
import { Button } from "../../components/ui/Button";
import { colors } from "../../constants/colors";
import { SCAN_TYPES, type ScanType } from "../../constants/types";
import { scanContent, scanImage } from "../../lib/api";
import { useScanStore, useAuthStore } from "../../lib/store";

const SCAN_EMOJIS: Record<ScanType, string> = {
  message: "💬",
  url: "🔗",
  email: "📧",
  phone: "📞",
  upi: "💸",
  screenshot: "📸",
  qr: "📷",
};

export default function ScanScreen() {
  const [activeType, setActiveType] = useState<ScanType>("message");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { setLastResult } = useScanStore();
  const { profile } = useAuthStore();

  const scanConfig = SCAN_TYPES.find((s) => s.type === activeType)!;
  const isPro = profile?.plan === "pro" || profile?.plan === "business";

  async function handleScan() {
    if (!content.trim() && !["screenshot", "qr"].includes(activeType)) {
      return Alert.alert("Empty input", "Please enter something to scan.");
    }
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await scanContent(activeType, content.trim());
      setLastResult(result);
      router.push("/result");
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? "Scan failed. Try again.";
      if (msg.includes("limit")) {
        Alert.alert("Daily limit reached", "Upgrade to Pro for unlimited scans.", [
          { text: "View Plans", onPress: () => router.push("/(tabs)/profile") },
          { text: "Cancel", style: "cancel" },
        ]);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImageScan(type: "screenshot" | "qr") {
    if (!isPro) {
      return Alert.alert("Pro Feature", "Upgrade to Pro to use screenshot and QR scanning.", [
        { text: "View Plans", onPress: () => router.push("/(tabs)/profile") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const scanResult = await scanImage(type, asset.uri, asset.mimeType ?? "image/jpeg");
      setLastResult(scanResult);
      router.push("/result");
    } catch (e: any) {
      Alert.alert("Scan failed", e.response?.data?.message ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeScreen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Neural Shield AI</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>{profile?.plan?.toUpperCase() ?? "FREE"}</Text>
          </View>
        </View>

        {/* Scan type selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeContent}>
          {SCAN_TYPES.map((s) => (
            <TouchableOpacity
              key={s.type}
              onPress={() => {
                setActiveType(s.type);
                setContent("");
                if (s.proOnly && !isPro) return;
              }}
              style={[styles.typeBtn, activeType === s.type && styles.typeBtnActive]}
            >
              <Text style={styles.typeEmoji}>{SCAN_EMOJIS[s.type]}</Text>
              <Text style={[styles.typeLabel, activeType === s.type && styles.typeLabelActive]}>{s.label}</Text>
              {s.proOnly && <View style={styles.proPill}><Text style={styles.proText}>PRO</Text></View>}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputCard}>
          <Text style={styles.inputTitle}>{scanConfig.label} Scanner</Text>
          <Text style={styles.inputDesc}>{scanConfig.description}</Text>

          {["screenshot", "qr"].includes(activeType) ? (
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={() => handleImageScan(activeType as "screenshot" | "qr")}
            >
              <Text style={styles.imagePickerEmoji}>{SCAN_EMOJIS[activeType]}</Text>
              <Text style={styles.imagePickerLabel}>
                {activeType === "qr" ? "Scan QR Code" : "Choose Screenshot"}
              </Text>
              <Text style={styles.imagePickerSub}>Tap to open {activeType === "qr" ? "camera" : "gallery"}</Text>
              {!isPro && <View style={styles.proOverlay}><Text style={styles.proOverlayText}>PRO ONLY — Upgrade to unlock</Text></View>}
            </TouchableOpacity>
          ) : (
            <TextInput
              style={styles.textInput}
              value={content}
              onChangeText={setContent}
              placeholder={scanConfig.placeholder}
              placeholderTextColor={colors.textDim}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          )}

          {!["screenshot", "qr"].includes(activeType) && (
            <Button
              title={loading ? "Scanning..." : "Scan Now"}
              onPress={handleScan}
              loading={loading}
              disabled={!content.trim()}
              style={styles.scanBtn}
            />
          )}
        </View>

        {/* Quota */}
        {profile && (
          <View style={styles.quota}>
            <Text style={styles.quotaText}>
              {profile.daily_scans_used ?? 0} / {profile.daily_scan_limit ?? 5} scans used today
            </Text>
            <View style={styles.quotaBar}>
              <View
                style={[
                  styles.quotaFill,
                  {
                    width: `${Math.min(100, ((profile.daily_scans_used ?? 0) / (profile.daily_scan_limit ?? 5)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "800", color: colors.text },
  planBadge: { backgroundColor: colors.primaryDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  typeScroll: { marginHorizontal: -20, marginBottom: 16 },
  typeContent: { paddingHorizontal: 20, gap: 10 },
  typeBtn: {
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, minWidth: 80, position: "relative",
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  typeLabelActive: { color: colors.primary },
  proPill: { position: "absolute", top: 4, right: 4, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  proText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  inputCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 16 },
  inputTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 },
  inputDesc: { fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  textInput: {
    backgroundColor: colors.background, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14, color: colors.text,
    fontSize: 14, minHeight: 120, marginBottom: 14,
  },
  scanBtn: {},
  imagePicker: {
    alignItems: "center", justifyContent: "center", padding: 32,
    backgroundColor: colors.background, borderRadius: 14,
    borderWidth: 2, borderColor: colors.border, borderStyle: "dashed",
    marginBottom: 14, overflow: "hidden",
  },
  imagePickerEmoji: { fontSize: 40, marginBottom: 10 },
  imagePickerLabel: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 4 },
  imagePickerSub: { fontSize: 13, color: colors.textMuted },
  proOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,18,0.75)",
    alignItems: "center", justifyContent: "center",
  },
  proOverlayText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  quota: { marginBottom: 32 },
  quotaText: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  quotaBar: { height: 4, backgroundColor: colors.surface, borderRadius: 4 },
  quotaFill: { height: 4, backgroundColor: colors.primary, borderRadius: 4 },
});

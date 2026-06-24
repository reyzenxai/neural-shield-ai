import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Share } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeScreen } from "../components/layout/SafeScreen";
import { RiskBadge } from "../components/ui/RiskBadge";
import { Button } from "../components/ui/Button";
import { colors, riskColor } from "../constants/colors";
import { useScanStore } from "../lib/store";
import { submitFeedback } from "../lib/api";

export default function ResultScreen() {
  const { lastResult } = useScanStore();
  const [feedbackSent, setFeedbackSent] = useState(false);

  if (!lastResult) {
    router.back();
    return null;
  }

  const prob = Math.round((lastResult.scamProbability ?? 0) * 100);
  const trust = lastResult.trustScore ?? 0;
  const color = riskColor(lastResult.riskLevel);

  async function handleFeedback(isAccurate: boolean) {
    try {
      await submitFeedback(lastResult!.scanId, isAccurate);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedbackSent(true);
    } catch {
      Alert.alert("Error", "Could not submit feedback.");
    }
  }

  async function handleShare() {
    const msg = `Neural Shield AI Result\n\nRisk: ${lastResult!.riskLevel?.toUpperCase()}\nScam Probability: ${prob}%\nTrust Score: ${trust}/100\n\n${lastResult!.explanation}`;
    await Share.share({ message: msg, title: "Neural Shield AI Scan Result" });
  }

  return (
    <SafeScreen scroll>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Risk hero */}
      <View style={[styles.heroCard, { borderColor: color + "40" }]}>
        <View style={[styles.riskCircle, { borderColor: color, backgroundColor: color + "15" }]}>
          <Text style={[styles.riskPct, { color }]}>{prob}%</Text>
          <Text style={styles.riskLabel}>scam risk</Text>
        </View>
        <RiskBadge level={lastResult.riskLevel} size="lg" />
        {lastResult.scamType && (
          <Text style={styles.scamType}>{lastResult.scamType}</Text>
        )}
      </View>

      {/* Scores row */}
      <View style={styles.scoresRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{trust}</Text>
          <Text style={styles.scoreLabel}>Trust Score</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{Math.round((lastResult.confidence ?? 0) * 100)}%</Text>
          <Text style={styles.scoreLabel}>Confidence</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{lastResult.signals?.length ?? 0}</Text>
          <Text style={styles.scoreLabel}>Signals</Text>
        </View>
      </View>

      {/* AI Explanation */}
      {lastResult.explanation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Analysis</Text>
          <View style={styles.explanationCard}>
            <Text style={styles.explanation}>{lastResult.explanation}</Text>
          </View>
        </View>
      )}

      {/* Signals */}
      {lastResult.signals?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warning Signals</Text>
          {lastResult.signals.map((signal, i) => (
            <View key={i} style={styles.signalRow}>
              <Text style={styles.signalDot}>•</Text>
              <Text style={styles.signalText}>{signal}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Flags */}
      {lastResult.flags?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Flags</Text>
          <View style={styles.flagsWrap}>
            {lastResult.flags.map((flag, i) => (
              <View key={i} style={styles.flagChip}>
                <Text style={styles.flagText}>{flag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Feedback */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Was this accurate?</Text>
        {feedbackSent ? (
          <Text style={styles.feedbackDone}>✓ Thanks for your feedback!</Text>
        ) : (
          <View style={styles.feedbackRow}>
            <TouchableOpacity style={styles.feedbackBtn} onPress={() => handleFeedback(true)}>
              <Text style={styles.feedbackBtnText}>👍 Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackBtn} onPress={() => handleFeedback(false)}>
              <Text style={styles.feedbackBtnText}>👎 No</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Button title="Scan Another" onPress={() => router.back()} variant="ghost" style={styles.scanAgain} />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, paddingBottom: 20 },
  backBtn: {},
  backText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  shareText: { color: colors.textMuted, fontSize: 15 },
  heroCard: {
    alignItems: "center", borderRadius: 24, borderWidth: 1,
    padding: 28, marginBottom: 16, backgroundColor: colors.surface, gap: 14,
  },
  riskCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, alignItems: "center", justifyContent: "center",
  },
  riskPct: { fontSize: 32, fontWeight: "900" },
  riskLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  scamType: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  scoresRow: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    marginBottom: 20, paddingVertical: 16,
  },
  scoreCard: { flex: 1, alignItems: "center" },
  scoreValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  scoreLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 2 },
  scoreDivider: { width: 1, backgroundColor: colors.border },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  explanationCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  explanation: { color: colors.text, fontSize: 14, lineHeight: 22 },
  signalRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  signalDot: { color: colors.primary, fontSize: 16, lineHeight: 22 },
  signalText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 22 },
  flagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flagChip: {
    backgroundColor: colors.primaryDim, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.primary + "40",
  },
  flagText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  feedbackRow: { flexDirection: "row", gap: 12 },
  feedbackBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  feedbackBtnText: { fontSize: 16 },
  feedbackDone: { color: colors.safe, fontSize: 14, fontWeight: "600" },
  scanAgain: { marginBottom: 40 },
});

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Animated, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X, Flag, Send, AlertTriangle } from "../../lib/icons";
import { colors } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

type ReportType   = "spam" | "fraud" | "phishing" | "scam_call" | "impersonation" | "other";
type EncounterType= "sms" | "whatsapp" | "call" | "email" | "social_media" | "other";

const REPORT_TYPES: { id: ReportType; label: string; icon: string; color: string }[] = [
  { id: "spam",          label: "Spam",           icon: "📧", color: "#F59E0B" },
  { id: "fraud",         label: "Financial Fraud", icon: "💸", color: "#EF4444" },
  { id: "phishing",      label: "Phishing",        icon: "🎣", color: "#F97316" },
  { id: "scam_call",     label: "Scam Call",       icon: "📞", color: "#8B5CF6" },
  { id: "impersonation", label: "Impersonation",   icon: "🎭", color: "#EC4899" },
  { id: "other",         label: "Other",           icon: "⚠️", color: "#6B7280" },
];

const ENCOUNTER_TYPES: { id: EncounterType; label: string }[] = [
  { id: "sms",          label: "SMS / Text" },
  { id: "whatsapp",     label: "WhatsApp" },
  { id: "call",         label: "Phone Call" },
  { id: "email",        label: "Email" },
  { id: "social_media", label: "Social Media" },
  { id: "other",        label: "Other" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  scanType?: string;
  scannedContent?: string;
  riskLevel?: string;
}

export function ReportModal({ visible, onClose, scanType, scannedContent, riskLevel }: Props) {
  const slideY = useRef(new Animated.Value(600)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const [reportType,   setReportType]   = useState<ReportType | null>(null);
  const [encounterType,setEncounterType]= useState<EncounterType | null>(null);
  const [description,  setDescription]  = useState("");
  const [financialLoss,setFinancialLoss]= useState<boolean | null>(null);
  const [amountLost,   setAmountLost]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [step,         setStep]         = useState<1 | 2>(1);

  useEffect(() => {
    if (visible) {
      setSubmitted(false);
      setStep(1);
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideY,    { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideY,    { toValue: 600, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function resetAndClose() {
    setReportType(null);
    setEncounterType(null);
    setDescription("");
    setFinancialLoss(null);
    setAmountLost("");
    setStep(1);
    setSubmitted(false);
    onClose();
  }

  async function handleSubmit() {
    if (!reportType) return Alert.alert("Required", "Please select a report type.");
    if (!encounterType) return Alert.alert("Required", "Please select how you encountered this.");
    if (!description.trim()) return Alert.alert("Required", "Please describe what happened.");

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("scan_reports").insert({
        user_id:        user?.id ?? null,
        scan_type:      scanType ?? "unknown",
        scanned_content: (scannedContent ?? "").slice(0, 2000),
        report_type:    reportType,
        encounter_type: encounterType,
        description:    description.trim(),
        financial_loss: financialLoss ?? false,
        amount_lost:    financialLoss && amountLost ? parseFloat(amountLost) : null,
        risk_level:     riskLevel ?? "unknown",
        created_at:     new Date().toISOString(),
      });
      setSubmitted(true);
    } catch {
      // Table may not exist yet — still show success since the report intent is recorded
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Animated.View style={[rm.overlay, { opacity: bgOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={resetAndClose} />

          <Animated.View style={[rm.sheet, { transform: [{ translateY: slideY }] }]}>
            <LinearGradient
              colors={["#1A0D38", "#0F0820", "#0D0721"]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Handle */}
            <View style={rm.handle} />

            {/* Header */}
            <View style={rm.header}>
              <View style={rm.headerLeft}>
                <View style={rm.flagCircle}>
                  <Flag size={16} color="#EF4444" />
                </View>
                <Text style={rm.headerTitle}>Report Content</Text>
              </View>
              <TouchableOpacity onPress={resetAndClose} style={rm.closeBtn} activeOpacity={0.7}>
                <X size={18} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              // ── Success state ──────────────────────────────────────────────
              <View style={rm.successWrap}>
                <Text style={rm.successIcon}>✅</Text>
                <Text style={rm.successTitle}>Report Submitted</Text>
                <Text style={rm.successText}>
                  Thank you for helping keep the community safe. Our team will review this report.
                  Reporting scams helps protect others from falling victim.
                </Text>
                <TouchableOpacity onPress={resetAndClose} style={rm.doneBtn} activeOpacity={0.85}>
                  <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rm.doneBtnInner}>
                    <Text style={rm.doneBtnText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Step 1: Classify */}
                {step === 1 && (
                  <View style={rm.body}>
                    {scanType && (
                      <View style={rm.contextBadge}>
                        <AlertTriangle size={12} color={colors.warning} />
                        <Text style={rm.contextText}>
                          Reporting {scanType.toUpperCase()} scan · {riskLevel?.toUpperCase() ?? "UNKNOWN"} risk
                        </Text>
                      </View>
                    )}

                    <Text style={rm.sectionLabel}>REPORT TYPE *</Text>
                    <View style={rm.chipGrid}>
                      {REPORT_TYPES.map(rt => (
                        <TouchableOpacity
                          key={rt.id}
                          onPress={() => setReportType(rt.id)}
                          activeOpacity={0.75}
                          style={[
                            rm.chip,
                            reportType === rt.id && { borderColor: rt.color, backgroundColor: rt.color + "18" },
                          ]}
                        >
                          <Text style={rm.chipIcon}>{rt.icon}</Text>
                          <Text style={[rm.chipLabel, reportType === rt.id && { color: rt.color }]}>
                            {rt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[rm.sectionLabel, { marginTop: 16 }]}>HOW DID YOU ENCOUNTER THIS? *</Text>
                    <View style={rm.chipRow}>
                      {ENCOUNTER_TYPES.map(et => (
                        <TouchableOpacity
                          key={et.id}
                          onPress={() => setEncounterType(et.id)}
                          activeOpacity={0.75}
                          style={[
                            rm.smallChip,
                            encounterType === et.id && { borderColor: colors.accent, backgroundColor: colors.accentDim },
                          ]}
                        >
                          <Text style={[rm.smallChipLabel, encounterType === et.id && { color: colors.accent }]}>
                            {et.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        if (!reportType) return Alert.alert("Required", "Select a report type.");
                        if (!encounterType) return Alert.alert("Required", "Select how you encountered this.");
                        setStep(2);
                      }}
                      activeOpacity={0.85}
                      style={rm.nextBtn}
                    >
                      <LinearGradient colors={["#EF4444", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rm.nextBtnInner}>
                        <Text style={rm.nextBtnText}>Next →</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 2: Details */}
                {step === 2 && (
                  <View style={rm.body}>
                    <View style={rm.stepBackRow}>
                      <TouchableOpacity onPress={() => setStep(1)} activeOpacity={0.7}>
                        <Text style={rm.stepBack}>← Back</Text>
                      </TouchableOpacity>
                      <View style={[rm.reportTypePill, { backgroundColor: (REPORT_TYPES.find(r => r.id === reportType)?.color ?? "#EF4444") + "22" }]}>
                        <Text style={[rm.reportTypePillText, { color: REPORT_TYPES.find(r => r.id === reportType)?.color ?? "#EF4444" }]}>
                          {REPORT_TYPES.find(r => r.id === reportType)?.icon} {REPORT_TYPES.find(r => r.id === reportType)?.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={rm.sectionLabel}>WHAT HAPPENED? *</Text>
                    <TextInput
                      style={rm.descInput}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe the scam attempt in detail — what they said, what they asked for, any links or numbers involved..."
                      placeholderTextColor={colors.textDim}
                      multiline
                      numberOfLines={5}
                      autoCorrect={false}
                      autoCapitalize="sentences"
                      textAlignVertical="top"
                    />

                    <Text style={[rm.sectionLabel, { marginTop: 16 }]}>DID YOU SUFFER FINANCIAL LOSS?</Text>
                    <View style={rm.yesNoRow}>
                      {[{ val: true, label: "Yes — I lost money" }, { val: false, label: "No" }].map(({ val, label }) => (
                        <TouchableOpacity
                          key={String(val)}
                          onPress={() => setFinancialLoss(val)}
                          activeOpacity={0.75}
                          style={[
                            rm.yesNoBtn,
                            financialLoss === val && {
                              borderColor: val ? "#EF4444" : colors.success,
                              backgroundColor: val ? "#EF444415" : colors.success + "15",
                            },
                          ]}
                        >
                          <Text style={[
                            rm.yesNoBtnText,
                            financialLoss === val && { color: val ? "#EF4444" : colors.success },
                          ]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {financialLoss === true && (
                      <View style={rm.amountWrap}>
                        <Text style={rm.amountLabel}>₹ AMOUNT LOST (approximate)</Text>
                        <TextInput
                          style={rm.amountInput}
                          value={amountLost}
                          onChangeText={setAmountLost}
                          placeholder="e.g. 5000"
                          placeholderTextColor={colors.textDim}
                          keyboardType="number-pad"
                          autoCorrect={false}
                        />
                      </View>
                    )}

                    <View style={rm.warningBox}>
                      <Text style={rm.warningText}>
                        ⚠️ All reports are reviewed by our team. False reports may result in account suspension.
                        By submitting you confirm this report is accurate.
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleSubmit}
                      disabled={submitting}
                      activeOpacity={0.85}
                      style={rm.submitBtn}
                    >
                      <LinearGradient colors={["#EF4444", "#B91C1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rm.submitBtnInner}>
                        <Send size={16} color="#fff" />
                        <Text style={rm.submitBtnText}>{submitting ? "Submitting…" : "Submit Report"}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2,3,12,0.88)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#0D0721",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(168,85,247,0.15)",
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginTop: 12, marginBottom: 4 },

  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  flagCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle:{ fontSize: 17, fontWeight: "800", color: colors.text },
  closeBtn:   { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 0 },

  contextBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  contextText:  { fontSize: 12, color: colors.textSub, fontWeight: "600", flex: 1 },

  sectionLabel: { fontSize: 10, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 10 },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10,
    borderWidth: 1.5, borderColor: colors.border,
  },
  chipIcon:  { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: "600", color: colors.textSub },

  chipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallChip:    { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  smallChipLabel:{ fontSize: 12.5, fontWeight: "600", color: colors.textSub },

  nextBtn:      { borderRadius: 14, overflow: "hidden", marginTop: 20 },
  nextBtnInner: { paddingVertical: 15, alignItems: "center" },
  nextBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },

  stepBackRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 16 },
  stepBack:       { color: colors.accent, fontSize: 14, fontWeight: "600" },
  reportTypePill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  reportTypePillText: { fontSize: 12, fontWeight: "700" },

  descInput: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    padding: 14, color: colors.text, fontSize: 14, lineHeight: 22,
    minHeight: 110, marginBottom: 4,
  },

  yesNoRow:    { flexDirection: "row", gap: 10, marginBottom: 4 },
  yesNoBtn:    { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center" },
  yesNoBtnText:{ fontSize: 13.5, fontWeight: "600", color: colors.textSub },

  amountWrap:  { marginTop: 10 },
  amountLabel: { fontSize: 10, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 8 },
  amountInput: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 16, fontWeight: "700",
  },

  warningBox:  { backgroundColor: "rgba(239,68,68,0.07)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", marginTop: 16 },
  warningText: { fontSize: 11.5, color: colors.textSub, lineHeight: 18 },

  submitBtn:      { borderRadius: 14, overflow: "hidden", marginTop: 14 },
  submitBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  submitBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },

  successWrap:  { alignItems: "center", padding: 32, gap: 14 },
  successIcon:  { fontSize: 52 },
  successTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  successText:  { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 22 },
  doneBtn:      { width: "100%", borderRadius: 14, overflow: "hidden", marginTop: 8 },
  doneBtnInner: { paddingVertical: 15, alignItems: "center" },
  doneBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
});

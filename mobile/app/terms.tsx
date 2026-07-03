import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Shield } from "../lib/icons";
import { colors } from "../constants/colors";

const LAST_UPDATED = "June 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: string }) {
  return <Text style={s.para}>{children}</Text>;
}

function Bullet({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}><Text style={s.bulletLabel}>{label}: </Text>{value}</Text>
    </View>
  );
}

export default function TermsScreen() {
  return (
    <View style={s.root}>
      <LinearGradient
        colors={["rgba(124,58,237,0.09)", "transparent"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Terms and Conditions</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.docCard}>
            <LinearGradient colors={["rgba(124,58,237,0.08)", "transparent"]} style={StyleSheet.absoluteFillObject} />
            <View style={s.docHeader}>
              <View style={s.docIcon}>
                <Shield size={20} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle}>Terms and Conditions</Text>
                <Text style={s.docMeta}>Neural Shield AI · Last updated {LAST_UPDATED}</Text>
              </View>
            </View>

            <Section title="1. Acceptance">
              <Para>By creating an account or using the Neural Shield AI app or website, you agree to these Terms. If you do not agree, do not use the service.</Para>
            </Section>

            <Section title="2. Service Description">
              <Para>Neural Shield AI provides AI-assisted analysis of digital content to help identify potential scams and fraud. The service is informational only and does not constitute legal, financial, or security advice.</Para>
            </Section>

            <Section title="3. Accuracy and Limitations">
              <Para>Our detection engine has known limitations. We may produce false positives (flagging safe content) or false negatives (missing genuine threats). You agree that:</Para>
              <Bullet label="No guarantee" value="Neural Shield AI makes no warranty of accuracy or completeness" />
              <Bullet label="User responsibility" value="You make the final decision on how to act on any result" />
              <Bullet label="Not a replacement" value="Our service does not replace due diligence, professional advice, or security software" />
            </Section>

            <Section title="4. Acceptable Use">
              <Para>You agree not to use the service to scan content for which you have no authorisation, reverse-engineer our detection logic, submit spam or automated requests that exceed plan limits, or attempt to circumvent rate limiting or authentication.</Para>
            </Section>

            <Section title="5. Subscription Plans">
              <Para>Free plan users receive 5 scans per day. Pro and Business subscribers receive higher limits as described on the pricing page. Subscription fees are non-refundable except where required by law. We reserve the right to change pricing with 30 days notice.</Para>
            </Section>

            <Section title="6. Account Termination">
              <Para>We may suspend or terminate accounts that violate these Terms, engage in abuse, or attempt to misuse the platform. You may delete your account at any time from the Profile screen.</Para>
            </Section>

            <Section title="7. Liability Limitation">
              <Para>To the fullest extent permitted by law, Neural Shield AI is not liable for any direct, indirect, or consequential damages arising from your use of or reliance on scan results, including any financial loss resulting from a scam that our service did not detect.</Para>
            </Section>

            <Section title="8. Governing Law">
              <Para>These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of Mumbai, Maharashtra.</Para>
            </Section>

            <Section title="9. Contact">
              <Para>Legal inquiries: support@neuralshieldai.com</Para>
            </Section>
          </View>

          <TouchableOpacity onPress={() => router.push("/privacy-policy")} style={s.linkCard} activeOpacity={0.7}>
            <Text style={s.linkText}>View Privacy Policy</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  scroll:      { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  docCard: {
    backgroundColor: colors.card,
    borderRadius: 22, borderWidth: 1, borderColor: colors.border,
    overflow: "hidden", paddingHorizontal: 20, paddingBottom: 20,
  },
  docHeader: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: 16,
  },
  docIcon:  { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(124,58,237,0.15)", alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  docMeta:  { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  section:      { marginBottom: 18 },
  sectionTitle: { fontSize: 13.5, fontWeight: "800", color: colors.text, marginBottom: 8, letterSpacing: -0.2 },
  para:         { fontSize: 13.5, color: colors.textSub, lineHeight: 21 },
  bulletRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6 },
  bulletDot:    { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent, marginTop: 8, flexShrink: 0 },
  bulletText:   { flex: 1, fontSize: 13.5, color: colors.textSub, lineHeight: 21 },
  bulletLabel:  { fontWeight: "700", color: colors.text },
  linkCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 18, paddingVertical: 14, marginTop: 12,
  },
  linkText:  { fontSize: 14, fontWeight: "600", color: colors.accent },
  linkArrow: { fontSize: 20, color: colors.accent, fontWeight: "300" },
});

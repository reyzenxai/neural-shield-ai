import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowLeft, Lock } from "../lib/icons";
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

export default function PrivacyPolicyScreen() {
  return (
    <View style={s.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.09)", "transparent"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Privacy Policy</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.docCard}>
            <LinearGradient colors={["rgba(168,85,247,0.08)", "transparent"]} style={StyleSheet.absoluteFillObject} />
            <View style={s.docHeader}>
              <View style={s.docIcon}>
                <Lock size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.docTitle}>Privacy Policy</Text>
                <Text style={s.docMeta}>Neural Shield AI · Last updated {LAST_UPDATED}</Text>
              </View>
            </View>

            <View style={s.warningBox}>
              <Text style={s.warningTitle}>Accuracy Disclaimer</Text>
              <Text style={s.warningText}>
                Neural Shield AI uses AI-powered analysis to detect potential scams. We do not guarantee 100% accuracy; no automated system can. The final decision is always yours. Choosing to ignore a high-risk warning considerably increases your risk of fraud. By proceeding past a high-risk alert, you do so at your own discretion.
              </Text>
            </View>

            <Section title="1. Detection Technology">
              <Para>The app uses a multi-layer detection engine with 11 threat intelligence sources, a deterministic rules engine, and an AI model for explanation. Your results are identical whether you use the app or website.</Para>
            </Section>

            <Section title="2. Data We Collect">
              <Para>We collect only what is needed to provide our service:</Para>
              <Bullet label="Account data" value="Email address and display name" />
              <Bullet label="Scan history" value="Content you submit for analysis, stored encrypted and deleted after 30 days" />
              <Bullet label="Usage stats" value="Anonymised scan counts for rate limiting and plan management" />
              <Bullet label="Device info" value="OS type and app version for support purposes only" />
            </Section>

            <Section title="3. How We Use Your Scan Content">
              <Para>Content you submit is analysed in real time. We never store plain-text scan content beyond 30 days, sell it, share it with advertisers, or use it to train AI models. All scan results are tied to your account under row-level security; only you can access your history.</Para>
            </Section>

            <Section title="4. Data Security">
              <Para>All data is encrypted in transit (TLS 1.3). Authentication is managed by Supabase (SOC 2 Type II certified). We do not store plain-text credentials. Your access token is stored in the device encrypted secure store.</Para>
            </Section>

            <Section title="5. Third-Party Services">
              <Para>We use the following services, each processing only the minimum data required:</Para>
              <Bullet label="Supabase" value="Authentication and database (EU/US hosting)" />
              <Bullet label="AI provider" value="Natural language explanation of scan results only" />
              <Bullet label="Google Safe Browsing" value="URL threat checking" />
              <Bullet label="VirusTotal, Spamhaus, AbuseIPDB" value="Threat intelligence enrichment" />
            </Section>

            <Section title="6. Your Rights">
              <Para>You may access, correct, export, or permanently delete your account and all associated data at any time from the Profile screen or by emailing us. Deletion removes all scan history, profile data, and any identifying information within 30 days.</Para>
            </Section>

            <Section title="7. No Data Selling">
              <Para>We never sell your personal data or scan content to advertisers, data brokers, or any third party. Our only revenue comes from subscription plans.</Para>
            </Section>

            <Section title="8. Contact">
              <Para>Privacy inquiries: support@neuralshieldai.com</Para>
            </Section>
          </View>

          <TouchableOpacity onPress={() => router.push("/terms")} style={s.linkCard} activeOpacity={0.7}>
            <Text style={s.linkText}>View Terms and Conditions</Text>
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
  docIcon:  { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  docMeta:  { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  warningBox: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)",
    padding: 14, marginBottom: 20,
  },
  warningTitle: { fontSize: 13, fontWeight: "800", color: "#F59E0B", marginBottom: 6 },
  warningText:  { fontSize: 13, color: colors.textSub, lineHeight: 20 },
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

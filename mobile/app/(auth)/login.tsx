import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from "react-native";
import { Link } from "expo-router";
import { SafeScreen } from "../../components/layout/SafeScreen";
import { Button } from "../../components/ui/Button";
import { signIn } from "../../hooks/useAuth";
import { colors } from "../../constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return Alert.alert("Error", "Enter email and password.");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      Alert.alert("Login failed", e.message ?? "Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeScreen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.kav}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <Text style={styles.title}>Neural Shield AI</Text>
          <Text style={styles.sub}>Sign in to protect yourself from scams</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textDim}
            secureTextEntry
          />

          <Button title="Sign In" onPress={handleLogin} loading={loading} style={styles.btn} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  hero: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.primaryDim,
    borderWidth: 1, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  iconText: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: colors.text, fontSize: 15,
  },
  btn: { marginTop: 20 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});

import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { SafeScreen } from "../../components/layout/SafeScreen";
import { Button } from "../../components/ui/Button";
import { signUp } from "../../hooks/useAuth";
import { colors } from "../../constants/colors";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name || !email || !password) return Alert.alert("Error", "Fill in all fields.");
    if (password.length < 8) return Alert.alert("Error", "Password must be at least 8 characters.");
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      Alert.alert("Check your email", "We sent a confirmation link. Verify then sign in.");
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeScreen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.sub}>Start detecting scams for free</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: "Full Name", value: name, set: setName, placeholder: "Pranjal Sharma", type: "default" as const },
            { label: "Email", value: email, set: setEmail, placeholder: "you@example.com", type: "email-address" as const },
          ].map(({ label, value, set, placeholder, type }) => (
            <View key={label}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={set}
                placeholder={placeholder}
                placeholderTextColor={colors.textDim}
                keyboardType={type}
                autoCapitalize={type === "email-address" ? "none" : "words"}
              />
            </View>
          ))}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 characters"
            placeholderTextColor={colors.textDim}
            secureTextEntry
          />

          <Button title="Create Account" onPress={handleSignup} loading={loading} style={styles.btn} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 48, paddingBottom: 32 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.primaryDim,
    borderWidth: 1, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  iconText: { fontSize: 30 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 4 },
  sub: { fontSize: 14, color: colors.textMuted },
  form: { gap: 2 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: colors.text, fontSize: 15,
  },
  btn: { marginTop: 20 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});

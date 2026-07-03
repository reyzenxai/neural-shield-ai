import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from "../../lib/icons";
import { signIn } from "../../hooks/useAuth";
import { AppAlert, useAppAlert } from "../../components/ui/AppAlert";
import { colors } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus]  = useState(false);
  const { alertVisible, alertConfig, showAlert, dismissAlert } = useAppAlert();

  const shieldScale = useRef(new Animated.Value(0.7)).current;
  const shieldFade  = useRef(new Animated.Value(0)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(30)).current;
  const pulse       = useRef(new Animated.Value(1)).current;
  const emailBorder = useRef(new Animated.Value(0)).current;
  const passBorder  = useRef(new Animated.Value(0)).current;

  const passRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(shieldScale, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(shieldFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(cardY,    { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 2200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 2200, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.timing(emailBorder, { toValue: emailFocus ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [emailFocus]);

  useEffect(() => {
    Animated.timing(passBorder, { toValue: passFocus ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [passFocus]);

  const emailBorderColor = emailBorder.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accent] });
  const passBorderColor  = passBorder.interpolate({  inputRange: [0, 1], outputRange: [colors.border, colors.accent] });

  async function handleForgotPassword() {
    if (!email.trim()) {
      showAlert({ title: "Enter Email First", message: "Type your email address above, then tap Forgot Password.", buttons: [{ text: "OK" }] });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      showAlert({
        title: "Reset Email Sent",
        message: `Password reset instructions have been sent to ${email.trim()}. Check your inbox.`,
        buttons: [{ text: "OK" }],
      });
    } catch (e: any) {
      showAlert({ title: "Failed", message: e.message ?? "Could not send reset email. Try again.", buttons: [{ text: "OK" }] });
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      showAlert({ title: "Missing Fields", message: "Enter your email and password.", buttons: [{ text: "OK" }] });
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      showAlert({ title: "Sign In Failed", message: e.message ?? "Check your credentials and try again.", buttons: [{ text: "OK" }] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.12)", "#0D0721", "rgba(217,70,239,0.07)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <Animated.View style={[styles.logoWrap, { opacity: shieldFade, transform: [{ scale: shieldScale }] }]}>
              <Animated.View style={[styles.shieldGlow, { transform: [{ scale: pulse }] }]} />
              <LinearGradient colors={["#2D1458", "#150A32"]} style={styles.shieldBg}>
                <Shield size={38} color={colors.accent} strokeWidth={1.8} />
              </LinearGradient>
            </Animated.View>
            <Animated.View style={{ opacity: shieldFade, alignItems: "center", marginBottom: 36 }}>
              <Text style={styles.logoTitle}>Neural Shield</Text>
              <Text style={styles.logoSub}>AI-powered scam & fraud detection</Text>
            </Animated.View>

            {/* Card */}
            <Animated.View style={[styles.card, { opacity: cardFade, transform: [{ translateY: cardY }] }]}>

              {/* Email */}
              <Animated.View style={[styles.inputWrap, { borderColor: emailBorderColor }]}>
                <Mail size={16} color={emailFocus ? colors.accent : colors.textSub} strokeWidth={1.8} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.textDim}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passRef.current?.focus()}
                  blurOnSubmit={false}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                />
              </Animated.View>

              {/* Password */}
              <Animated.View style={[styles.inputWrap, { borderColor: passBorderColor }]}>
                <Lock size={16} color={passFocus ? colors.accent : colors.textSub} strokeWidth={1.8} />
                <TextInput
                  ref={passRef}
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPass
                    ? <EyeOff size={16} color={colors.textSub} />
                    : <Eye    size={16} color={colors.textSub} />}
                </TouchableOpacity>
              </Animated.View>

              {/* Forgot password */}
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotRow} activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* CTA */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={styles.ctaOuter}>
                <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
                  <Text style={styles.ctaText}>{loading ? "Signing in…" : "Sign In"}</Text>
                  {!loading && <ArrowRight size={18} color="#fff" strokeWidth={2} />}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={styles.signupRow} activeOpacity={0.7}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <Text style={styles.signupLink}>Create account</Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AppAlert visible={alertVisible} config={alertConfig} onDismiss={dismissAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },

  orb:       { position: "absolute", borderRadius: 999 },
  orbTop:    { width: 320, height: 320, top: -100,  left: -100, backgroundColor: "rgba(168,85,247,0.07)" },
  orbBottom: { width: 260, height: 260, bottom: 40, right: -80, backgroundColor: "rgba(217,70,239,0.05)" },

  logoWrap:   { alignItems: "center", marginBottom: 16 },
  shieldGlow: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(168,85,247,0.15)" },
  shieldBg:   { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(168,85,247,0.3)" },
  logoTitle:  { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.5, marginTop: 16 },
  logoSub:    { fontSize: 13, color: colors.textSub, marginTop: 4 },

  card: {
    width: "100%", backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    padding: 24, gap: 14,
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },

  ctaOuter: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  cta:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  ctaText:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  signupRow:  { flexDirection: "row", justifyContent: "center", marginTop: 2 },
  signupText: { color: colors.textSub, fontSize: 14 },
  signupLink: { color: colors.accent, fontSize: 14, fontWeight: "600" },

  forgotRow:  { alignSelf: "flex-end", paddingVertical: 2 },
  forgotText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
});

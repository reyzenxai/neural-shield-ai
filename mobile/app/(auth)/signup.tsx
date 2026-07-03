import React, { useState, useRef, useEffect, memo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Shield, Mail, Lock, User, ArrowRight, Eye, EyeOff, CheckCircle, RefreshCw } from "../../lib/icons";
import { signUp, signIn, setPendingPhoneSetup } from "../../hooks/useAuth";
import { AppAlert, useAppAlert } from "../../components/ui/AppAlert";
import { colors } from "../../constants/colors";

// ─── InputField ───────────────────────────────────────────────────────────────
interface FieldProps {
  icon: React.ComponentType<any>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboard?: any;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  borderAnim: Animated.Value;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  suffix?: React.ReactNode;
  autoCapitalize?: any;
  inputRef?: React.RefObject<TextInput | null>;
}

const InputField = memo(function InputField({
  icon: Icon, value, onChange, placeholder, secure = false, keyboard,
  focused, onFocus, onBlur, borderAnim, returnKeyType, onSubmitEditing,
  suffix, autoCapitalize, inputRef,
}: FieldProps) {
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.accent],
  });
  return (
    <Animated.View style={[s.inputWrap, { borderColor }]}>
      <Icon size={16} color={focused ? colors.accent : colors.textSub} strokeWidth={1.8} />
      <TextInput
        ref={inputRef as React.RefObject<TextInput>}
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize ?? (keyboard === "email-address" ? "none" : secure ? "none" : "words")}
        keyboardType={keyboard ?? "default"}
        autoCorrect={false}
        autoComplete="off"
        returnKeyType={returnKeyType ?? "next"}
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        blurOnSubmit={false}
      />
      {suffix}
    </Animated.View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SignupScreen() {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [step,          setStep]          = useState<1 | 2>(1);
  const [resendTimer,   setResendTimer]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [confirming,    setConfirming]    = useState(false);

  const [nameFocus,  setNameFocus]  = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus,  setPassFocus]  = useState(false);

  const { alertVisible, alertConfig, showAlert, dismissAlert } = useAppAlert();

  const cardFade    = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(24)).current;
  const nameBorder  = useRef(new Animated.Value(0)).current;
  const emailBorder = useRef(new Animated.Value(0)).current;
  const passBorder  = useRef(new Animated.Value(0)).current;

  const emailRef = useRef<TextInput>(null);
  const passRef  = useRef<TextInput>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(cardY,    { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(nameBorder,  { toValue: nameFocus  ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [nameFocus]);
  useEffect(() => {
    Animated.timing(emailBorder, { toValue: emailFocus ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [emailFocus]);
  useEffect(() => {
    Animated.timing(passBorder,  { toValue: passFocus  ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [passFocus]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  async function handleCreateAccount() {
    if (!name.trim() || !email.trim() || !password) {
      showAlert({ title: "Missing Fields", message: "Please fill in your name, email, and password.", buttons: [{ text: "Got it" }] });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      showAlert({ title: "Invalid Email", message: "Enter a valid email address.", buttons: [{ text: "OK" }] });
      return;
    }
    if (password.length < 6) {
      showAlert({ title: "Weak Password", message: "Password must be at least 6 characters.", buttons: [{ text: "OK" }] });
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      setStep(2);
      setResendTimer(60);
    } catch (e: any) {
      showAlert({
        title: "Sign Up Failed",
        message: e.message ?? "Something went wrong. Try again.",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      setResendTimer(60);
      showAlert({ title: "Email Sent", message: "A new confirmation email has been sent.", buttons: [{ text: "OK" }] });
    } catch (e: any) {
      showAlert({ title: "Resend Failed", message: e.message ?? "Try again in a moment.", buttons: [{ text: "OK" }] });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmed() {
    setConfirming(true);
    try {
      // Signal auth listener to route to phone-setup after this sign-in
      setPendingPhoneSetup();
      await signIn(email.trim(), password);
      // Auth listener takes over from here → /phone-setup
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("confirm")) {
        showAlert({
          title: "Not Confirmed Yet",
          message: "We couldn't sign you in. Please click the link in the confirmation email first, then try again.",
          buttons: [{ text: "OK" }],
        });
      } else {
        showAlert({
          title: "Sign In Failed",
          message: msg || "Please check your email and password.",
          buttons: [{ text: "OK" }],
        });
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["rgba(168,85,247,0.14)", "#0D0721", "rgba(217,70,239,0.06)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[s.orb, s.orbPurple]} />
      <View style={[s.orb, s.orbFuchsia]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Step indicator */}
            <View style={s.stepRow}>
              <View style={[s.stepDot, s.stepDotActive]} />
              <View style={[s.stepLine, step === 2 && s.stepLineActive]} />
              <View style={[s.stepDot, step === 2 && s.stepDotActive]} />
            </View>

            {/* Header */}
            <View style={s.header}>
              <LinearGradient colors={["#2D1458", "#150A32"]} style={s.shieldBg}>
                <Shield size={32} color={colors.accent} strokeWidth={1.8} />
              </LinearGradient>
              <Text style={s.title}>{step === 1 ? "Create Account" : "Check Your Email"}</Text>
              <Text style={s.sub}>
                {step === 1
                  ? "Join Neural Shield AI protection"
                  : `We sent a confirmation link to\n${email.trim()}`}
              </Text>
            </View>

            {/* Card */}
            <Animated.View style={[s.card, { opacity: cardFade, transform: [{ translateY: cardY }] }]}>
              {step === 1 ? (
                <>
                  <InputField
                    icon={User}
                    value={name}
                    onChange={setName}
                    placeholder="Full name"
                    focused={nameFocus}
                    onFocus={() => setNameFocus(true)}
                    onBlur={() => setNameFocus(false)}
                    borderAnim={nameBorder}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  <InputField
                    icon={Mail}
                    value={email}
                    onChange={setEmail}
                    placeholder="Email address"
                    keyboard="email-address"
                    focused={emailFocus}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    borderAnim={emailBorder}
                    onSubmitEditing={() => passRef.current?.focus()}
                    inputRef={emailRef}
                  />
                  <InputField
                    icon={Lock}
                    value={password}
                    onChange={setPassword}
                    placeholder="Password (6+ characters)"
                    secure={!showPass}
                    focused={passFocus}
                    onFocus={() => setPassFocus(true)}
                    onBlur={() => setPassFocus(false)}
                    borderAnim={passBorder}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateAccount}
                    autoCapitalize="none"
                    inputRef={passRef}
                    suffix={
                      <TouchableOpacity
                        onPress={() => setShowPass(v => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {showPass
                          ? <EyeOff size={16} color={colors.textSub} />
                          : <Eye    size={16} color={colors.textSub} />}
                      </TouchableOpacity>
                    }
                  />

                  <TouchableOpacity
                    onPress={handleCreateAccount}
                    disabled={loading}
                    activeOpacity={0.85}
                    style={s.ctaOuter}
                  >
                    <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                      <Text style={s.ctaText}>{loading ? "Creating account…" : "Create Account"}</Text>
                      {!loading && <ArrowRight size={18} color="#fff" strokeWidth={2} />}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.back()} style={s.bottomRow} activeOpacity={0.7}>
                    <Text style={s.bottomText}>Already have an account? </Text>
                    <Text style={s.bottomLink}>Sign in</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Email illustration */}
                  <View style={s.emailIllustration}>
                    <LinearGradient colors={["#2D1458", "#150A32"]} style={s.emailIconBg}>
                      <Mail size={32} color={colors.accent} strokeWidth={1.6} />
                    </LinearGradient>
                    <View style={s.checkBadge}>
                      <CheckCircle size={18} color={colors.success} strokeWidth={2.5} />
                    </View>
                  </View>

                  <Text style={s.confirmTitle}>Confirm your email</Text>
                  <Text style={s.confirmBody}>
                    Open the email from Neural Shield AI and click the{" "}
                    <Text style={{ color: colors.accent, fontWeight: "700" }}>Confirm your email</Text>
                    {" "}button. Then come back here.
                  </Text>

                  {/* Steps */}
                  <View style={s.stepsList}>
                    {[
                      "Open your email inbox",
                      "Find the email from Neural Shield AI",
                      "Click \"Confirm your email\"",
                      "Come back and tap the button below",
                    ].map((step, i) => (
                      <View key={i} style={s.stepItem}>
                        <View style={s.stepNum}>
                          <Text style={s.stepNumText}>{i + 1}</Text>
                        </View>
                        <Text style={s.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA */}
                  <TouchableOpacity
                    onPress={handleConfirmed}
                    disabled={confirming}
                    activeOpacity={0.85}
                    style={s.ctaOuter}
                  >
                    <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                      <Text style={s.ctaText}>{confirming ? "Signing in…" : "I've Confirmed My Email"}</Text>
                      {!confirming && <ArrowRight size={18} color="#fff" strokeWidth={2} />}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Resend */}
                  <View style={s.resendRow}>
                    {resendTimer > 0 ? (
                      <Text style={s.resendTimer}>Resend available in {resendTimer}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleResend} disabled={loading} style={s.resendBtn} activeOpacity={0.7}>
                        <RefreshCw size={13} color={colors.accent} />
                        <Text style={s.resendText}>Resend confirmation email</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => { setStep(1); }}
                    style={s.bottomRow}
                    activeOpacity={0.7}
                  >
                    <Text style={s.bottomLink}>← Change details</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AppAlert visible={alertVisible} config={alertConfig} onDismiss={dismissAlert} />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },

  orb:        { position: "absolute", borderRadius: 999 },
  orbPurple:  { width: 300, height: 300, top: -80,  left: -80,  backgroundColor: "rgba(168,85,247,0.07)" },
  orbFuchsia: { width: 220, height: 220, bottom: 60, right: -60, backgroundColor: "rgba(217,70,239,0.05)" },

  stepRow:        { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  stepDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  stepDotActive:  { backgroundColor: colors.accent, shadowColor: colors.accent, shadowRadius: 8, shadowOpacity: 0.7, elevation: 4 },
  stepLine:       { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 8, borderRadius: 1 },
  stepLineActive: { backgroundColor: colors.accent },

  header:   { alignItems: "center", marginBottom: 24 },
  shieldBg: {
    width: 68, height: 68, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", marginBottom: 14,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  sub:   { fontSize: 13, color: colors.textSub, marginTop: 6, textAlign: "center", lineHeight: 20 },

  card: {
    width: "100%", backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    padding: 22, gap: 14,
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

  bottomRow:  { flexDirection: "row", justifyContent: "center", marginTop: 2 },
  bottomText: { color: colors.textSub, fontSize: 14 },
  bottomLink: { color: colors.accent, fontSize: 14, fontWeight: "600" },

  // Step 2 — email confirmation
  emailIllustration: { alignItems: "center", marginVertical: 8 },
  emailIconBg: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
  },
  checkBadge: {
    position: "absolute", bottom: -4, right: "35%",
    backgroundColor: colors.card,
    borderRadius: 12, padding: 2,
  },

  confirmTitle: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
  confirmBody:  { fontSize: 13.5, color: colors.textSub, textAlign: "center", lineHeight: 21 },

  stepsList: { gap: 10 },
  stepItem:  { flexDirection: "row", alignItems: "center", gap: 12 },
  stepNum:   {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.accent + "50",
    alignItems: "center", justifyContent: "center",
  },
  stepNumText: { fontSize: 12, fontWeight: "800", color: colors.accent },
  stepText:    { flex: 1, fontSize: 13.5, color: colors.textSub },

  resendRow:   { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  resendBtn:   { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  resendText:  { color: colors.accent, fontSize: 13, fontWeight: "600" },
  resendTimer: { color: colors.textDim, fontSize: 13 },
});

import { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Phone, Shield, ArrowRight, CheckCircle } from "../lib/icons";
import { colors } from "../constants/colors";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { getProfile } from "../lib/api";
import { AppAlert, useAppAlert } from "../components/ui/AppAlert";

export default function PhoneSetupScreen() {
  const { setProfile } = useAuthStore();
  const [phone,   setPhone]   = useState("");
  const [focused, setFocused] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const { alertVisible, alertConfig, showAlert, dismissAlert } = useAppAlert();

  const borderAnim = useRef(new Animated.Value(0)).current;
  const shieldAnim = useRef(new Animated.Value(0)).current;
  const cardFade   = useRef(new Animated.Value(0)).current;
  const cardY      = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(shieldAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(cardFade,   { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(cardY,      { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: [colors.border, colors.accent],
  });

  function isValidPhone(p: string) {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  async function handleSave() {
    if (!phone.trim()) {
      showAlert({ title: "Phone Required", message: "A phone number is required to complete account setup.", buttons: [{ text: "OK" }] });
      return;
    }
    if (!isValidPhone(phone)) {
      showAlert({ title: "Invalid Number", message: "Please enter a valid phone number (7–15 digits).", buttons: [{ text: "OK" }] });
      return;
    }

    setSaving(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Save phone to auth user_metadata
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { phone: phone.trim() },
      });
      if (metaErr) throw metaErr;

      // Save phone to profiles table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ phone: phone.trim() })
          .eq("id", user.id);
      }

      // Refresh profile in store
      getProfile().then(p => setProfile(p)).catch(() => {});

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/permissions-setup");
    } catch (e: any) {
      showAlert({
        title: "Couldn't Save",
        message: e.message ?? "Please try again.",
        buttons: [{ text: "OK" }],
      });
    } finally {
      setSaving(false);
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
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 26 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          {/* Shield hero */}
          <Animated.View style={[s.heroWrap, { opacity: shieldAnim }]}>
            <View style={s.shieldOuter}>
              <LinearGradient colors={["#2D1458", "#150A32"]} style={s.shieldBg}>
                <Shield size={38} color={colors.accent} strokeWidth={1.8} />
              </LinearGradient>
            </View>
            <View style={s.step}>
              <Text style={s.stepText}>STEP 3 OF 3</Text>
            </View>
          </Animated.View>

          {/* Heading */}
          <Animated.View style={[s.headWrap, { opacity: cardFade, transform: [{ translateY: cardY }] }]}>
            <Text style={s.title}>One Last Step</Text>
            <Text style={s.sub}>
              Your phone number helps us secure your account and enables future
              2-factor authentication and recovery options.
            </Text>
          </Animated.View>

          {/* Card */}
          <Animated.View style={[s.card, { opacity: cardFade, transform: [{ translateY: cardY }] }]}>
            <Animated.View style={[s.inputWrap, { borderColor }]}>
              <Phone size={16} color={focused ? colors.accent : colors.textSub} strokeWidth={1.8} />
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="done"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleSave}
              />
            </Animated.View>

            <View style={s.noteRow}>
              <CheckCircle size={13} color={colors.success} />
              <Text style={s.noteText}>Used for account security only — never shared or sold</Text>
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={[s.ctaOuter, !phone.trim() && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={["#C084FC", "#7C3AED"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cta}
              >
                <Text style={s.ctaText}>{saving ? "Saving…" : "Complete Setup"}</Text>
                {!saving && <ArrowRight size={18} color="#fff" strokeWidth={2} />}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AppAlert
        visible={alertVisible}
        config={alertConfig}
        onDismiss={dismissAlert}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  orb:        { position: "absolute", borderRadius: 999 },
  orbPurple:  { width: 300, height: 300, top: -80,  left: -80,  backgroundColor: "rgba(168,85,247,0.07)" },
  orbFuchsia: { width: 220, height: 220, bottom: 60, right: -60, backgroundColor: "rgba(217,70,239,0.05)" },

  heroWrap: { alignItems: "center", marginBottom: 28 },
  shieldOuter: { alignItems: "center", justifyContent: "center", marginBottom: 14 },
  shieldBg: {
    width: 76, height: 76, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(168,85,247,0.3)",
  },
  step: { backgroundColor: colors.accentDim, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: colors.accent + "40" },
  stepText: { fontSize: 10.5, fontWeight: "800", color: colors.accent, letterSpacing: 1 },

  headWrap: { alignItems: "center", marginBottom: 26, gap: 10 },
  title: { fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  sub:   { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    padding: 22, gap: 14,
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 15,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },

  noteRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  noteText: { flex: 1, fontSize: 12.5, color: colors.textSub, lineHeight: 18 },

  ctaOuter: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  cta:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  ctaText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});

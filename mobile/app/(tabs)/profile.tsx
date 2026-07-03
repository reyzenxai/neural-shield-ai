import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Linking, Modal, Image, Pressable, Share,
  TextInput, KeyboardAvoidingView, Platform, FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Shield, Zap, Crown, ChevronRight, LogOut, Lock, HelpCircle, Star, X, Edit3, User, Mail, Phone, MapPin, Calendar, ChevronDown, Globe, ArrowRight, Download, Trash2, RefreshCw, Settings, Users } from "../../lib/icons";
import { AppAlert, useAppAlert } from "../../components/ui/AppAlert";
import { colors } from "../../constants/colors";
import { getProfile, api } from "../../lib/api";
import { useAuthStore } from "../../lib/store";
import { signOut as authSignOut } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

// ─── Reveal helper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 58, friction: 9, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}

import { AVATAR_KEY, AVATAR_OPTIONS } from "../../constants/avatar";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "free", name: "Free", price: "₹0", period: "/month", color: colors.textSub,
    features: ["5 scans/day", "Text & URL analysis", "Basic risk score", "Community reports"],
  },
  {
    id: "pro", name: "Pro", price: "₹199", period: "/month", color: colors.accent, popular: true,
    features: ["100 scans/day", "All scan types", "Screenshot OCR", "QR code analysis", "Priority support"],
  },
  {
    id: "business", name: "Business", price: "₹999", period: "/month", color: "#A78BFA",
    features: ["Unlimited scans", "REST API access", "Batch scanning", "SLA guarantee", "Dedicated support"],
  },
];

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const PLAY_STORE_ID = "com.neuralshieldai.app";


async function openSupport() {
  await Linking.openURL("mailto:support@neuralshieldai.com?subject=Neural%20Shield%20Support&body=Describe%20your%20issue%20here");
}
async function openRateApp() {
  const url    = `market://details?id=${PLAY_STORE_ID}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;
  const can    = await Linking.canOpenURL(url);
  await Linking.openURL(can ? url : webUrl);
}

const SETTINGS_ROWS = [
  { icon: Lock,       label: "Privacy Policy",    sub: "How we handle your data",    navigate: "/privacy-policy" },
  { icon: Shield,     label: "Terms & Conditions", sub: "Rules and acceptable use",   navigate: "/terms" },
  { icon: HelpCircle, label: "Help & Support",    sub: "support@neuralshieldai.com", onPress: openSupport },
  { icon: Star,       label: "Rate the App",      sub: "Share your feedback",        onPress: openRateApp },
] as const;

// ─── Avatar picker modal ──────────────────────────────────────────────────────
function AvatarModal({ visible, onClose, selected, onSelect }: {
  visible: boolean; onClose: () => void; selected: number; onSelect: (i: number) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[av.overlay, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={av.sheet}>
          <LinearGradient colors={["#101828", "#070D1A"]} style={StyleSheet.absoluteFillObject} />
          <View style={av.sheetHandle} />
          <View style={av.sheetHead}>
            <Text style={av.sheetTitle}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={onClose}><X size={18} color={colors.textSub} /></TouchableOpacity>
          </View>
          <View style={av.grid}>
            {AVATAR_OPTIONS.map((opt, i) => (
              <TouchableOpacity key={i} style={[av.cell, selected === i && av.cellActive]} onPress={() => { onSelect(i); onClose(); }} activeOpacity={0.75}>
                <View style={[av.cellBg, { backgroundColor: opt.bg }]}>
                  <Text style={av.emoji}>{opt.emoji}</Text>
                </View>
                {selected === i && <View style={av.cellCheck}><Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Date Picker ─────────────────────────────────────────────────────────────
const ITEM_H = 52;
const VISIBLE_ITEMS = 5;
const COL_H = ITEM_H * VISIBLE_ITEMS;

const DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CY     = new Date().getFullYear();
const YEARS  = Array.from({ length: CY - 1929 }, (_, i) => String(CY - 13 - i));

function WheelCol({ items, selected, onSelect }: {
  items: string[]; selected: string; onSelect: (v: string) => void;
}) {
  const ref    = useRef<FlatList>(null);
  const selIdx = Math.max(0, items.indexOf(selected));

  useEffect(() => {
    setTimeout(() => ref.current?.scrollToIndex({ index: selIdx, animated: false }), 80);
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_H, offset: ITEM_H * index, index,
  }), []);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    if (items[clamped] !== selected) onSelect(items[clamped]);
  }, [items, selected, onSelect]);

  return (
    <View style={dpk.colWrap}>
      {/* Selection highlight */}
      <View pointerEvents="none" style={dpk.highlight} />
      {/* Top fade */}
      <View pointerEvents="none" style={[dpk.fade, dpk.fadeTop]} />
      {/* Bottom fade */}
      <View pointerEvents="none" style={[dpk.fade, dpk.fadeBottom]} />

      <FlatList
        ref={ref}
        data={items}
        keyExtractor={v => v}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        onScrollEndDrag={onScroll}
        ListHeaderComponent={<View style={{ height: ITEM_H * 2 }} />}
        ListFooterComponent={<View style={{ height: ITEM_H * 2 }} />}
        style={{ height: COL_H }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={dpk.colItem}
            activeOpacity={0.7}
            onPress={() => {
              const idx = items.indexOf(item);
              ref.current?.scrollToIndex({ index: idx, animated: true });
              onSelect(item);
            }}
          >
            <Text style={[dpk.colText, item === selected && dpk.colTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function DatePickerModal({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: string; onConfirm: (v: string) => void; onClose: () => void;
}) {
  const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const initDay   = parts ? parts[1] : "01";
  const initMonth = parts ? MONTHS[parseInt(parts[2], 10) - 1] ?? "Jan" : "Jan";
  const initYear  = parts ? parts[3] : String(CY - 25);

  const [day,   setDay]   = useState(initDay);
  const [month, setMonth] = useState(initMonth);
  const [year,  setYear]  = useState(YEARS.includes(initYear) ? initYear : String(CY - 25));

  useEffect(() => {
    if (visible) {
      const p = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      setDay(p ? p[1] : "01");
      setMonth(p ? MONTHS[parseInt(p[2], 10) - 1] ?? "Jan" : "Jan");
      const y = p ? p[3] : String(CY - 25);
      setYear(YEARS.includes(y) ? y : String(CY - 25));
    }
  }, [visible]);

  function confirm() {
    const mm = String(MONTHS.indexOf(month) + 1).padStart(2, "0");
    onConfirm(`${day}/${mm}/${year}`);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dpk.overlay} onPress={onClose} />
      <View style={dpk.sheet}>
        <LinearGradient colors={["#1A0D38", "#0E071D"]} style={StyleSheet.absoluteFillObject} />
        <View style={dpk.sheetHandle} />
        <Text style={dpk.sheetTitle}>Date of Birth</Text>

        <View style={dpk.colsRow}>
          {/* Day */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={dpk.colLabel}>DD</Text>
            <WheelCol items={DAYS} selected={day} onSelect={setDay} />
          </View>
          <View style={dpk.colDivider} />
          {/* Month */}
          <View style={{ flex: 1.3, alignItems: "center" }}>
            <Text style={dpk.colLabel}>MMM</Text>
            <WheelCol items={MONTHS} selected={month} onSelect={setMonth} />
          </View>
          <View style={dpk.colDivider} />
          {/* Year */}
          <View style={{ flex: 1.5, alignItems: "center" }}>
            <Text style={dpk.colLabel}>YYYY</Text>
            <WheelCol items={YEARS} selected={year} onSelect={setYear} />
          </View>
        </View>

        <Text style={dpk.preview}>
          {day} {month} {year}
        </Text>

        <View style={dpk.btnRow}>
          <TouchableOpacity style={dpk.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={dpk.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dpk.confirmBtnWrap} onPress={confirm} activeOpacity={0.85}>
            <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={dpk.confirmBtn}>
              <Text style={dpk.confirmText}>Confirm</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const dpk = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet:     { backgroundColor: "#0E071D", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, overflow: "hidden", borderWidth: 1, borderColor: "rgba(168,85,247,0.2)" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginTop: 12, marginBottom: 8 },
  sheetTitle:  { fontSize: 17, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 16 },

  colsRow:   { flexDirection: "row", paddingHorizontal: 12, alignItems: "flex-start" },
  colLabel:  { fontSize: 11, fontWeight: "700", color: "rgba(168,85,247,0.7)", letterSpacing: 1.5, marginBottom: 6 },
  colDivider:{ width: 1, height: COL_H, backgroundColor: "rgba(255,255,255,0.06)", alignSelf: "center" },

  colWrap:    { width: "100%", height: COL_H, overflow: "hidden", position: "relative" },
  highlight:  {
    position: "absolute", top: ITEM_H * 2, height: ITEM_H, left: 0, right: 0,
    backgroundColor: "rgba(168,85,247,0.12)",
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(168,85,247,0.3)",
    borderRadius: 8, zIndex: 1,
  },
  fade: { position: "absolute", left: 0, right: 0, height: ITEM_H * 2, zIndex: 2 },
  fadeTop:    { top: 0,    backgroundColor: "rgba(14,7,29,0.75)" },
  fadeBottom: { bottom: 0, backgroundColor: "rgba(14,7,29,0.75)" },

  colItem: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  colText: { fontSize: 16, color: "rgba(255,255,255,0.35)", fontWeight: "500" },
  colTextSelected: { color: "#C084FC", fontWeight: "800", fontSize: 19 },

  preview: { textAlign: "center", fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.55)", marginTop: 12, marginBottom: 20, letterSpacing: 0.5 },

  btnRow:        { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  cancelBtn:     { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  cancelText:    { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  confirmBtnWrap:{ flex: 2, borderRadius: 14, overflow: "hidden" },
  confirmBtn:    { paddingVertical: 15, alignItems: "center" },
  confirmText:   { fontSize: 15, fontWeight: "800", color: "#fff" },
});

// ─── Profile Edit modal ───────────────────────────────────────────────────────
interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

function ProfileEditModal({ visible, onClose, initialData, onSaved }: {
  visible: boolean; onClose: () => void; initialData: ProfileData; onSaved: () => void;
}) {
  const slideY    = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  const [data,          setData]          = useState<ProfileData>(initialData);
  const [saving,        setSaving]        = useState(false);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const { alertVisible, alertConfig, showAlert, dismissAlert } = useAppAlert();

  useEffect(() => {
    if (visible) {
      setData(initialData);
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideY,    { toValue: 0, tension: 62, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(slideY,    { toValue: 700, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, initialData]);

  function set(key: keyof ProfileData) {
    return (val: string) => setData(prev => ({ ...prev, [key]: val }));
  }

  function completionPct(): number {
    const fields: (keyof ProfileData)[] = ["fullName", "phone", "gender", "dateOfBirth", "city", "country"];
    const filled = fields.filter(k => data[k].trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }

  async function handleSave() {
    if (!data.fullName.trim()) {
      showAlert({ title: "Name Required", message: "Full name cannot be empty.", buttons: [{ text: "OK" }] });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name:     data.fullName.trim(),
          name:          data.fullName.trim(),
          phone:         data.phone.trim(),
          gender:        data.gender,
          date_of_birth: data.dateOfBirth.trim(),
          address: {
            street:  data.street.trim(),
            city:    data.city.trim(),
            state:   data.state.trim(),
            zip:     data.zipCode.trim(),
            country: data.country.trim(),
          },
        },
      });
      if (error) throw error;
      // Sync name and phone to profiles table (column is `name`, not `full_name`)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ name: data.fullName.trim(), phone: data.phone.trim() || null })
          .eq("id", user.id);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      showAlert({ title: "Save Failed", message: e.message ?? "Please try again.", buttons: [{ text: "OK" }] });
    } finally {
      setSaving(false);
    }
  }

  const pct = completionPct();
  const pctColor = pct >= 80 ? colors.success : pct >= 50 ? colors.warning : colors.accent;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Animated.View style={[pe.overlay, { opacity: bgOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <Animated.View style={[pe.sheet, { transform: [{ translateY: slideY }] }]}>
            <LinearGradient colors={["#1A0B3B", "#0F0820", "#0D0721"]} style={StyleSheet.absoluteFillObject} />
            <View style={pe.handle} />

            {/* Header */}
            <View style={pe.header}>
              <View style={pe.headerLeft}>
                <View style={pe.editCircle}>
                  <Edit3 size={14} color={colors.accent} />
                </View>
                <View>
                  <Text style={pe.headerTitle}>Edit Profile</Text>
                  <Text style={pe.headerSub}>{pct}% complete</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={pe.closeBtn} activeOpacity={0.7}>
                <X size={18} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            {/* Completion bar */}
            <View style={pe.completionBar}>
              <View style={[pe.completionFill, { width: `${pct}%` as any, backgroundColor: pctColor }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={pe.body}>

              {/* Personal Info */}
              <Text style={pe.sectionLabel}>PERSONAL INFO</Text>

              <View style={pe.fieldGroup}>
                <FieldRow icon={User} label="Full Name" value={data.fullName} onChange={set("fullName")} placeholder="Your full name" />
                <View style={pe.fieldSep} />
                <FieldRow icon={Mail} label="Email" value={data.email} onChange={set("email")} placeholder="email@example.com" keyboard="email-address" editable={false} />
                <View style={pe.fieldSep} />
                <FieldRow icon={Phone} label="Phone" value={data.phone} onChange={set("phone")} placeholder="+91 XXXXX XXXXX" keyboard="phone-pad" />
              </View>

              {/* Gender */}
              <Text style={[pe.sectionLabel, { marginTop: 18 }]}>GENDER</Text>
              <View style={pe.chipRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => set("gender")(g === data.gender ? "" : g)}
                    activeOpacity={0.75}
                    style={[pe.genderChip, data.gender === g && pe.genderChipActive]}
                  >
                    <Text style={[pe.genderChipText, data.gender === g && pe.genderChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date of Birth — tapping opens the wheel picker */}
              <Text style={[pe.sectionLabel, { marginTop: 18 }]}>DATE OF BIRTH</Text>
              <TouchableOpacity
                style={pe.dobRow}
                activeOpacity={0.75}
                onPress={() => setDobPickerOpen(true)}
              >
                <Calendar size={14} color={colors.textSub} />
                <Text style={pe.dobLabel}>DOB</Text>
                <Text style={[pe.dobValue, !data.dateOfBirth && { color: colors.textDim }]}>
                  {data.dateOfBirth || "DD/MM/YYYY"}
                </Text>
                <View style={{ marginLeft: "auto" }}>
                  <ChevronDown size={14} color={colors.textSub} />
                </View>
              </TouchableOpacity>

              <DatePickerModal
                visible={dobPickerOpen}
                value={data.dateOfBirth}
                onConfirm={set("dateOfBirth")}
                onClose={() => setDobPickerOpen(false)}
              />

              {/* Address */}
              <Text style={[pe.sectionLabel, { marginTop: 18 }]}>ADDRESS</Text>
              <View style={pe.fieldGroup}>
                <FieldRow icon={MapPin} label="Street" value={data.street} onChange={set("street")} placeholder="Street / Flat / Area" />
                <View style={pe.fieldSep} />
                <FieldRow icon={MapPin} label="City" value={data.city} onChange={set("city")} placeholder="City" />
                <View style={pe.fieldSep} />
                <FieldRow icon={MapPin} label="State" value={data.state} onChange={set("state")} placeholder="State / Province" />
                <View style={pe.fieldSep} />
                <FieldRow icon={MapPin} label="PIN Code" value={data.zipCode} onChange={set("zipCode")} placeholder="Postal / ZIP code" keyboard="number-pad" />
                <View style={pe.fieldSep} />
                <FieldRow icon={Globe} label="Country" value={data.country} onChange={set("country")} placeholder="Country" />
              </View>

              {/* Save */}
              <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={pe.saveBtn}>
                <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={pe.saveBtnInner}>
                  <Text style={pe.saveBtnText}>{saving ? "Saving…" : "Save Profile"}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </Animated.View>

        <AppAlert visible={alertVisible} config={alertConfig} onDismiss={dismissAlert} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Needs to be outside ProfileEditModal to avoid remount-on-render keyboard bug
function FieldRow({ icon: Icon, label, value, onChange, placeholder, keyboard, editable = true }: {
  icon: React.ComponentType<any>; label: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboard?: any; editable?: boolean;
}) {
  return (
    <View style={pe.fieldRow}>
      <Icon size={14} color={colors.textSub} />
      <Text style={pe.fieldLabel}>{label}</Text>
      <TextInput
        style={[pe.fieldInput, !editable && { color: colors.textSub }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboard ?? "default"}
        autoCorrect={false}
        autoCapitalize={keyboard === "email-address" || keyboard === "number-pad" || keyboard === "phone-pad" ? "none" : "words"}
        editable={editable}
        returnKeyType="next"
      />
    </View>
  );
}

// ─── Main Profile Screen ──────────────────────────────────────────────────────
export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const { session, avatarIndex, setAvatarIndex } = useAuthStore();
  const [signingOut,    setSigningOut]    = useState(false);
  const [avatarModal,   setAvatarModal]   = useState(false);
  const [profileModal,  setProfileModal]  = useState(false);

  // Sync store with AsyncStorage on mount (in case store was reset while app was suspended)
  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then(v => {
      if (v !== null) setAvatarIndex(parseInt(v, 10));
    });
  }, []);

  function handleSelectAvatar(i: number) {
    setAvatarIndex(i);
    AsyncStorage.setItem(AVATAR_KEY, String(i));
  }
  const { alertVisible, alertConfig, showAlert, dismissAlert } = useAppAlert();

  const email    = session?.user?.email ?? "";
  const name     = profile?.name ?? (session?.user as any)?.user_metadata?.full_name ?? email.split("@")[0] ?? "User";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const plan     = profile?.plan ?? "free";
  const used     = profile?.daily_scans_used ?? 0;
  const limit    = profile?.daily_scan_limit ?? 5;
  const usedPct  = limit > 0 ? Math.min(used / limit, 1) : 0;

  const isGoogleUser   = (session?.user as any)?.app_metadata?.provider === "google";
  const gmailAvatar    = (session?.user as any)?.user_metadata?.avatar_url as string | undefined;
  const hasCustomAvatar = avatarIndex >= 0;
  const chosenAvatar   = AVATAR_OPTIONS[Math.max(0, avatarIndex)];

  const usageWidth  = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.8)).current;
  const ringAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(avatarScale, { toValue: 1, tension: 55, friction: 8, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
    ])).start();
    Animated.timing(usageWidth, { toValue: usedPct, duration: 1200, useNativeDriver: false }).start();
  }, [usedPct]);

  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const barWidth    = usageWidth.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const barColor    = usedPct > 0.85 ? colors.danger : usedPct > 0.6 ? colors.warning : colors.accent;

  // Derive initial profile data for the edit modal
  const userMeta = (session?.user as any)?.user_metadata ?? {};
  const initialProfileData: ProfileData = {
    fullName:    name,
    email:       email,
    phone:       profile?.phone ?? userMeta.phone ?? "",
    gender:      userMeta.gender ?? "",
    dateOfBirth: userMeta.date_of_birth ?? "",
    street:      userMeta.address?.street ?? "",
    city:        userMeta.address?.city   ?? "",
    state:       userMeta.address?.state  ?? "",
    zipCode:     userMeta.address?.zip    ?? "",
    country:     userMeta.address?.country ?? "India",
  };

  // Completion: name, phone, gender, DOB, city, country
  const completionFields: (keyof ProfileData)[] = ["fullName", "phone", "gender", "dateOfBirth", "city", "country"];
  const profileIsComplete = completionFields.every(k => initialProfileData[k].trim().length > 0);

  function handleSignOut() {
    showAlert({
      title: "Sign Out",
      message: "Are you sure you want to sign out of Neural Shield AI?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out", style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try { await authSignOut(); } catch { setSigningOut(false); }
          },
        },
      ],
    });
  }

  function handleUpgradePress(pl: typeof PLANS[number]) {
    showAlert({
      title: `Upgrade to ${pl.name}`,
      message: `Get ${pl.name} for ${pl.price}/month.\n\nIn-app purchases coming soon. Contact us to upgrade manually.`,
      buttons: [
        { text: "Contact Us", onPress: openSupport },
        { text: "Cancel", style: "cancel" },
      ],
    });
  }

  async function handleDownloadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: scans } = await supabase
        .from("scans")
        .select("id, scan_type, risk_level, scam_probability, trust_score, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const exportData = {
        exported_at: new Date().toISOString(),
        account: {
          email: user.email,
          name: profile?.name ?? null,
          plan: profile?.plan ?? "free",
          member_since: profile?.created_at ?? null,
        },
        total_scans: scans?.length ?? 0,
        scans: (scans ?? []).map(s => ({
          id: s.id,
          type: s.scan_type,
          risk_level: s.risk_level,
          scam_probability: Math.round((s.scam_probability ?? 0) * 100) + "%",
          trust_score: s.trust_score,
          date: s.created_at,
        })),
      };
      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: "Neural Shield AI — Data Export",
      });
    } catch (e: any) {
      showAlert({ title: "Export Failed", message: e.message ?? "Could not export data.", buttons: [{ text: "OK" }] });
    }
  }

  function handleResetAppData() {
    showAlert({
      title: "Reset App Data",
      message: "This clears all local settings and cached preferences. Your account and scan history are NOT deleted.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset", style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(["ns_realtime_protection", "ns_permissions_granted_v1", AVATAR_KEY]);
              queryClient.clear();
              setAvatarIndex(-1);
              showAlert({ title: "Done", message: "Local app data cleared. Restart the app to apply all changes.", buttons: [{ text: "OK" }] });
            } catch (e: any) {
              showAlert({ title: "Reset Failed", message: e.message ?? "Please try again.", buttons: [{ text: "OK" }] });
            }
          },
        },
      ],
    });
  }

  function handleDeleteAccount() {
    showAlert({
      title: "Delete Account",
      message: "This will permanently delete your account and all scan history. This cannot be undone.",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever", style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("Not authenticated");
              // Delete user data from DB
              await supabase.from("scans").delete().eq("user_id", user.id);
              await supabase.from("profiles").delete().eq("id", user.id);
              // Attempt server-side auth user deletion (may not exist yet)
              try { await api.delete("/api/account"); } catch {}
              // Clear local storage
              await AsyncStorage.multiRemove(["ns_realtime_protection", "ns_permissions_granted_v1", AVATAR_KEY]);
              await authSignOut();
            } catch (e: any) {
              showAlert({ title: "Deletion Failed", message: e.message ?? "Please try again.", buttons: [{ text: "OK" }] });
            }
          },
        },
      ],
    });
  }

  return (
    <View style={p.root}>
      <LinearGradient colors={["rgba(168,85,247,0.07)", "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.3 }} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={p.scroll}>

          {/* Header */}
          <View style={p.header}>
            <Text style={p.screenTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setProfileModal(true)} style={p.editProfileBtn} activeOpacity={0.8}>
              <Edit3 size={14} color={colors.accent} />
              <Text style={p.editProfileText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar Hero */}
          <Reveal delay={0}>
            <View style={p.hero}>
              <Animated.View style={{ transform: [{ scale: avatarScale }], alignItems: "center" }}>
                <Animated.View style={[p.avatarRing, { opacity: ringOpacity }]} />
                <TouchableOpacity activeOpacity={isGoogleUser ? 1 : 0.82} onPress={() => { if (!isGoogleUser) setAvatarModal(true); }}>
                  {isGoogleUser && gmailAvatar ? (
                    <Image source={{ uri: gmailAvatar }} style={p.avatarImg} />
                  ) : hasCustomAvatar ? (
                    <LinearGradient colors={[chosenAvatar.bg, "#0A1020"]} style={p.avatar}>
                      <Text style={p.avatarEmoji}>{chosenAvatar.emoji}</Text>
                    </LinearGradient>
                  ) : (
                    <LinearGradient colors={["#1E3A5F", "#0A1020"]} style={p.avatar}>
                      <Text style={p.avatarInitials}>{initials}</Text>
                    </LinearGradient>
                  )}
                  {!isGoogleUser && (
                    <View style={p.editBadge}>
                      <Text style={p.editBadgeText}>✎</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {plan !== "free" && (
                  <View style={[p.planBadge, { backgroundColor: plan === "business" ? "#4C1D95" : colors.accentDim }]}>
                    <Crown size={10} color={plan === "business" ? "#A78BFA" : colors.accent} strokeWidth={2} />
                    <Text style={[p.planBadgeText, { color: plan === "business" ? "#A78BFA" : colors.accent }]}>{plan.toUpperCase()}</Text>
                  </View>
                )}
              </Animated.View>
              <Text style={p.heroName}>{name}</Text>
              <Text style={p.heroEmail}>{email}</Text>
              {!isGoogleUser && <Text style={p.avatarHint}>Tap avatar to customize</Text>}

              {/* Profile completion teaser — hidden once all fields filled */}
              {!profileIsComplete && (
                <TouchableOpacity onPress={() => setProfileModal(true)} style={p.completionTeaser} activeOpacity={0.85}>
                  <LinearGradient colors={["rgba(168,85,247,0.12)", "rgba(168,85,247,0.06)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
                  <Text style={p.completionTeaserText}>Complete your profile for better experience</Text>
                  <ChevronRight size={14} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          </Reveal>

          {/* Stats Row */}
          <Reveal delay={80}>
            <View style={p.statsRow}>
              {[
                { Icon: Shield, label: "Plan",        val: plan.charAt(0).toUpperCase() + plan.slice(1), color: colors.accent },
                { Icon: Zap,    label: "Scans Today", val: String(used),                                  color: colors.warning },
                { Icon: Shield, label: "Limit",       val: limit >= 9999 ? "∞" : String(limit),          color: colors.success },
              ].map(({ Icon, label, val, color }) => (
                <View key={label} style={p.stat}>
                  <LinearGradient colors={[color + "12", "transparent"]} style={StyleSheet.absoluteFillObject} />
                  <Icon size={16} color={color} strokeWidth={1.8} />
                  <Text style={[p.statVal, { color }]}>{val}</Text>
                  <Text style={p.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          {/* Usage Bar */}
          <Reveal delay={140}>
            <View style={p.usageCard}>
              <View style={p.usageHead}>
                <Text style={p.usageTitle}>Daily Usage</Text>
                <Text style={[p.usageCount, { color: barColor }]}>{used} / {limit >= 9999 ? "∞" : limit} scans</Text>
              </View>
              <View style={p.usageTrack}>
                <Animated.View style={[p.usageFill, { width: barWidth, backgroundColor: barColor }]} />
              </View>
              {plan === "free" && <Text style={p.upgradeHint}>Upgrade to Pro for 100 scans/day →</Text>}
            </View>
          </Reveal>

          {/* Plans */}
          <Reveal delay={200}>
            <Text style={p.sectionLabel}>SUBSCRIPTION PLANS</Text>
            {PLANS.map((pl) => {
              const active = plan === pl.id;
              return (
                <View key={pl.id} style={[p.planCard, active && { borderColor: pl.color + "60" }]}>
                  {active && <LinearGradient colors={[pl.color + "0E", "transparent"]} style={StyleSheet.absoluteFillObject} />}
                  <View style={p.planHead}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Text style={[p.planName, active && { color: pl.color }]}>{pl.name}</Text>
                        {(pl as any).popular && !active && (
                          <View style={[p.popularBadge, { backgroundColor: pl.color }]}>
                            <Text style={p.popularText}>POPULAR</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <Text style={[p.planPrice, { color: active ? pl.color : colors.text }]}>{pl.price}</Text>
                        <Text style={p.planPeriod}>{pl.period}</Text>
                      </View>
                    </View>
                    {active ? (
                      <View style={[p.activePill, { backgroundColor: pl.color + "18", borderColor: pl.color + "40" }]}>
                        <Text style={[p.activePillText, { color: pl.color }]}>Current</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[p.upgradePill, { backgroundColor: pl.color }]}
                        activeOpacity={0.85}
                        onPress={() => handleUpgradePress(pl)}
                      >
                        <Text style={p.upgradePillText}>Upgrade</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={p.planFeatures}>
                    {pl.features.map(f => (
                      <View key={f} style={p.featureRow}>
                        <View style={[p.featureDot, { backgroundColor: pl.color }]} />
                        <Text style={p.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </Reveal>

          {/* Settings */}
          <Reveal delay={280}>
            <Text style={[p.sectionLabel, { marginTop: 8 }]}>SETTINGS</Text>
            <View style={p.settingsCard}>
              {SETTINGS_ROWS.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[p.settingsRow, i > 0 && p.settingsBorder]}
                  activeOpacity={0.7}
                  onPress={"navigate" in row ? () => router.push(row.navigate as any) : row.onPress}
                >
                  <View style={p.settingsIcon}>
                    <row.icon size={16} color={colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={p.settingsLabel}>{row.label}</Text>
                    <Text style={p.settingsSub}>{row.sub}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textDim} strokeWidth={1.8} />
                </TouchableOpacity>
              ))}
            </View>
          </Reveal>

          {/* Data & Account */}
          <Reveal delay={310}>
            <Text style={[p.sectionLabel, { marginTop: 8 }]}>DATA & ACCOUNT</Text>
            <View style={p.settingsCard}>
              {([
                { icon: Download,   label: "Download Your Data",  sub: "Export your scans and profile as JSON", onPress: handleDownloadData,  danger: false },
                { icon: RefreshCw,  label: "Reset App Data",       sub: "Clear local settings and cache",       onPress: handleResetAppData,   danger: false },
                { icon: Trash2,     label: "Delete Account",       sub: "Permanently remove your account",      onPress: handleDeleteAccount,  danger: true  },
              ] as const).map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[p.settingsRow, i > 0 && p.settingsBorder]}
                  activeOpacity={0.7}
                  onPress={row.onPress}
                >
                  <View style={[p.settingsIcon, row.danger && p.settingsIconDanger]}>
                    <row.icon size={16} color={row.danger ? colors.danger : colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[p.settingsLabel, row.danger && { color: colors.danger }]}>{row.label}</Text>
                    <Text style={p.settingsSub}>{row.sub}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textDim} strokeWidth={1.8} />
                </TouchableOpacity>
              ))}
            </View>
          </Reveal>

          {/* Admin Panel — only visible to admins */}
          {profile?.is_admin && (
            <Reveal delay={330}>
              <Text style={[p.sectionLabel, { marginTop: 8 }]}>ADMIN</Text>
              <View style={p.settingsCard}>
                <TouchableOpacity style={p.settingsRow} activeOpacity={0.7} onPress={() => router.push("/admin" as any)}>
                  <View style={p.settingsIcon}><Users size={16} color={colors.accent} strokeWidth={1.8} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={p.settingsLabel}>Admin Panel</Text>
                    <Text style={p.settingsSub}>View users, scans and platform stats</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textDim} strokeWidth={1.8} />
                </TouchableOpacity>
              </View>
            </Reveal>
          )}

          {/* Sign Out */}
          <Reveal delay={340}>
            <TouchableOpacity style={p.signOutBtn} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.82}>
              <LogOut size={16} color={colors.danger} strokeWidth={2} />
              <Text style={p.signOutText}>{signingOut ? "Signing out…" : "Sign Out"}</Text>
            </TouchableOpacity>
            <Text style={p.versionText}>Neural Shield AI · v1.0.0</Text>
          </Reveal>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>

      <AvatarModal
        visible={avatarModal}
        onClose={() => setAvatarModal(false)}
        selected={avatarIndex}
        onSelect={handleSelectAvatar}
      />

      <ProfileEditModal
        visible={profileModal}
        onClose={() => setProfileModal(false)}
        initialData={initialProfileData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["profile"] })}
      />

      <AppAlert visible={alertVisible} config={alertConfig} onDismiss={dismissAlert} />
    </View>
  );
}

/* ── Avatar modal styles ── */
const av = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2,5,14,0.88)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0C1222",
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 40,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 20 },
  sheetHead:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  sheetTitle:  { fontSize: 19, fontWeight: "800", color: colors.text },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell:        { width: 68, height: 68, borderRadius: 20, overflow: "visible" },
  cellActive:  { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  cellBg:      { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  emoji:       { fontSize: 30 },
  cellCheck:   { position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});

/* ── Profile edit modal styles ── */
const pe = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2,3,12,0.88)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%", backgroundColor: "#0D0721",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(168,85,247,0.18)",
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginTop: 12, marginBottom: 4 },

  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.07)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  editCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center" },
  headerTitle:{ fontSize: 17, fontWeight: "800", color: colors.text },
  headerSub:  { fontSize: 12, color: colors.textSub, marginTop: 1 },
  closeBtn:   { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },

  completionBar: { height: 3, backgroundColor: colors.border, marginHorizontal: 0 },
  completionFill:{ height: 3, borderRadius: 1.5 },

  body:         { paddingHorizontal: 20, paddingTop: 18, gap: 0 },
  sectionLabel: { fontSize: 10, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 10 },

  fieldGroup: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  fieldSep:   { height: 0.5, backgroundColor: colors.border, marginLeft: 48 },
  fieldRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.textSub, width: 60 },
  fieldInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  dobRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  dobLabel:   { fontSize: 12, fontWeight: "700", color: colors.textSub, width: 60 },
  dobValue:   { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },

  chipRow:           { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  genderChip:        { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  genderChipActive:  { borderColor: colors.accent, backgroundColor: colors.accentDim },
  genderChipText:    { fontSize: 13, fontWeight: "600", color: colors.textSub },
  genderChipTextActive: { color: colors.accent },

  saveBtn:      { borderRadius: 14, overflow: "hidden", marginTop: 22 },
  saveBtnInner: { paddingVertical: 16, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});

/* ── Screen styles ── */
const p = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 18, paddingBottom: 16 },
  screenTitle:   { fontSize: 21, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  editProfileBtn:{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accentDim, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.accent + "40" },
  editProfileText:{ fontSize: 13, fontWeight: "700", color: colors.accent },

  hero:           { alignItems: "center", paddingVertical: 24, gap: 6 },
  avatarRing:     { position: "absolute", width: 106, height: 106, borderRadius: 53, borderWidth: 2, borderColor: colors.accent + "40", backgroundColor: colors.accent + "06" },
  avatarImg:      { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: colors.accent + "50" },
  avatar:         { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 28, fontWeight: "900", color: colors.text },
  avatarEmoji:    { fontSize: 38 },
  editBadge:      { position: "absolute", bottom: 0, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  editBadgeText:  { fontSize: 12, color: "#fff" },
  planBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  planBadgeText:  { fontSize: 10, fontWeight: "900" },
  heroName:       { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  heroEmail:      { fontSize: 13, color: colors.textSub },
  avatarHint:     { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  completionTeaser: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.accent + "30",
    marginTop: 10, overflow: "hidden",
  },
  completionTeaserText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.textSub },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  stat:     { flex: 1, alignItems: "center", paddingVertical: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, gap: 5, overflow: "hidden" },
  statVal:   { fontSize: 17, fontWeight: "900" },
  statLabel: { fontSize: 10, color: colors.textSub, fontWeight: "600" },

  usageCard:   { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 22 },
  usageHead:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  usageTitle:  { fontSize: 13.5, fontWeight: "700", color: colors.text },
  usageCount:  { fontSize: 13.5, fontWeight: "800" },
  usageTrack:  { height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: "hidden" },
  usageFill:   { height: 6, borderRadius: 3 },
  upgradeHint: { fontSize: 12, color: colors.accent, marginTop: 10, fontWeight: "600" },

  sectionLabel: { fontSize: 10.5, fontWeight: "800", color: colors.textSub, letterSpacing: 1.2, marginBottom: 12 },

  planCard:    { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1.2, borderColor: colors.border, padding: 18, marginBottom: 12, overflow: "hidden" },
  popularBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  popularText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  planHead:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  planName:    { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 4 },
  planPrice:   { fontSize: 24, fontWeight: "900" },
  planPeriod:  { fontSize: 13, color: colors.textSub },
  activePill:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  activePillText:  { fontSize: 12, fontWeight: "800" },
  upgradePill:     { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  upgradePillText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  planFeatures:{ gap: 8 },
  featureRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  featureDot:  { width: 5, height: 5, borderRadius: 2.5 },
  featureText: { fontSize: 13, color: colors.textSub },

  settingsCard:       { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: "hidden" },
  settingsRow:        { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  settingsBorder:     { borderTopWidth: 0.5, borderTopColor: colors.border },
  settingsIcon:       { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentDim, alignItems: "center", justifyContent: "center" },
  settingsIconDanger: { backgroundColor: colors.danger + "15" },
  settingsLabel:      { fontSize: 14.5, fontWeight: "700", color: colors.text, marginBottom: 2 },
  settingsSub:        { fontSize: 12, color: colors.textSub },

  signOutBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.danger + "35", backgroundColor: colors.danger + "0C", marginBottom: 16 },
  signOutText: { fontSize: 15, fontWeight: "700", color: colors.danger },
  versionText: { textAlign: "center", fontSize: 11, color: colors.textFaint, marginBottom: 8 },
});

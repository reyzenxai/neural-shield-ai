import { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
  Animated, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Shield, Zap, ShieldCheck, AlertTriangle, Link2, ArrowRight } from "../lib/icons";
import { colors } from "../constants/colors";

const { width: W } = Dimensions.get("window");
const ONBOARDING_KEY = "ns_onboarding_done";

interface Slide {
  key: string;
  Icon: any;
  iconColor: string;
  iconBg: string;
  gradient: [string, string];
  title: string;
  sub: string;
  tags: string[];
}

const SLIDES: Slide[] = [
  {
    key: "1",
    Icon: Shield,
    iconColor: colors.accent,
    iconBg: "rgba(168,85,247,0.15)",
    gradient: ["rgba(168,85,247,0.12)", colors.bg],
    title: "Detect Scams Instantly",
    sub: "AI-powered analysis catches fraudulent messages, payment requests, and phishing links in seconds — before you fall victim.",
    tags: ["AI-Powered", "Real-Time", "Secure"],
  },
  {
    key: "2",
    Icon: Zap,
    iconColor: "#F59E0B",
    iconBg: "rgba(245,158,11,0.15)",
    gradient: ["rgba(245,158,11,0.08)", colors.bg],
    title: "Analyze Everything",
    sub: "Scan texts, URLs, emails, phone numbers, UPI IDs, QR codes, and screenshots with our multi-modal engine.",
    tags: ["7 Scan Types", "11 TI Sources", "Multi-layer AI"],
  },
  {
    key: "3",
    Icon: ShieldCheck,
    iconColor: colors.success,
    iconBg: "rgba(16,185,129,0.15)",
    gradient: ["rgba(16,185,129,0.08)", colors.bg],
    title: "Stay Safe Every Day",
    sub: "Get a real-time security score, threat history, and instant protection alerts — keeping you ahead of scammers.",
    tags: ["Security Score", "History", "Alerts"],
  },
];

function SlideItem({ slide, index, activeIndex }: { slide: Slide; index: number; activeIndex: number }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const glow  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (index === activeIndex) {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 58, friction: 9, useNativeDriver: true }),
      ]).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1.18, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])).start();
    } else {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [activeIndex]);

  return (
    <View style={[item.root, { width: W }]}>
      <LinearGradient colors={slide.gradient} style={StyleSheet.absoluteFillObject} />

      {/* Icon */}
      <Animated.View style={[item.iconContainer, { opacity: fade, transform: [{ scale }] }]}>
        <Animated.View style={[item.iconGlow, { backgroundColor: slide.iconBg, transform: [{ scale: glow }] }]} />
        <View style={[item.iconBox, { backgroundColor: slide.iconBg, borderColor: slide.iconColor + "30" }]}>
          <slide.Icon size={52} color={slide.iconColor} strokeWidth={1.4} />
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View style={[item.textBlock, { opacity: fade }]}>
        <Text style={item.title}>{slide.title}</Text>
        <Text style={item.sub}>{slide.sub}</Text>

        {/* Feature tags */}
        <View style={item.tags}>
          {slide.tags.map(t => (
            <View key={t} style={[item.tag, { borderColor: slide.iconColor + "40", backgroundColor: slide.iconBg }]}>
              <Text style={[item.tagText, { color: slide.iconColor }]}>{t}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList<Slide>>(null);

  useEffect(() => {
    // Entrance animation
    Animated.timing(entryFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const entryFade = useRef(new Animated.Value(0)).current;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (idx !== activeIndex) setActiveIndex(idx);
  }

  async function handleNext() {
    await Haptics.selectionAsync();
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      await finish();
    }
  }

  async function handleSkip() {
    await Haptics.selectionAsync();
    await finish();
  }

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/(auth)/login");
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <Animated.View style={[ob.root, { opacity: entryFade }]}>
      <LinearGradient colors={[colors.bg, colors.bg]} style={StyleSheet.absoluteFillObject} />

      {/* Skip */}
      <SafeAreaView style={ob.skipWrap} edges={["top"]}>
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={ob.skipBtn}>
            <Text style={ob.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={s => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        renderItem={({ item: slide, index }) => (
          <SlideItem slide={slide} index={index} activeIndex={activeIndex} />
        )}
        style={{ flex: 1 }}
      />

      {/* Bottom controls */}
      <SafeAreaView edges={["bottom"]} style={ob.bottom}>
        {/* Dots */}
        <View style={ob.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => flatRef.current?.scrollToIndex({ index: i, animated: true })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[ob.dot, i === activeIndex && ob.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity onPress={handleNext} style={ob.ctaOuter} activeOpacity={0.87}>
          <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ob.cta}>
            <Text style={ob.ctaText}>{isLast ? "Get Started" : "Next"}</Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.2} />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const item = StyleSheet.create({
  root:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, paddingTop: 60 },
  iconContainer: { alignItems: "center", marginBottom: 52 },
  iconGlow:      { position: "absolute", width: 160, height: 160, borderRadius: 80 },
  iconBox:       { width: 110, height: 110, borderRadius: 34, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  textBlock:     { alignItems: "center", gap: 16 },
  title:         { fontSize: 28, fontWeight: "900", color: colors.text, textAlign: "center", letterSpacing: -0.6, lineHeight: 34 },
  sub:           { fontSize: 15, color: colors.textSub, textAlign: "center", lineHeight: 24, paddingHorizontal: 8 },
  tags:          { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  tag:           { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  tagText:       { fontSize: 12, fontWeight: "700" },
});

const ob = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  skipWrap:{ position: "absolute", top: 0, right: 0, zIndex: 10, padding: 20 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  skipText:{ fontSize: 14, color: colors.textSub, fontWeight: "600" },

  bottom:   { paddingHorizontal: 28, paddingBottom: 16, gap: 28 },
  dots:     { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 4 },
  dot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.border },
  dotActive:{ width: 22, backgroundColor: colors.accent },

  ctaOuter: { borderRadius: 18, overflow: "hidden" },
  cta:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  ctaText:  { color: "#fff", fontSize: 17, fontWeight: "800" },
});

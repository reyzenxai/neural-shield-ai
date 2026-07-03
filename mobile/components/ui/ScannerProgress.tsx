import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../constants/colors";

const { width: W } = Dimensions.get("window");

const STEPS = [
  { label: "Rules Engine",        sub: "Pattern matching & heuristics",  icon: "⚡", dur: 0.8  },
  { label: "Threat Intelligence", sub: "11 external TI collectors",       icon: "🌐", dur: 1.6  },
  { label: "Reputation Engine",   sub: "Community & database signals",    icon: "🔒", dur: 1.2  },
  { label: "Risk Scoring",        sub: "Weighted signal aggregation",     icon: "📊", dur: 1.0  },
  { label: "AI Analysis",         sub: "Advanced neural analysis",       icon: "🧠", dur: 1.4  },
  { label: "Final Report",        sub: "Generating your result",         icon: "📋", dur: 0.6  },
];

// Radar pulse ring component
function RadarRing({ delay }: { delay: number }) {
  const scale   = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function fire() {
      scale.setValue(0.3);
      opacity.setValue(0.7);
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.4, duration: 2200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 2200, useNativeDriver: true }),
      ]).start(() => setTimeout(fire, 400));
    }
    const t = setTimeout(fire, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.radarRing, { opacity, transform: [{ scale }] }]} />
  );
}

// Animated step progress bar
function StepBar({ active, done }: { active: boolean; done: boolean }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.timing(width, { toValue: 100, duration: 1500, useNativeDriver: false }).start();
    } else if (done) {
      width.setValue(100);
    } else {
      width.setValue(0);
    }
  }, [active, done]);

  if (!active && !done) return <View style={styles.barTrack}><View style={[styles.barFill, { width: "0%" }]} /></View>;

  return (
    <View style={styles.barTrack}>
      <Animated.View style={[
        styles.barFill,
        done && { backgroundColor: colors.accent },
        { width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) },
      ]} />
    </View>
  );
}

interface ScannerProgressProps { visible: boolean }

export function ScannerProgress({ visible }: ScannerProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale      = useRef(new Animated.Value(0.85)).current;
  const cardOpacity    = useRef(new Animated.Value(0)).current;
  const shieldPulse    = useRef(new Animated.Value(1)).current;
  const radarRot       = useRef(new Animated.Value(0)).current;
  const dotBlink       = useRef(new Animated.Value(1)).current;
  const stepTimer      = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setCompletedSteps([]);

      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(cardOpacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardScale,      { toValue: 1, tension: 62, friction: 9, useNativeDriver: true }),
      ]).start();

      // Shield pulse
      Animated.loop(Animated.sequence([
        Animated.timing(shieldPulse, { toValue: 1.15, duration: 700, useNativeDriver: true }),
        Animated.timing(shieldPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])).start();

      // Radar rotation
      Animated.loop(
        Animated.timing(radarRot, { toValue: 1, duration: 3000, useNativeDriver: true })
      ).start();

      // Dot blink
      Animated.loop(Animated.sequence([
        Animated.timing(dotBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(dotBlink, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])).start();

      stepTimer.current = setInterval(() => {
        setCurrentStep((prev) => {
          setCompletedSteps((c) => [...c, prev]);
          const next = prev + 1;
          if (next >= STEPS.length) { if (stepTimer.current) clearInterval(stepTimer.current); return prev; }
          return next;
        });
      }, 1600);
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(cardOpacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.spring(cardScale,      { toValue: 0.9, tension: 65, friction: 9, useNativeDriver: true }),
      ]).start();
      if (stepTimer.current) clearInterval(stepTimer.current);
    }

    return () => { if (stepTimer.current) clearInterval(stepTimer.current); };
  }, [visible]);

  if (!visible) return null;

  const radarSpin = radarRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const totalDone = completedSteps.length;
  const pct = Math.round((totalDone / STEPS.length) * 100);

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>

        {/* ── Header ── */}
        <LinearGradient
          colors={["rgba(79,128,255,0.12)", "transparent"]}
          style={styles.cardHeader}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        >
          <Animated.Text style={[styles.shieldEmoji, { transform: [{ scale: shieldPulse }] }]}>🛡️</Animated.Text>
          <Text style={styles.cardTitle}>NEURAL SHIELD AI</Text>
          <Text style={styles.cardSubtitle}>THREAT ANALYSIS ENGINE</Text>
        </LinearGradient>

        {/* ── Radar + current step ── */}
        <View style={styles.radarSection}>
          {/* Radar circle */}
          <View style={styles.radarWrap}>
            <RadarRing delay={0} />
            <RadarRing delay={733} />
            <RadarRing delay={1466} />
            {/* Outer static ring */}
            <View style={styles.radarOuter} />
            {/* Mid static ring */}
            <View style={styles.radarMid} />
            {/* Core dot */}
            <Animated.View style={[styles.radarCore, { opacity: dotBlink }]} />
            {/* Sweep arm */}
            <Animated.View style={[styles.sweepArm, { transform: [{ rotate: radarSpin }] }]}>
              <LinearGradient
                colors={["transparent", colors.primary + "60", colors.primary]}
                style={styles.sweepGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>

          {/* Current step info */}
          <View style={styles.stepInfo}>
            <Animated.View style={[styles.activeDot, { opacity: dotBlink }]} />
            <Text style={styles.stepInfoText} numberOfLines={1}>
              {STEPS[currentStep]?.label ?? "Finalizing"}
            </Text>
          </View>
        </View>

        {/* ── Overall progress bar ── */}
        <View style={styles.overallRow}>
          <Text style={styles.overallLabel}>SCAN PROGRESS</Text>
          <Text style={[styles.overallPct, { color: colors.primary }]}>{pct}%</Text>
        </View>
        <View style={styles.overallTrack}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.overallFill, { width: `${pct}%` }]}
          />
        </View>

        {/* ── Step list ── */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => {
            const isDone   = completedSteps.includes(i);
            const isActive = i === currentStep && !isDone;
            return (
              <View key={i} style={styles.stepRow}>
                {/* Indicator */}
                <View style={[
                  styles.stepDot,
                  isDone   && styles.stepDotDone,
                  isActive && styles.stepDotActive,
                ]}>
                  <Text style={styles.stepDotText}>
                    {isDone ? "✓" : isActive ? step.icon : "○"}
                  </Text>
                </View>

                {/* Text + bar */}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[
                    styles.stepLabel,
                    isDone   && styles.stepLabelDone,
                    isActive && styles.stepLabelActive,
                  ]}>{step.label}</Text>
                  <StepBar active={isActive} done={isDone} />
                </View>

                {/* Duration badge */}
                {isDone && (
                  <Text style={styles.stepDur}>{step.dur}s</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            11 TI Sources  ·  AI Engine  ·  Zero Logs
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(2,8,18,0.95)",
    alignItems: "center", justifyContent: "center",
    zIndex: 999,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    width: W * 0.88,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5, shadowRadius: 40, elevation: 30,
  },

  cardHeader: {
    alignItems: "center", paddingTop: 22, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  shieldEmoji: { fontSize: 44, marginBottom: 10 },
  cardTitle: {
    fontSize: 11, fontWeight: "900", color: colors.primary,
    letterSpacing: 3, textTransform: "uppercase",
  },
  cardSubtitle: {
    fontSize: 9.5, fontWeight: "700", color: colors.textDim,
    letterSpacing: 2, marginTop: 3,
  },

  /* Radar */
  radarSection: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, gap: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  radarWrap: {
    width: 68, height: 68,
    alignItems: "center", justifyContent: "center",
  },
  radarRing: {
    position: "absolute",
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 1.5, borderColor: colors.primary + "70",
  },
  radarOuter: {
    position: "absolute", width: 68, height: 68, borderRadius: 34,
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  radarMid: {
    position: "absolute", width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, borderColor: colors.border,
  },
  radarCore: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 8,
  },
  sweepArm: {
    position: "absolute", width: 34, height: 2,
    left: 34, top: 33,
  },
  sweepGrad: { flex: 1 },
  stepInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  activeDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 4,
  },
  stepInfoText: { fontSize: 12.5, fontWeight: "700", color: colors.text, flex: 1 },

  /* Overall progress */
  overallRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 6,
  },
  overallLabel: { fontSize: 9.5, fontWeight: "800", color: colors.textDim, letterSpacing: 1.2 },
  overallPct: { fontSize: 11, fontWeight: "900" },
  overallTrack: {
    height: 3, backgroundColor: colors.surface,
    marginHorizontal: 20, borderRadius: 2, marginBottom: 16, overflow: "hidden",
  },
  overallFill: { height: 3, borderRadius: 2 },

  /* Steps */
  steps: { paddingHorizontal: 20, gap: 11, paddingBottom: 16 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  stepDotDone: {
    backgroundColor: "rgba(34,211,238,0.15)",
    borderColor: colors.accent,
  },
  stepDotActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  stepDotText: { fontSize: 10, fontWeight: "900", color: colors.textMuted },
  stepLabel: { fontSize: 12.5, color: colors.textFaint, fontWeight: "500" },
  stepLabelDone: { color: colors.accent, fontWeight: "700" },
  stepLabelActive: { color: colors.text, fontWeight: "700" },
  stepDur: { fontSize: 10, color: colors.textDim, fontWeight: "700", marginTop: 4 },

  /* Bar */
  barTrack: { height: 3, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden" },
  barFill: {
    height: 3, borderRadius: 2,
    backgroundColor: colors.primary,
  },

  /* Footer */
  footer: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: 12, alignItems: "center",
  },
  footerText: { fontSize: 9.5, color: colors.textDim, fontWeight: "600", letterSpacing: 1 },
});

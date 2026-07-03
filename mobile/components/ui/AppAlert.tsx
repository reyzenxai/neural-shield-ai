import { useRef, useEffect, useState, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../constants/colors";

export interface AlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AppAlertProps {
  visible: boolean;
  config: AlertConfig | null;
  onDismiss: () => void;
}

export function AppAlert({ visible, config, onDismiss }: AppAlertProps) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(cardFade,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bgOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.92, duration: 140, useNativeDriver: true }),
        Animated.timing(cardFade,  { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!config) return null;

  const buttons = config.buttons ?? [{ text: "OK" }];
  const stacked  = buttons.length > 2;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View style={[a.backdrop, { opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        <Animated.View style={[a.card, { opacity: cardFade, transform: [{ scale: cardScale }] }]}>
          <LinearGradient colors={["#1A0D38", "#0E071D"]} style={StyleSheet.absoluteFillObject} />

          {/* Accent line */}
          <LinearGradient colors={["#C084FC", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={a.accentBar} />

          <View style={a.body}>
            <Text style={a.title}>{config.title}</Text>
            {!!config.message && <Text style={a.message}>{config.message}</Text>}
          </View>

          <View style={[a.btnRow, stacked && { flexDirection: "column", paddingHorizontal: 16, paddingBottom: 16, gap: 8 }]}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === "destructive";
              const isCancel      = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  style={[
                    a.btn,
                    stacked && a.btnStacked,
                    !stacked && i > 0 && { borderLeftWidth: 0.5, borderLeftColor: colors.border },
                    isDestructive && a.btnDestructive,
                  ]}
                  onPress={() => { onDismiss(); btn.onPress?.(); }}
                >
                  <Text style={[
                    a.btnText,
                    isDestructive && { color: colors.danger },
                    isCancel      && { color: colors.textSub },
                    !isDestructive && !isCancel && { color: colors.accent, fontWeight: "700" },
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export function useAppAlert() {
  const [config,  setConfig]  = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { alertVisible: visible, alertConfig: config, showAlert, dismissAlert: dismiss };
}

const a = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,1,16,0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  card: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.28)",
    overflow: "hidden",
  },
  accentBar: { height: 3 },
  body: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 18,
    gap: 10, alignItems: "center",
  },
  title:   { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
  message: { fontSize: 14, color: colors.textSub, textAlign: "center", lineHeight: 21 },

  btnRow: {
    flexDirection: "row",
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  btn: { flex: 1, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  btnStacked: {
    flex: 0, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, backgroundColor: colors.surface,
  },
  btnDestructive: { backgroundColor: "rgba(239,68,68,0.07)" },
  btnText: { fontSize: 15, fontWeight: "600", color: colors.text },
});

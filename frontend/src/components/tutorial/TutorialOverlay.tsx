import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  BackHandler,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTutorial } from "@/src/context/TutorialContext";
import { vibePillTargetRef } from "@/src/lib/tutorialRefs";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

// Visual order of the 5 People-mode bottom tabs — used to approximate the
// on-screen position of each tab icon for the soft highlight ring.
const TAB_ORDER = ["tab-today", "tab-radar", "tab-nearby", "tab-encounters", "tab-profile"];
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 88 : 66;

type Rect = { x: number; y: number; width: number; height: number };

export default function TutorialOverlay() {
  const { visible, stepIndex, steps, next, back, skip } = useTutorial();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [vibeRect, setVibeRect] = useState<Rect | null>(null);
  const step = steps[stepIndex];

  // Measure the real vibe pill (rendered on the Radar screen) only while the
  // relevant step is active — retries briefly to allow for tab navigation.
  useEffect(() => {
    if (!visible || step?.target !== "vibe-pill") {
      setVibeRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tryMeasure = () => {
      attempts += 1;
      const node: any = vibePillTargetRef.current;
      if (node && typeof node.measureInWindow === "function") {
        node.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (cancelled) return;
          if (width > 0 && height > 0) setVibeRect({ x, y, width, height });
          else if (attempts < 8) setTimeout(tryMeasure, 150);
        });
      } else if (attempts < 8) {
        setTimeout(tryMeasure, 150);
      }
    };
    tryMeasure();
    return () => {
      cancelled = true;
    };
  }, [visible, step?.target, stepIndex]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      skip();
      return true;
    });
    return () => sub.remove();
  }, [visible, skip]);

  if (!visible || !step) return null;

  // ---- Ring (highlight) geometry ----
  let ring: { x: number; y: number; r: number } | null = null;
  if (step.target && step.target.startsWith("tab-")) {
    const idx = TAB_ORDER.indexOf(step.target);
    if (idx >= 0) {
      const cx = (winW / TAB_ORDER.length) * (idx + 0.5);
      const cy = winH - TAB_BAR_HEIGHT + (Platform.OS === "ios" ? 28 : 26);
      ring = { x: cx, y: cy, r: 28 };
    }
  } else if (step.target === "vibe-pill" && vibeRect) {
    ring = {
      x: vibeRect.x + vibeRect.width / 2,
      y: vibeRect.y + vibeRect.height / 2,
      r: Math.max(vibeRect.width, vibeRect.height) / 2 + 10,
    };
  }

  // ---- Card placement ----
  let cardStyle: any = { top: winH * 0.32, marginHorizontal: spacing.xl };
  if (step.target && step.target.startsWith("tab-")) {
    cardStyle = { bottom: TAB_BAR_HEIGHT + spacing.lg, marginHorizontal: spacing.xl };
  } else if (step.target === "vibe-pill") {
    if (vibeRect) {
      const spaceBelow = winH - (vibeRect.y + vibeRect.height);
      if (spaceBelow > 260) {
        cardStyle = { top: vibeRect.y + vibeRect.height + spacing.lg, marginHorizontal: spacing.xl };
      } else {
        cardStyle = { bottom: winH - vibeRect.y + spacing.lg, marginHorizontal: spacing.xl };
      }
    } else {
      cardStyle = { top: insets.top + 140, marginHorizontal: spacing.xl };
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={skip}>
      <View style={styles.root} testID="tutorial-overlay">
        {ring && (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                left: ring.x - ring.r,
                top: ring.y - ring.r,
                width: ring.r * 2,
                height: ring.r * 2,
                borderRadius: ring.r,
              },
            ]}
          />
        )}

        <View style={[styles.card, shadow.sheet, cardStyle]} testID="tutorial-card">
          <View style={styles.cardHeader}>
            <Text style={styles.eyebrow}>{step.eyebrow}</Text>
            <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn} testID="tutorial-skip">
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {!step.target && (
            <View style={styles.iconWrap}>
              <Ionicons name={step.icon as any} size={28} color={colors.teal} />
            </View>
          )}

          <Text style={styles.headline}>{step.headline}</Text>
          {!!step.tagline && <Text style={styles.tagline}>{step.tagline}</Text>}
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.footerRow}>
            <View style={styles.dotsRow}>
              {steps.map((s, i) => (
                <View key={s.id} style={[styles.dot, i === stepIndex && styles.dotActive]} />
              ))}
            </View>
            <Text style={styles.stepCount}>
              {stepIndex + 1} of {steps.length}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            {stepIndex > 0 ? (
              <Pressable onPress={back} hitSlop={10} style={styles.backBtn} testID="tutorial-back">
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
            <Pressable onPress={next} style={styles.primaryBtn} testID="tutorial-primary">
              <Text style={styles.primaryText}>{step.primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)" },
  ring: {
    position: "absolute",
    borderWidth: 3,
    borderColor: colors.teal,
    backgroundColor: "rgba(32,178,170,0.14)",
  },
  card: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: colors.teal, fontSize: font.sm, fontWeight: "800", letterSpacing: 1 },
  skipBtn: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center", paddingLeft: spacing.md },
  skipText: { color: colors.textTertiary, fontSize: font.base, fontWeight: "700" },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  headline: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginTop: spacing.md },
  tagline: { color: colors.orange, fontSize: font.base, fontWeight: "700", marginTop: 4 },
  body: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, marginTop: spacing.sm },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
  },
  dotsRow: { flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.teal, width: 16 },
  stepCount: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600" },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  primaryBtn: {
    flex: 1,
    marginLeft: spacing.md,
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: font.lg, fontWeight: "800" },
});

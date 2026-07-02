import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LogoMark } from "@/src/components/Logo";
import { colors, spacing, radius, font } from "@/src/theme";

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.container} testID="onboarding-screen">
      <View style={styles.hero}>
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringMid]} />
        <View style={[styles.ring, styles.ringInner]} />
        <View style={styles.accentDot} />
        <View style={styles.accentDotSmall} />
        <LogoMark size={116} />
        <Text style={styles.brand}>Intro</Text>
        <Text style={styles.tagline}>Your 50-metre social radar</Text>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.title}>Real connections,{"\n"}right where you are.</Text>
        <Text style={styles.sub}>
          Share your vibe with people within 50 metres and let serendipity spark a
          face-to-face conversation.
        </Text>
        <Pressable
          testID="onboarding-get-started"
          style={styles.primaryBtn}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.primaryText}>Get Started</Text>
        </Pressable>
        <Pressable
          testID="onboarding-login"
          style={styles.secondaryBtn}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.secondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const RING = (size: number) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, justifyContent: "space-between" },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
  },
  ringOuter: { ...RING(480), opacity: 0.12 },
  ringMid: { ...RING(340), opacity: 0.2 },
  ringInner: { ...RING(210), opacity: 0.3 },
  accentDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    top: "22%",
    right: "24%",
  },
  accentDotSmall: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandPrimary,
    bottom: "18%",
    left: "20%",
    opacity: 0.7,
  },
  brand: {
    color: colors.onSurface,
    fontSize: 40,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: spacing.lg,
  },
  tagline: {
    color: colors.brand,
    fontSize: font.base,
    fontWeight: "500",
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  bottom: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  title: { color: colors.onSurface, fontSize: font.display, fontWeight: "500", lineHeight: 42 },
  sub: {
    color: colors.onSurfaceTertiary,
    fontSize: font.lg,
    lineHeight: 24,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  primaryText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "600" },
  secondaryBtn: { paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.xs },
  secondaryText: { color: colors.onSurfaceTertiary, fontSize: font.base },
});

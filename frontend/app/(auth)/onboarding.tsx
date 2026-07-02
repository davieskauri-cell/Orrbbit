import React from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, spacing, radius, font } from "@/src/theme";

const { height } = Dimensions.get("window");
const BG =
  "https://images.unsplash.com/photo-1709377195538-5522ed0f9e10?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjBnbG93aW5nJTIwc3BoZXJlcyUyMGJsdXJ8ZW58MHx8fHwxNzgyOTkxMTIxfDA&ixlib=rb-4.1.0&q=85";

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.container} testID="onboarding-screen">
      <Image source={{ uri: BG }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(13,17,15,0.2)", "rgba(13,17,15,0.7)", "rgba(13,17,15,0.98)"]}
        locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        <Text style={styles.brand}>Intro</Text>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.title}>Real connections,{"\n"}right where you are.</Text>
        <Text style={styles.sub}>
          Share your vibe with people nearby and let serendipity spark a face-to-face
          conversation.
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, justifyContent: "space-between" },
  top: { paddingTop: height * 0.09, paddingHorizontal: spacing.xl },
  brand: { color: colors.onSurface, fontSize: font.xl, fontWeight: "500", letterSpacing: 0.5 },
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
  primaryText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "500" },
  secondaryBtn: { paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.xs },
  secondaryText: { color: colors.onSurfaceTertiary, fontSize: font.base },
});

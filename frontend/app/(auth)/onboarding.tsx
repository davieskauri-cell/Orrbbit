import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const HERO = require("@/assets/images/onboarding-hero.jpg");

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      testID="onboarding-screen"
    >
      <View style={styles.center}>
        <View style={styles.logoRow}>
          <LogoMark size={40} />
          <Wordmark height={26} />
        </View>
        <Text style={styles.tagline}>Real people. Real moments. Right nearby.</Text>
      </View>

      <Text style={styles.headline}>Connect with the right people, events and opportunities nearby.</Text>
      <Text style={styles.sub}>
        Meet people and discover local business-hosted events — on your terms.
      </Text>

      <View style={styles.heroCard}>
        <Image source={HERO} style={styles.heroImg} contentFit="cover" transition={200} />
        <View style={styles.heroBadge}>
          <Ionicons name="location" size={14} color={colors.orange} />
          <Text style={styles.heroBadgeText}>Starts free — up to 250 m</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Pressable
          testID="onboarding-get-started"
          onPress={() => router.push("/(auth)/account-type")}
          style={styles.cta}
        >
          <Text style={styles.ctaTxt}>Get Started</Text>
        </Pressable>
        <Pressable testID="onboarding-login" onPress={() => router.push("/(auth)/login")} style={styles.loginRow} hitSlop={8}>
          <Text style={styles.loginTxt}>
            Already have an account? <Text style={styles.loginLink}>Log In</Text>
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { alignItems: "center", marginBottom: spacing.xl },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tagline: { color: colors.orange, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm },
  headline: { color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.4 },
  sub: { color: colors.textSecondary, fontSize: font.lg, lineHeight: 23, marginTop: spacing.md },
  heroCard: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.card,
    ...shadow.card,
  },
  heroImg: { width: "100%", aspectRatio: 4 / 3 },
  heroBadge: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFFF2",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    ...shadow.soft,
  },
  heroBadgeText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  cta: { backgroundColor: colors.teal, borderRadius: 16, minHeight: 54, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: "#FFF", fontSize: font.lg, fontWeight: "800" },
  loginRow: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  loginTxt: { color: colors.textSecondary, fontSize: font.base },
  loginLink: { color: colors.teal, fontWeight: "800", textDecorationLine: "underline" },
});

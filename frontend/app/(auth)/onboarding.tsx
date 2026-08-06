import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow, type } from "@/src/theme";

const HERO = require("@/assets/images/onboarding-hero.jpg");

const STEPS: { icon: string; tint: string; bg: string; text: string }[] = [
  { icon: "swap-horizontal", tint: colors.teal, bg: colors.tealSoft, text: "Choose People or Professional" },
  { icon: "options", tint: colors.orange, bg: colors.orangeSoft, text: "Set what you are looking for" },
  { icon: "radio", tint: colors.teal, bg: colors.tealSoft, text: "Discover relevant people nearby" },
  { icon: "checkmark-done", tint: colors.orange, bg: colors.orangeSoft, text: "Connect only when both people agree" },
];

const PEOPLE_VIBES = [
  { label: "Open to Chat", color: colors.teal },
  { label: "Networking", color: colors.teal },
  { label: "Coffee / Drinks", color: colors.orange },
  { label: "Relationship", color: colors.pink },
  { label: "Gym Buddy", color: colors.success },
  { label: "Events", color: colors.orange },
  { label: "Campus", color: colors.purple },
];

const PRO_VIBES = [
  { label: "Need Help", color: "#F59E0B" },
  { label: "Can Help", color: "#F59E0B" },
  { label: "Verified Professionals", color: colors.teal },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
      testID="onboarding-screen"
    >
      <View style={styles.center}>
        <LogoMark size={84} />
        <View style={{ marginTop: spacing.md }}>
          <Wordmark height={40} />
        </View>
        <Text style={styles.tagline}>Real people. Real moments. Right nearby.</Text>
      </View>

      <Text style={styles.headline}>Connect with the right people nearby.</Text>
      <Text style={styles.sub}>
        Meet people, build relationships or find trusted professional help nearby — on your terms.
      </Text>

      <View style={styles.heroCard}>
        <Image source={HERO} style={styles.heroImg} contentFit="cover" transition={200} />
        <View style={styles.heroBadge}>
          <Ionicons name="location" size={14} color={colors.orange} />
          <Text style={styles.heroBadgeText}>Starts free — up to 250 m</Text>
        </View>
      </View>

      <Text style={styles.chipsSectionLabel}>People</Text>
      <View style={styles.chipsRow}>
        {PEOPLE_VIBES.map((v) => (
          <View key={v.label} style={[styles.miniChip, { backgroundColor: v.color + "15" }]}>
            <Text style={[styles.miniChipText, { color: v.color }]}>{v.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.chipsSectionLabel}>Professional</Text>
      <View style={styles.chipsRow}>
        {PRO_VIBES.map((v) => (
          <View key={v.label} style={[styles.miniChip, { backgroundColor: v.color + "15" }]}>
            <Text style={[styles.miniChipText, { color: v.color }]}>{v.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.chipsCaption}>
        One app. Real people. Real conversations. Real opportunities nearby.
      </Text>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How Orrbbit works</Text>
        {STEPS.map((s) => (
          <View key={s.text} style={styles.stepRow}>
            <View style={[styles.stepIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={17} color={s.tint} />
            </View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
        <PrimaryButton
          testID="onboarding-get-started"
          title="Get Started"
          onPress={() => router.push("/(auth)/how-location-works")}
        />
        <SecondaryButton
          testID="onboarding-login"
          title="Log In"
          onPress={() => router.push("/(auth)/login")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { alignItems: "center", marginBottom: spacing.xxl },
  tagline: { color: colors.orange, fontSize: font.base, fontWeight: "600", marginTop: spacing.xs },
  headline: { ...type.title, maxWidth: 320 },
  sub: { ...type.body, marginTop: spacing.md, maxWidth: 340 },
  heroCard: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.card,
    ...shadow.card,
  },
  heroImg: { width: "100%", aspectRatio: 16 / 9 },
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
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: "center",
  },
  miniChip: {
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  miniChipText: { fontSize: font.sm, fontWeight: "700" },
  chipsCaption: {
    ...type.helper,
    lineHeight: 18,
    textAlign: "center",
    marginTop: spacing.lg,
    maxWidth: 300,
    alignSelf: "center",
  },
  chipsSectionLabel: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: spacing.xl,
    textTransform: "uppercase",
  },
  howCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.lg,
  },
  howTitle: { ...type.heading, marginBottom: spacing.xs },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20, fontWeight: "500", flex: 1 },
});

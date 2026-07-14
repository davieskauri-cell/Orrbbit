import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark } from "@/src/components/Logo";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const STEPS = [
  { emoji: "✨", text: "Choose your intention" },
  { emoji: "📍", text: "Become visible nearby" },
  { emoji: "👀", text: "Discover people around you" },
  { emoji: "🤝", text: "Connect only when both people agree" },
];

const MINI_VIBES = [
  { label: "Open to Chat", color: colors.teal },
  { label: "Networking", color: colors.teal },
  { label: "Coffee / Drinks", color: colors.orange },
  { label: "Relationship", color: colors.pink },
  { label: "Gym Buddy", color: colors.success },
  { label: "Need Advice", color: colors.purple },
  { label: "Opportunity", color: "#F59E0B" },
  { label: "Events", color: colors.orange },
  { label: "Campus", color: colors.purple },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      testID="onboarding-screen"
    >
      <View style={styles.center}>
        <LogoMark size={84} />
        <Text style={styles.brand}>INTRO</Text>
        <Text style={styles.tagline}>Real people. Real moments.</Text>
      </View>

      <Text style={styles.headline}>See who&apos;s nearby and open to connect.</Text>
      <Text style={styles.sub}>
        Chat, network, find advice, meet new people and discover local opportunities — all with mutual consent.
      </Text>

      <View style={styles.heroCard}>
        <Image source={{ uri: HERO }} style={styles.heroImg} contentFit="cover" transition={200} />
        <View style={styles.heroBadge}>
          <Ionicons name="location" size={14} color={colors.orange} />
          <Text style={styles.heroBadgeText}>Starts free within 50m</Text>
        </View>
      </View>

      <View style={styles.chipsRow}>
        {MINI_VIBES.map((v) => (
          <View key={v.label} style={[styles.miniChip, { backgroundColor: v.color + "15" }]}>
            <Text style={[styles.miniChipText, { color: v.color }]}>{v.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.chipsCaption}>
        One app. Real people. Real conversations. Real opportunities nearby.
      </Text>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How Intro works</Text>
        {STEPS.map((s) => (
          <View key={s.text} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Text style={styles.stepEmoji}>{s.emoji}</Text>
            </View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
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
  center: { alignItems: "center", marginBottom: spacing.xl },
  brand: { color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: 4, marginTop: spacing.md },
  tagline: { color: colors.orange, fontSize: font.base, fontWeight: "600", marginTop: 4 },
  headline: { color: colors.text, fontSize: font.xxl, fontWeight: "800", lineHeight: 33 },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm },
  heroCard: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: "hidden", ...shadow.card },
  heroImg: { width: "100%", height: 170 },
  heroBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    justifyContent: "center",
  },
  miniChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
  miniChipText: { fontSize: font.sm, fontWeight: "700" },
  chipsCaption: {
    color: colors.textSecondary,
    fontSize: font.sm,
    textAlign: "center",
    marginTop: spacing.md,
  },
  stepEmoji: { fontSize: 14 },
  howCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  howTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.xs },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "500", flex: 1 },
});

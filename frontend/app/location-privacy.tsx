import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CARDS = [
  { icon: "person", title: "You are the centre", text: "Your map shows your own location so you understand your nearby area." },
  { icon: "people", title: "Others are approximate", text: "Nearby people are shown with fuzzed locations, not exact coordinates." },
  { icon: "resize", title: "Radius depends on your plan", text: "Free users get up to 50m, Plus users get up to 100m, and Pro users get up to 500m." },
  { icon: "trail-sign", title: "No route history", text: "INTRO does not show where people have been." },
  { icon: "checkmark-done", title: "Mutual acceptance first", text: "Temporary meetup guidance only starts after both people accept." },
];

export default function LocationPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="location-privacy-screen"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={30} color={colors.teal} />
      </View>
      <Text style={styles.title}>How map privacy works</Text>
      <Text style={styles.sub}>
        INTRO shows your exact location only to you. Other people nearby are shown
        approximately so nobody can track exact movement.
      </Text>

      {CARDS.map((c) => (
        <View key={c.title} style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name={c.icon as any} size={18} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardText}>{c.text}</Text>
          </View>
        </View>
      ))}

      <PrimaryButton
        testID="privacy-got-it"
        title={next === "setup" ? "Continue" : "Got it"}
        onPress={() => (next === "setup" ? router.replace("/plans?next=setup") : router.back())}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 },
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  cardText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
});

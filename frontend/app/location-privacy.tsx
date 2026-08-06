import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CARDS = [
  { icon: "eye", title: "Visibility is optional", text: "You choose when you are visible." },
  { icon: "resize", title: "Radius depends on your plan", text: "Free users can discover people up to 250 m. Plus unlocks up to 500 m. Pro unlocks up to 1 km." },
  { icon: "lock-closed", title: "Exact locations stay hidden", text: "Your exact location is only visible to you. Others are shown approximately." },
  { icon: "time", title: "Temporary sharing", text: "Meetup location sharing ends after 15 minutes." },
  { icon: "moon", title: "Ghost Mode", text: "Go invisible anytime." },
  { icon: "expand", title: "Extended discovery stays private", text: "Even with Pro, nearby people are shown approximately, not as exact pins." },
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
      {router.canGoBack() && (
        <Pressable testID="location-privacy-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      )}
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={30} color={colors.teal} />
      </View>
      <Text style={styles.title}>You control your location</Text>
      <Text style={styles.sub}>
        Orrbbit shows your exact location only to you. Other people nearby are shown
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
        title="I understand"
        onPress={() => (next === "setup" ? router.push("/plans?next=setup") : router.back())}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  backBtn: { marginBottom: spacing.md, marginLeft: -6, width: 44, height: 44, justifyContent: "center" },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 },
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  cardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  cardText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
});

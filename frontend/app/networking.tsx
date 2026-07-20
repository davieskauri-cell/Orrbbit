import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, font } from "@/src/theme";

const PRO_VIBES = [
  "Open to Network", "Looking for Advice", "Offering Advice", "Founder Chat",
  "Hiring", "Looking for Work", "Investor Chat", "Coffee Chat",
];

const FIELDS = [
  ["briefcase", "Current role", "e.g. Product Manager"],
  ["business", "Industry", "e.g. Fintech"],
  ["search", "Looking for", "e.g. Co-founder, mentor"],
  ["hand-right", "Can help with", "e.g. Marketing, hiring"],
  ["logo-linkedin", "LinkedIn", "Profile link (placeholder)"],
  ["bulb", "Business interests", "e.g. Startups, investing"],
];

export default function NetworkingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="networking-screen"
    >
      <View style={styles.header}>
        <Pressable testID="networking-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Intro Networking</Text>
      </View>
      <Text style={styles.sub}>Know who in the room is open to networking before you approach.</Text>

      <Text style={styles.sectionTitle}>Professional vibes</Text>
      <View style={styles.chips}>
        {PRO_VIBES.map((v) => (
          <View key={v} style={styles.chip}>
            <Text style={styles.chipText}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Networking profile</Text>
      {FIELDS.map(([icon, label, hint]) => (
        <View key={label} style={styles.fieldRow}>
          <Ionicons name={icon as any} size={18} color={colors.teal} />
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldHint}>{hint}</Text>
          </View>
        </View>
      ))}

      <PrimaryButton
        testID="networking-enable"
        title="Enable Networking Mode"
        onPress={() => showAlert("Networking Mode", "Professional vibes are now suggested first. General vibes stay available.")}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21 },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: colors.tealSoft, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999 },
  chipText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  fieldLabel: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  fieldHint: { color: colors.textTertiary, fontSize: font.sm, marginTop: 1 },
});

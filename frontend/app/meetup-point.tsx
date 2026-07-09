import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const POINTS = [
  { label: "Cafe", icon: "cafe" },
  { label: "Lobby", icon: "business" },
  { label: "Reception area", icon: "desktop" },
  { label: "Event entrance", icon: "enter" },
  { label: "Coworking lounge", icon: "laptop" },
  { label: "Gym front desk", icon: "barbell" },
  { label: "Campus common area", icon: "school" },
  { label: "Public seating", icon: "people" },
  { label: "Nearby landmark", icon: "flag" },
  { label: "Other public place", icon: "location" },
];

export default function MeetupPointScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [point, setPoint] = useState<string | null>(null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="meetup-point-screen"
    >
      <View style={styles.header}>
        <Pressable testID="meetup-point-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Choose a public meetup point</Text>
      </View>
      <Text style={styles.sub}>Meet somewhere public and comfortable.</Text>

      <View style={styles.grid}>
        {POINTS.map((p) => {
          const active = point === p.label;
          return (
            <Pressable
              key={p.label}
              testID={`meetup-point-${p.label.replace(/ /g, "-")}`}
              style={[styles.tile, active && styles.tileActive]}
              onPress={() => setPoint(p.label)}
            >
              <Ionicons name={p.icon as any} size={22} color={active ? "#FFF" : colors.teal} />
              <Text style={[styles.tileText, active && { color: "#FFF" }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
        <Text style={styles.noteText}>
          Private rooms, cars, dorms and isolated areas are never used as meetup points. Exact
          addresses are never shared.
        </Text>
      </View>

      <PrimaryButton
        testID="meetup-point-continue"
        title="Continue to Temporary Location Sharing"
        disabled={!point}
        onPress={() =>
          router.replace({ pathname: "/safety-confirm", params: { userId: userId!, point: point! } })
        }
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800", flex: 1 },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: 6,
    minHeight: 76,
    justifyContent: "center",
  },
  tileActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  tileText: { color: colors.text, fontSize: font.sm, fontWeight: "700", textAlign: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  noteText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 19 },
});

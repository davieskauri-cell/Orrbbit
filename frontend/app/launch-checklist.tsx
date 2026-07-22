import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Pre-launch",
    items: [
      "⚠️ Real push notifications NOT active yet — in-app pings only. Enable Firebase / Emergent push + device builds before public store launch",
      "Pick a dense launch zone (CBD, campus, venue)",
      "Recruit 1–2 local ambassadors",
      "Seed demo users for the zone",
      "Schedule the first 100m social experiment",
      "Print QR invite posters",
    ],
  },
  {
    title: "Launch day",
    items: [
      "Activate Event Mode at the venue",
      "Monitor live metrics (pings, accepts)",
      "Collect feedback after each meetup",
      "Confirm real conversations (North Star)",
    ],
  },
  {
    title: "Post-launch",
    items: [
      "Export the post-trial report",
      "Share results with venue / campus partner",
      "Open waitlist for the next zone",
      "Debrief ambassadors and iterate",
    ],
  },
];

export default function LaunchChecklistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState<string[]>([]);
  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);

  const toggle = (i: string) =>
    setDone((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="launch-checklist-screen"
    >
      <View style={styles.header}>
        <Pressable testID="checklist-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Launch Checklist</Text>
      </View>
      <Text style={styles.sub}>Internal playbook for launching IntroU in a new zone or city.</Text>

      <View style={styles.progressWrap}>
        <View style={[styles.progressBar, { width: `${(done.length / total) * 100}%` }]} />
      </View>
      <Text style={styles.progressText} testID="checklist-progress">{done.length} of {total} complete</Text>

      {SECTIONS.map((s) => (
        <View key={s.title}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          {s.items.map((i) => {
            const isDone = done.includes(i);
            return (
              <Pressable key={i} testID={`checklist-item-${i.slice(0, 12).replace(/[^a-zA-Z0-9]+/g, "-")}`} style={styles.itemRow} onPress={() => toggle(i)}>
                <Ionicons
                  name={isDone ? "checkbox" : "square-outline"}
                  size={22}
                  color={isDone ? colors.teal : colors.textTertiary}
                />
                <Text style={[styles.itemText, isDone && { color: colors.textTertiary, textDecorationLine: "line-through" }]}>{i}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  progressWrap: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  progressBar: { height: 8, backgroundColor: colors.teal, borderRadius: 4 },
  progressText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: 6 },
  sectionTitle: { color: colors.orange, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  itemText: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1, lineHeight: 20 },
});

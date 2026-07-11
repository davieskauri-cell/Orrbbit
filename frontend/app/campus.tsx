import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useApp } from "@/src/context/AppContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function CampusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vibeMap } = useApp();
  const [campus, setCampus] = useState<any>(null);

  useEffect(() => {
    api("/campus").then(setCampus).catch(() => {});
  }, []);

  const labelFor = (key: string) =>
    key === "study_buddy" ? "Study Buddy" : vibeMap[key]?.label || key;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="campus-screen"
    >
      <View style={styles.header}>
        <Pressable testID="campus-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Intro Campus</Text>
      </View>
      <Text style={styles.sub}>
        See who on campus is open to coffee, study, advice, gym, networking or a chat.
      </Text>

      {campus && (
        <View style={styles.card}>
          <Text style={styles.campusName}>{campus.name}</Text>
          <Text style={styles.big}>{campus.active_users} active users</Text>
          {campus.vibes.map((v: any) => (
            <View key={v.key} style={styles.vibeRow}>
              <Text style={styles.vibeLabel}>{labelFor(v.key)}</Text>
              <View style={styles.barWrap}>
                <View style={[styles.bar, { width: `${Math.min(100, (v.count / 42) * 100)}%` }]} />
              </View>
              <Text style={styles.count}>{v.count}</Text>
            </View>
          ))}
        </View>
      )}

      <PrimaryButton
        testID="campus-join"
        title="Join Campus Trial"
        onPress={() => showAlert("You're in!", "You joined the University of Melbourne trial.")}
        style={{ marginTop: spacing.xl }}
      />

      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={16} color={colors.teal} />
        <Text style={styles.noteText}>
          Intro only shows approximate distance and never shows exact location before mutual
          acceptance.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg },
  campusName: { color: colors.teal, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  big: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginTop: 4, marginBottom: spacing.lg },
  vibeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 6 },
  vibeLabel: { color: colors.text, fontSize: font.sm, fontWeight: "600", width: 110 },
  barWrap: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  bar: { height: 8, backgroundColor: colors.orange, borderRadius: 4 },
  count: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", width: 26, textAlign: "right" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  noteText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 19 },
});

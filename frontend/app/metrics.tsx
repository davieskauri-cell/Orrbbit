import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMetrics } from "@/src/services/analyticsService";
import { api } from "@/src/lib/api";
import { STRINGS } from "@/src/lib/strings";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const LABELS: [string, string][] = [
  ["demo_signups", "Total demo signups"],
  ["active_users", "Active users"],
  ["vibes_selected", "Vibes selected"],
  ["pings_sent", "Pings sent"],
  ["profile_views", "Profile views"],
  ["mutual_accepts", "Mutual accepts"],
  ["meetups_started", "Meetup sessions started"],
  ["meetups_completed", "Meetup sessions completed"],
  ["reports_submitted", "Reports submitted"],
  ["blocks", "Blocks"],
  ["waitlist_signups", "Waitlist signups"],
  ["ambassador_invites", "Ambassador invites"],
  ["event_joins", "Event joins"],
];

const NS_LABELS: [string, string][] = [
  ["today", "Today"],
  ["this_week", "This week"],
  ["this_city", "This city"],
  ["this_event", "This event"],
  ["total", "Total"],
];

export default function MetricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Record<string, any>>({});
  const [northStar, setNorthStar] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = () =>
    Promise.all([
      getMetrics().then(setData).catch(() => {}),
      api("/north-star").then(setNorthStar).catch(() => {}),
    ]);
  useFocusEffect(React.useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      testID="metrics-screen"
    >
      <View style={styles.header}>
        <Pressable testID="metrics-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Test Metrics</Text>
      </View>
      <Text style={styles.sub}>Live demo data for trial partners.</Text>

      <View style={[styles.nsCard, shadow.card]} testID="north-star-card">
        <Text style={styles.nsKicker}>NORTH STAR METRIC</Text>
        <Text style={styles.nsTitle}>Confirmed Conversations</Text>
        <Text style={styles.nsNote}>{STRINGS.northStar}</Text>
        <View style={styles.nsRow}>
          {NS_LABELS.map(([key, label]) => (
            <View key={key} style={styles.nsBox} testID={`north-star-${key}`}>
              <Text style={styles.nsNum}>{northStar[key] ?? "—"}</Text>
              <Text style={styles.nsLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {LABELS.map(([key, label]) => (
          <View key={key} style={styles.box} testID={`metric-${key}`}>
            <Text style={styles.num}>{data[key] ?? "—"}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>

      {!!data.signups_by_city && (
        <>
          <Text style={styles.sectionTitle}>Signups by city</Text>
          {Object.entries(data.signups_by_city as Record<string, number>).map(([city, n]) => (
            <View key={city} style={styles.cityRow} testID={`city-signups-${city.replace(/ /g, "-")}`}>
              <Text style={styles.cityName}>{city}</Text>
              <Text style={styles.cityNum}>{n}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  box: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  num: { color: colors.orange, fontSize: font.xxl, fontWeight: "800" },
  label: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4 },
  nsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  nsKicker: { color: colors.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  nsTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginTop: 4 },
  nsNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4, marginBottom: spacing.lg, lineHeight: 18 },
  nsRow: { flexDirection: "row", gap: spacing.xs },
  nsBox: { flex: 1, backgroundColor: colors.tealSoft, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: "center" },
  nsNum: { color: colors.teal, fontSize: font.xl, fontWeight: "800" },
  nsLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  cityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cityName: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  cityNum: { color: colors.orange, fontSize: font.base, fontWeight: "800" },
});

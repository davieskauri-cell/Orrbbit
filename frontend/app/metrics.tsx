import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMetrics } from "@/src/services/analyticsService";
import { colors, spacing, radius, font } from "@/src/theme";

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
  ["conversations_confirmed", "Conversations confirmed"],
];

export default function MetricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = () => getMetrics().then(setData).catch(() => {});
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

      <View style={styles.grid}>
        {LABELS.map(([key, label]) => (
          <View key={key} style={styles.box} testID={`metric-${key}`}>
            <Text style={styles.num}>{data[key] ?? "—"}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
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
});

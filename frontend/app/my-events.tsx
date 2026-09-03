import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font, shadow } from "@/src/theme";
import { myEvents, EVENT_CATEGORY_ICONS, OrbEvent } from "@/src/services/eventService";

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function MyEvents() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ hosting: OrbEvent[]; joined: OrbEvent[]; past: OrbEvent[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => myEvents().then(setData).catch(() => setData({ hosting: [], joined: [], past: [] })), []);
  useEffect(() => { load(); }, [load]);

  const card = (ev: OrbEvent) => (
    <Pressable key={ev.id} testID={`my-event-${ev.id}`} style={[s.card, shadow.card]} onPress={() => router.push(`/event/${ev.id}`)}>
      <View style={s.iconWrap}><Ionicons name={(EVENT_CATEGORY_ICONS[ev.category] || "flame") as any} size={20} color={colors.orange} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{ev.title}</Text>
        <Text style={s.meta}>{when(ev.start_datetime)} · {ev.going} going{ev.status === "cancelled" ? " · CANCELLED" : ev.status === "completed" ? " · Completed" : ""}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );

  const section = (label: string, rows: OrbEvent[]) => (
    <View key={label}>
      <Text style={s.section}>{label}</Text>
      {rows.length === 0 ? <Text style={s.empty}>Nothing here yet.</Text> : rows.map(card)}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={s.headerTitle}>My Events</Text>
        <Pressable testID="my-events-create" onPress={() => router.push("/create-event")} hitSlop={10}><Ionicons name="add-circle" size={26} color={colors.orange} /></Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.teal} />}
      >
        {data && section("Hosting", data.hosting)}
        {data && section("Joined", data.joined)}
        {data && section("Past", data.past)}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  section: { color: colors.textSecondary, fontSize: font.micro, fontWeight: "800", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: 8, textTransform: "uppercase" },
  empty: { color: colors.textTertiary, fontSize: font.sm, marginBottom: 8 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, marginBottom: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontWeight: "700", fontSize: font.base },
  meta: { color: colors.textSecondary, fontSize: font.micro, marginTop: 2 },
});

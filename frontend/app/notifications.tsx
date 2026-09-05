import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { api } from "@/src/lib/api";

type Notif = { id: string; type: string; title: string; body: string; read?: boolean; created_at: string; event_id?: string };
const FILTERS = ["All", "Event Updates", "Your Events", "Other"];
const EVENT_TYPES = ["event_join_request", "event_joined", "event_left", "event_full", "event_almost_full"];
const UPDATE_TYPES = ["event_accepted", "event_updated", "event_cancelled"];

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notif[] | null>(null);
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: Notif[] }>("/notifications");
      setItems(r.items);
      await api("/notifications/read", { method: "POST" }); // opening the centre marks read
    } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = (items || []).filter((n) => {
    if (filter === "All") return true;
    if (filter === "Event Updates") return UPDATE_TYPES.includes(n.type);
    if (filter === "Your Events") return EVENT_TYPES.includes(n.type);
    return !UPDATE_TYPES.includes(n.type) && !EVENT_TYPES.includes(n.type);
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} testID={`notif-filter-${f}`} style={[s.fChip, filter === f && s.fChipOn]} onPress={() => setFilter(f)}>
            <Text style={[s.fTxt, filter === f && { color: "#FFF" }]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }} tintColor={colors.teal} />}
      >
        {items && shown.length === 0 && (
          <View style={s.empty} testID="notif-empty">
            <Ionicons name="notifications-off-outline" size={34} color={colors.textTertiary} />
            <Text style={s.emptyTitle}>You{"'"}re all caught up</Text>
          </View>
        )}
        {shown.map((n) => (
          <Pressable
            key={n.id}
            style={s.row}
            testID={`notif-${n.id}`}
            onPress={() => {
              // navigate by stored references — never by parsing text
              if (n.event_id) router.push(`/event/${n.event_id}`);
              else if (n.type.startsWith("verification") || n.type.startsWith("professional")) router.push("/professional/verification");
            }}
          >
            <View style={[s.dot, { backgroundColor: n.read ? colors.border : (EVENT_TYPES.includes(n.type) ? colors.teal : colors.orange) }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.title, !n.read && { fontWeight: "800" }]}>{n.title}</Text>
              <Text style={s.body}>{n.body}</Text>
              <Text style={s.time}>{ago(n.created_at)}</Text>
            </View>
            {!!n.event_id && <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} style={{ marginTop: 4 }} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, flexWrap: "wrap" },
  fChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  fChipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  fTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  title: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  body: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
  time: { color: colors.textTertiary, fontSize: font.micro, marginTop: 3 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
});

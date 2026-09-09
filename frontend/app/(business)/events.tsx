import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { myEvents, OrbEvent } from "@/src/services/eventService";

const TABS = ["Active", "Completed", "Cancelled"] as const;

export default function BusinessEvents() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");
  const [hosting, setHosting] = useState<OrbEvent[]>([]);
  const [past, setPast] = useState<OrbEvent[]>([]);

  useFocusEffect(useCallback(() => {
    myEvents().then((r) => { setHosting(r.hosting); setPast(r.past.filter((e) => e.is_host)); }).catch(() => {});
  }, []));

  const data = tab === "Active"
    ? hosting.filter((e) => e.status === "active" || e.status === "full")
    : (tab === "Completed"
      ? [...hosting, ...past].filter((e) => e.status === "completed")
      : [...hosting, ...past].filter((e) => e.status === "cancelled"));

  return (
    <View style={[st.wrap, { paddingTop: insets.top + spacing.lg }]}>
      <View style={st.headRow}>
        <Text style={st.title}>Events</Text>
        <Pressable testID="biz-events-create" onPress={() => router.push("/create-event")} style={st.newBtn}>
          <Ionicons name="add" size={16} color="#FFF" /><Text style={st.newTxt}>Create</Text>
        </Pressable>
      </View>
      <View style={st.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} testID={`biz-ev-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={[st.tabTxt, tab === t && { color: "#FFF" }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}
        ListEmptyComponent={
          tab === "Active" ? (
            <View style={st.emptyBox}>
              <Text style={st.empty}>You haven&apos;t hosted an event yet.</Text>
              <Pressable onPress={() => router.push("/create-event")} style={st.emptyBtn}>
                <Text style={st.emptyBtnTxt}>Create Your First Event</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={st.empty}>No {tab.toLowerCase()} events.</Text>
          )
        }
        renderItem={({ item: e }) => (
          <Pressable onPress={() => router.push(`/event/${e.id}`)} style={st.row}>
            <View style={st.badge}><Ionicons name="storefront" size={12} color="#FFF" /><Text style={st.badgeTxt}>BUSINESS EVENT</Text></View>
            <Text style={st.evTitle}>{e.title}</Text>
            <Text style={st.meta}>
              {e.category} · {new Date(e.start_datetime).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going
              {e.status === "cancelled" ? " · CANCELLED" : e.status === "completed" ? " · Completed" : ""}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.cobalt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  newTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  tabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  tabOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  tabTxt: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  empty: { color: colors.textTertiary, textAlign: "center", marginTop: spacing.xxl },
  emptyBox: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.xl, backgroundColor: colors.card, marginTop: spacing.lg },
  emptyBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: 11, minHeight: 44, justifyContent: "center" },
  emptyBtnTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  row: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.cobalt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  badgeTxt: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  evTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 3 },
});

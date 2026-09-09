import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { myEvents, OrbEvent } from "@/src/services/eventService";

const TABS = ["Active", "Upcoming", "Completed", "Cancelled"] as const;

export default function BizEvents() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");
  const [all, setAll] = useState<OrbEvent[]>([]);

  useFocusEffect(useCallback(() => {
    myEvents().then((r) => setAll([...r.hosting, ...r.past.filter((e) => e.is_host)])).catch(() => {});
  }, []));

  const now = new Date().toISOString();
  const data = all.filter((e) =>
    tab === "Active" ? ["active", "full"].includes(e.status)
      : tab === "Upcoming" ? ["active", "full"].includes(e.status) && e.start_datetime > now
        : tab === "Completed" ? e.status === "completed" : e.status === "cancelled");

  return (
    <BizShell title="Events">
      <View style={st.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} testID={`bizev-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={[st.tabTxt, tab === t && { color: "#FFF" }]}>{t}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable testID="bizev-create" onPress={() => router.push("/business/events/create")} style={st.newBtn}>
          <Text style={st.newTxt}>+ Create Event</Text>
        </Pressable>
      </View>
      <BizCard>
        {data.length === 0 ? <Text style={st.empty}>No {tab.toLowerCase()} events.</Text> : data.map((e) => (
          <Pressable key={e.id} testID={`bizev-row-${e.id}`} onPress={() => router.push(`/business/events/${e.id}`)} style={st.row}>
            <View style={st.badge}><Text style={st.badgeTxt}>BUSINESS EVENT</Text></View>
            <Text style={st.title}>{e.title}</Text>
            <Text style={st.meta}>
              {e.category} · {new Date(e.start_datetime).toLocaleString()} · {e.going} going
              {e.capacity ? ` / ${e.capacity}` : ""} · {e.status.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface },
  tabOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  tabTxt: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  newBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  newTxt: { color: "#FFF", fontWeight: "800", fontSize: font.sm },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  badge: { alignSelf: "flex-start", backgroundColor: colors.cobalt, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4 },
  badgeTxt: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  title: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
});

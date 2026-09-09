import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font, shadow } from "@/src/theme";
import { getBusinessOverview, BizOverview } from "@/src/services/businessService";
import { myEvents, OrbEvent } from "@/src/services/eventService";

export function Stat({ label, value, icon }: { label: string; value: any; icon: string }) {
  return (
    <View style={st.stat}>
      <Ionicons name={icon as any} size={16} color={colors.cobalt} />
      <Text style={st.statVal}>{value ?? "—"}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

export function VerifBadge({ status }: { status: string }) {
  const verified = status === "Verified";
  const pending = status === "Pending Review";
  return (
    <View style={[st.vBadge, { backgroundColor: verified ? colors.tealSoft : pending ? colors.cobaltSoft : "#FEF3C7" }]}>
      <Ionicons name={verified ? "checkmark-circle" : "time-outline"} size={13} color={verified ? colors.teal : pending ? colors.cobalt : "#B45309"} />
      <Text style={[st.vBadgeTxt, { color: verified ? colors.teal : pending ? colors.cobalt : "#B45309" }]}>
        {verified ? "Verified Business" : status}
      </Text>
    </View>
  );
}

export default function BusinessHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ov, setOv] = useState<BizOverview | null>(null);
  const [upcoming, setUpcoming] = useState<OrbEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getBusinessOverview().then(setOv).catch(() => {});
    myEvents().then((r) => setUpcoming(r.hosting.filter((e) => e.status === "active" || e.status === "full").slice(0, 4))).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={st.wrap}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 600); }} />}
    >
      <Text style={st.hello}>Welcome back,</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={st.bizName} testID="biz-home-name">{ov?.business_name || "…"}</Text>
        {ov?.verified && <Ionicons name="checkmark-circle" size={20} color={colors.teal} />}
      </View>
      {ov && <View style={{ marginTop: spacing.sm }}><VerifBadge status={ov.verification_status} /></View>}

      <Pressable testID="biz-create-event" onPress={() => router.push("/create-event")} style={st.cta}>
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={st.ctaTxt}>Create Event</Text>
      </Pressable>

      <View style={st.grid}>
        <Stat label="Active Events" value={ov?.active_events} icon="flame" />
        <Stat label="Upcoming" value={ov?.upcoming_events} icon="calendar" />
        <Stat label="People Going" value={ov?.people_going} icon="people" />
        <Stat label="Event Views" value={ov?.event_views} icon="eye" />
        <Stat label="Profile Views" value={ov?.profile_views} icon="storefront" />
        <Stat label="Avg Rating" value={ov?.average_rating != null ? `${ov.average_rating} ★` : "No reviews"} icon="star" />
      </View>

      <Text style={st.section}>Upcoming Events</Text>
      {upcoming.length === 0 ? (
        <Text style={st.empty}>No active events yet — create one to reach people nearby.</Text>
      ) : upcoming.map((e) => (
        <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={[st.evRow, shadow.card]}>
          <View style={st.evIcon}><Ionicons name="storefront" size={16} color="#FFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.evTitle} numberOfLines={1}>{e.title}</Text>
            <Text style={st.evMeta}>{new Date(e.start_datetime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
      ))}

      <Text style={st.section}>Quick Actions</Text>
      <View style={st.quickRow}>
        {[
          { label: "Manage Events", icon: "calendar", path: "/(business)/events" },
          { label: "View Insights", icon: "bar-chart", path: "/(business)/insights" },
          { label: "Business Profile", icon: "storefront", path: "/(business)/profile" },
        ].map((q) => (
          <Pressable key={q.label} onPress={() => router.push(q.path as any)} style={st.quick}>
            <Ionicons name={q.icon as any} size={18} color={colors.cobalt} />
            <Text style={st.quickTxt}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hello: { color: colors.textSecondary, fontSize: font.base },
  bizName: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  vBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  vBadgeTxt: { fontSize: font.sm, fontWeight: "700" },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.cobalt, borderRadius: 16, paddingVertical: 14, marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  stat: { width: "31%", flexGrow: 1, backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, gap: 3 },
  statVal: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  statLbl: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  evRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
  evIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cobalt, alignItems: "center", justifyContent: "center" },
  evTitle: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  evMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 1 },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: { flex: 1, alignItems: "center", gap: 6, backgroundColor: colors.cobaltSoft, borderRadius: 16, paddingVertical: spacing.lg },
  quickTxt: { color: colors.cobalt, fontSize: 11, fontWeight: "700", textAlign: "center" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, font, shadow } from "@/src/theme";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { api } from "@/src/lib/api";
import { openBusinessDashboard } from "@/src/lib/businessLinks";
import { getBusinessOverview, getMyBusiness, BizOverview, Business } from "@/src/services/businessService";
import { myEvents, OrbEvent } from "@/src/services/eventService";

export function Stat({ label, value, icon }: { label: string; value: any; icon: string }) {
  return (
    <View style={st.stat}>
      <View style={st.statIcon}><Ionicons name={icon as any} size={16} color={colors.cobalt} /></View>
      <Text style={st.statVal}>{value ?? "—"}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

export function VerifBadge({ status }: { status: string }) {
  const verified = status === "Verified";
  const pending = status === "Pending Review";
  return (
    <View style={[st.vBadge, { backgroundColor: verified ? "#E7F8EE" : pending ? colors.cobaltSoft : "#FEF3C7" }]}>
      <Ionicons name={verified ? "checkmark-circle" : "time-outline"} size={13} color={verified ? colors.success : pending ? colors.cobalt : "#B45309"} />
      <Text style={[st.vBadgeTxt, { color: verified ? "#15803D" : pending ? colors.cobalt : "#B45309" }]}>
        {verified ? "Verified Business" : status}
      </Text>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning," : h < 18 ? "Good afternoon," : "Good evening,";
}

export default function BusinessHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ov, setOv] = useState<BizOverview | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [upcoming, setUpcoming] = useState<OrbEvent[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    getBusinessOverview().then(async (o) => {
      setOv(o);
      if (o.verified) {
        const seen = await AsyncStorage.getItem("biz_verified_seen");
        if (!seen) {
          await AsyncStorage.setItem("biz_verified_seen", "1");
          router.push("/(auth)/business-verified");
        }
      }
    }).catch(() => {});
    getMyBusiness().then((r) => setBiz(r.business)).catch(() => {});
    myEvents().then((r) => setUpcoming(r.hosting.filter((e) => e.status === "active" || e.status === "full").slice(0, 4))).catch(() => {});
    api<{ notifications: any[] }>("/notifications").then((r) => setActivity(r.notifications.slice(0, 4))).catch(() => {});
  }, [router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const verified = ov?.verification_status === "Verified";
  const pending = ov?.verification_status === "Pending Review";

  return (
    <ScrollView
      style={st.wrap}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setTimeout(() => setRefreshing(false), 600); }} />}
    >
      <View style={st.brandRow} testID="biz-home-brand">
        <LogoMark size={26} />
        <Wordmark height={17} />
        <View style={{ flex: 1 }} />
        <Pressable testID="biz-home-bell" onPress={() => router.push("/(business)/notifications")} hitSlop={8} style={st.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Text style={st.hello}>{greeting()}</Text>
      <View style={st.nameRow}>
        <Text style={st.bizName} testID="biz-home-name">{ov?.business_name || "…"}</Text>
        {verified && <Ionicons name="checkmark-circle" size={22} color={colors.teal} />}
      </View>
      {biz && (
        <View style={st.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
          <Text style={st.metaTxt} numberOfLines={1}>{biz.location_display}{biz.category ? ` · ${biz.category}` : ""}</Text>
        </View>
      )}

      {ov && (
        <View style={[st.vCard, { backgroundColor: verified ? "#E7F8EE" : pending ? colors.cobaltSoft : "#FEF3C7" }]}>
          <View style={[st.vIcon, { backgroundColor: verified ? colors.success : pending ? colors.cobalt : colors.warning }]}>
            <Ionicons name={verified ? "shield-checkmark" : "time"} size={16} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.vLbl}>Verification Status</Text>
            <Text style={[st.vVal, { color: verified ? "#15803D" : pending ? colors.cobalt : "#B45309" }]}>
              {ov.verification_status}
            </Text>
          </View>
        </View>
      )}

      <View style={st.grid}>
        <Stat label="Active Events" value={ov?.active_events} icon="calendar" />
        <Stat label="People Going" value={ov?.people_going} icon="people" />
        <Stat label="Event Views" value={ov?.event_views} icon="eye" />
        <Stat label="Average Rating" value={ov?.average_rating != null ? ov.average_rating : "—"} icon="star" />
      </View>

      <Pressable testID="biz-create-event" onPress={() => router.push("/create-event")} style={st.cta}>
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={st.ctaTxt}>Create Event</Text>
      </Pressable>

      <Text style={[st.section, { marginTop: spacing.xl, marginBottom: spacing.md }]}>Quick Actions</Text>
      <View style={st.quickRow}>
        {[
          { label: "Create Event", key: "create-event", icon: "add-circle-outline", onPress: () => router.push("/create-event") },
          { label: "View Profile", key: "view-profile", icon: "storefront-outline", onPress: () => router.push("/(business)/profile") },
          { label: "Open Dashboard", key: "open-dashboard", icon: "desktop-outline", onPress: openBusinessDashboard },
          { label: "View Reviews", key: "view-reviews", icon: "star-outline", onPress: () => router.push("/business-reviews") },
        ].map((q) => (
          <Pressable key={q.label} testID={`biz-quick-${q.key}`} onPress={q.onPress} style={st.quick}>
            <View style={st.quickIcon}><Ionicons name={q.icon as any} size={18} color={colors.cobalt} /></View>
            <Text style={st.quickTxt}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={st.sectionRow}>
        <Text style={st.section}>Upcoming Events</Text>
        <Pressable onPress={() => router.push("/(business)/events")} hitSlop={8}>
          <Text style={st.seeAll}>See All</Text>
        </Pressable>
      </View>
      {upcoming.length === 0 ? (
        <View style={st.emptyBox}>
          <Text style={st.empty}>You haven&apos;t hosted an event yet.</Text>
          <Pressable onPress={() => router.push("/create-event")} style={st.emptyBtn}>
            <Text style={st.emptyBtnTxt}>Create Your First Event</Text>
          </Pressable>
        </View>
      ) : upcoming.map((e) => (
        <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={[st.evRow, shadow.soft]}>
          {e.cover_image
            ? <Image source={{ uri: e.cover_image }} style={st.evThumb} />
            : <View style={[st.evThumb, st.evThumbFallback]}><Ionicons name="storefront" size={18} color={colors.cobalt} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={st.evTitle} numberOfLines={1}>{e.title}</Text>
            <Text style={st.evMeta}>
              {new Date(e.start_datetime).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
      ))}

      <View style={st.sectionRow}>
        <Text style={st.section}>Recent Activity</Text>
        <Pressable onPress={() => router.push("/(business)/notifications")} hitSlop={8}>
          <Text style={st.seeAll}>See All</Text>
        </Pressable>
      </View>
      {activity.length === 0 ? (
        <View style={st.emptyBox}>
          <Text style={st.empty}>Attendee activity, reviews and verification updates appear here.</Text>
        </View>
      ) : activity.map((n) => {
        const t = String(n.type || "");
        const look = t.includes("review") ? { icon: "star", color: "#B45309", bg: "#FEF3C7" }
          : t.includes("verification") ? { icon: "shield-checkmark", color: colors.purple, bg: "#F1EBFE" }
            : t.includes("cancel") || t.includes("full") ? { icon: "alert-circle", color: "#DC2626", bg: "#FEE2E2" }
              : { icon: "person-add", color: colors.orange, bg: colors.orangeSoft };
        return (
          <View key={n.id} style={st.actRow}>
            <View style={[st.actIcon, { backgroundColor: look.bg }]}>
              <Ionicons name={look.icon as any} size={14} color={look.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.actTxt} numberOfLines={2}>{n.title || n.message}</Text>
              <Text style={st.actMeta}>{String(n.created_at || "").slice(0, 16).replace("T", " ")}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  bell: { minWidth: 44, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  hello: { color: colors.textSecondary, fontSize: font.base },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  bizName: { color: colors.text, fontSize: font.xxl, fontWeight: "800", letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  metaTxt: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  vBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  vBadgeTxt: { fontSize: font.sm, fontWeight: "700" },
  vCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg },
  vIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  vLbl: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  vVal: { fontSize: font.base, fontWeight: "800", marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  stat: { width: "47%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal: { color: colors.text, fontSize: 22, fontWeight: "800" },
  statLbl: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.cobalt, borderRadius: 16, minHeight: 52, marginTop: spacing.lg },
  ctaTxt: { color: "#FFF", fontSize: font.lg, fontWeight: "800" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  seeAll: { color: colors.cobalt, fontSize: font.sm, fontWeight: "700" },
  emptyBox: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.xl, backgroundColor: colors.card },
  empty: { color: colors.textSecondary, fontSize: font.base, textAlign: "center" },
  emptyBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: 11, minHeight: 44, justifyContent: "center" },
  emptyBtnTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  evRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md, marginBottom: spacing.sm },
  evThumb: { width: 52, height: 52, borderRadius: 12 },
  evThumbFallback: { backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" },
  evTitle: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  evMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: { flex: 1, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: spacing.md, backgroundColor: colors.surface, minHeight: 72 },
  quickIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" },
  quickTxt: { color: colors.text, fontSize: 10, fontWeight: "700", textAlign: "center", paddingHorizontal: 2 },
  actRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.card },
  actIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  actTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600", lineHeight: 18 },
  actMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
});

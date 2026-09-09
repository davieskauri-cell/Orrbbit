import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image, useWindowDimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard, BizStat } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { api } from "@/src/lib/api";
import { getBusinessOverview, getMyBusiness, BizOverview, Business } from "@/src/services/businessService";
import { myEvents, OrbEvent } from "@/src/services/eventService";

function notifStyle(type: string): { icon: string; color: string; bg: string } {
  if (type.includes("review")) return { icon: "star", color: "#B45309", bg: "#FEF3C7" };
  if (type.includes("verification")) return { icon: "shield-checkmark", color: colors.purple, bg: "#F1EBFE" };
  if (type.includes("full") || type.includes("cancel")) return { icon: "alert-circle", color: "#DC2626", bg: "#FEE2E2" };
  return { icon: "person-add", color: colors.orange, bg: colors.orangeSoft };
}

export default function BizDashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const twoCol = width >= 980;
  const [ov, setOv] = useState<BizOverview | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [upcoming, setUpcoming] = useState<OrbEvent[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    getBusinessOverview().then(setOv).catch(() => {});
    getMyBusiness().then((r) => setBiz(r.business)).catch(() => {});
    myEvents().then((r) => setUpcoming(r.hosting.filter((e) => ["active", "full"].includes(e.status)).slice(0, 5))).catch(() => {});
    api<{ notifications: any[] }>("/notifications").then((r) => setNotifs(r.notifications.slice(0, 6))).catch(() => {});
  }, []));

  const verified = ov?.verification_status === "Verified";

  return (
    <BizShell title="Overview">
      <View style={[st.headRow, !twoCol && { flexDirection: "column", alignItems: "flex-start", gap: spacing.lg }]}>
        <View style={{ flex: twoCol ? 1 : undefined }}>
          <Text style={st.hello}>Welcome back,</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={st.name} testID="bizdash-name">{ov?.business_name || "…"}</Text>
            {verified && <Ionicons name="checkmark-circle" size={22} color={colors.teal} />}
          </View>
          {biz && (
            <View style={st.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={st.metaTxt}>{biz.location_display}{biz.category ? ` · ${biz.category}` : ""}</Text>
            </View>
          )}
          {!verified && ov && <Text style={st.pendingNote}>Verification: {ov.verification_status}</Text>}
        </View>
        <View style={st.btnRow}>
          <Pressable onPress={() => router.push("/business/profile")} style={st.secondary}>
            <Text style={st.secondaryTxt}>View Public Profile</Text>
          </Pressable>
          <Pressable testID="bizdash-create" onPress={() => router.push("/business/events/create")} style={st.primary}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={st.primaryTxt}>Create Event</Text>
          </Pressable>
        </View>
      </View>

      <View style={st.grid}>
        <BizStat label="Active Events" value={ov?.active_events} icon="calendar-outline" />
        <BizStat label="People Going" value={ov?.people_going} icon="people-outline" />
        <BizStat label="Event Views" value={ov?.event_views} icon="eye-outline" />
        <BizStat label="Average Rating" value={ov?.average_rating != null ? ov.average_rating : "—"} icon="star-outline" />
      </View>

      <View style={[st.cols, !twoCol && { flexDirection: "column" }]}>
        <BizCard style={{ flex: twoCol ? 1.5 : undefined }}>
          <View style={st.sectionRow}>
            <Text style={st.section}>Upcoming Events</Text>
            <Pressable onPress={() => router.push("/business/events")} hitSlop={8}>
              <Text style={st.seeAll}>See All</Text>
            </Pressable>
          </View>
          {upcoming.length === 0 ? (
            <View style={st.emptyBox}>
              <Text style={st.empty}>You haven&apos;t hosted an event yet.</Text>
              <Pressable onPress={() => router.push("/business/events/create")} style={st.emptyBtn}>
                <Text style={st.emptyBtnTxt}>Create Your First Event</Text>
              </Pressable>
            </View>
          ) : upcoming.map((e) => (
            <Pressable key={e.id} testID={`bizdash-ev-${e.id}`} onPress={() => router.push(`/business/events/${e.id}`)} style={st.evRow}>
              {e.cover_image
                ? <Image source={{ uri: e.cover_image }} style={st.evThumb} />
                : <View style={[st.evThumb, st.evThumbFallback]}><Ionicons name="storefront" size={18} color={colors.cobalt} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={st.rowTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={st.rowMeta}>
                  {new Date(e.start_datetime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {e.going} going
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          ))}
        </BizCard>

        <BizCard style={{ flex: twoCol ? 1 : undefined }}>
          <View style={st.sectionRow}>
            <Text style={st.section}>Recent Notifications</Text>
            <Pressable onPress={() => router.push("/business/notifications")} hitSlop={8}>
              <Text style={st.seeAll}>See All</Text>
            </Pressable>
          </View>
          {notifs.length === 0 ? (
            <Text style={st.empty}>Attendee activity, reviews and verification updates appear here.</Text>
          ) : notifs.map((n) => {
            const s = notifStyle(n.type || "");
            return (
              <View key={n.id} style={st.nRow}>
                <View style={[st.nIcon, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon as any} size={14} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.nTitle} numberOfLines={2}>{n.title || n.message}</Text>
                  <Text style={st.nMeta}>{String(n.created_at || "").slice(0, 16).replace("T", " ")}</Text>
                </View>
              </View>
            );
          })}
        </BizCard>
      </View>
    </BizShell>
  );
}

const st = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  hello: { color: colors.textSecondary, fontSize: font.sm },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  metaTxt: { color: colors.textSecondary, fontSize: font.sm },
  pendingNote: { color: colors.cobalt, fontSize: font.sm, fontWeight: "700", marginTop: 4 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primary: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 42 },
  primaryTxt: { color: "#FFF", fontWeight: "800", fontSize: font.sm },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, minHeight: 42, justifyContent: "center" },
  secondaryTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.lg },
  cols: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  seeAll: { color: colors.cobalt, fontSize: font.sm, fontWeight: "700" },
  empty: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 19 },
  emptyBox: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: spacing.xl, paddingVertical: 10, minHeight: 42, justifyContent: "center" },
  emptyBtnTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  evRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  evThumb: { width: 46, height: 46, borderRadius: 10 },
  evThumbFallback: { backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontWeight: "700", fontSize: font.base },
  rowMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  nRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  nIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  nTitle: { color: colors.text, fontSize: font.sm, fontWeight: "600", lineHeight: 18 },
  nMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
});

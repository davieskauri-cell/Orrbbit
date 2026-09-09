import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard, BizStat } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { getBusinessOverview, getBusinessReviews, BizOverview } from "@/src/services/businessService";
import { myEvents, OrbEvent } from "@/src/services/eventService";

export default function BizDashboard() {
  const router = useRouter();
  const [ov, setOv] = useState<BizOverview | null>(null);
  const [upcoming, setUpcoming] = useState<OrbEvent[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    getBusinessOverview().then(setOv).catch(() => {});
    myEvents().then((r) => setUpcoming(r.hosting.filter((e) => ["active", "full"].includes(e.status)).slice(0, 5))).catch(() => {});
    getBusinessReviews().then((r) => setReviews(r.reviews.slice(0, 3))).catch(() => {});
  }, []));

  return (
    <BizShell title="Overview">
      <BizCard>
        <Text style={st.hello}>Welcome back,</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={st.name} testID="bizdash-name">{ov?.business_name || "…"}</Text>
          {ov?.verified && <Ionicons name="checkmark-circle" size={20} color={colors.teal} />}
        </View>
        <Text style={st.verif}>{ov?.verification_status}</Text>
        <View style={st.btnRow}>
          <Pressable testID="bizdash-create" onPress={() => router.push("/business/events/create")} style={st.primary}><Text style={st.primaryTxt}>+ Create Event</Text></Pressable>
          <Pressable onPress={() => router.push("/business/events")} style={st.secondary}><Text style={st.secondaryTxt}>Manage Events</Text></Pressable>
          <Pressable onPress={() => router.push("/business/profile")} style={st.secondary}><Text style={st.secondaryTxt}>View Public Profile</Text></Pressable>
        </View>
      </BizCard>
      <View style={st.grid}>
        <BizStat label="Event Impressions" value={ov?.event_impressions} icon="radio-outline" />
        <BizStat label="Event Views" value={ov?.event_views} icon="eye-outline" />
        <BizStat label="People Going" value={ov?.people_going} icon="people-outline" />
        <BizStat label="Profile Views" value={ov?.profile_views} icon="storefront-outline" />
        <BizStat label="Average Rating" value={ov?.average_rating != null ? `${ov.average_rating} ★` : "—"} icon="star-outline" />
        <BizStat label="Active Events" value={ov?.active_events} icon="flame-outline" />
      </View>
      <BizCard>
        <Text style={st.section}>Upcoming Events</Text>
        {upcoming.length === 0 ? <Text style={st.empty}>No upcoming events.</Text> : upcoming.map((e) => (
          <Pressable key={e.id} testID={`bizdash-ev-${e.id}`} onPress={() => router.push(`/business/events/${e.id}`)} style={st.row}>
            <Text style={st.rowTitle}>{e.title}</Text>
            <Text style={st.rowMeta}>{new Date(e.start_datetime).toLocaleString()} · {e.going} going</Text>
          </Pressable>
        ))}
      </BizCard>
      <BizCard>
        <Text style={st.section}>Recent Reviews</Text>
        {reviews.length === 0 ? <Text style={st.empty}>No reviews yet.</Text> : reviews.map((r) => (
          <View key={r.id} style={st.row}>
            <Text style={{ color: "#F59E0B", fontWeight: "700" }}>{"★".repeat(r.rating)}</Text>
            <Text style={st.rowMeta}>{r.text || r.tags?.join(", ")} — {r.reviewer_name} · {r.event_title}</Text>
          </View>
        ))}
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  hello: { color: colors.textSecondary, fontSize: font.sm },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  verif: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  primary: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  primaryTxt: { color: "#FFF", fontWeight: "800", fontSize: font.sm },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  row: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { color: colors.text, fontWeight: "700", fontSize: font.base },
  rowMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
});

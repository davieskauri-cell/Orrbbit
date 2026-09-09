import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { getBusinessAnalytics, getBusinessReviews } from "@/src/services/businessService";
import { Stat } from "./index";

export default function BusinessInsights() {
  const insets = useSafeAreaInsets();
  const [a, setA] = useState<any | null>(null);
  const [rev, setRev] = useState<any | null>(null);

  useFocusEffect(useCallback(() => {
    getBusinessAnalytics().then(setA).catch(() => {});
    getBusinessReviews().then(setRev).catch(() => {});
  }, []));

  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Text style={st.title}>Insights</Text>
      <View style={st.grid}>
        <Stat label="Profile Views" value={a?.profile_views} icon="storefront" />
        <Stat label="Event Impressions" value={a?.event_impressions} icon="radio" />
        <Stat label="Event Views" value={a?.event_views} icon="eye" />
        <Stat label="People Going" value={a?.people_going} icon="people" />
        <Stat label="Events Hosted" value={a?.events_hosted} icon="calendar" />
        <Stat label="Completed" value={a?.completed_events} icon="checkmark-done" />
        <Stat label="Reviews" value={a?.review_count} icon="chatbox" />
        <Stat label="Avg Rating" value={a?.average_rating != null ? `${a.average_rating} ★` : "—"} icon="star" />
      </View>
      {a?.strongest_category && (
        <View style={st.card}><Text style={st.cardLbl}>Strongest category</Text><Text style={st.cardVal}>{a.strongest_category}</Text></View>
      )}
      {a?.top_event && (
        <View style={st.card}><Text style={st.cardLbl}>Highest-performing event</Text><Text style={st.cardVal}>{a.top_event.title}</Text><Text style={st.cardSub}>{a.top_event.views} views · {a.top_event.category}</Text></View>
      )}
      {rev && rev.review_count > 0 && (
        <View style={st.card}>
          <Text style={st.cardLbl}>Rating distribution</Text>
          {[5, 4, 3, 2, 1].map((n) => {
            const c = rev.distribution?.[String(n)] || 0;
            const pct = rev.review_count ? (c / rev.review_count) * 100 : 0;
            return (
              <View key={n} style={st.distRow}>
                <Text style={st.distLbl}>{n}★</Text>
                <View style={st.distTrack}><View style={[st.distFill, { width: `${pct}%` }]} /></View>
                <Text style={st.distCount}>{c}</Text>
              </View>
            );
          })}
        </View>
      )}
      <Text style={st.note}>Aggregate analytics only — attendee identities stay private.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg },
  cardLbl: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  cardVal: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: 4 },
  cardSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  distLbl: { color: colors.text, fontSize: font.sm, fontWeight: "700", width: 26 },
  distTrack: { flex: 1, height: 8, backgroundColor: colors.card, borderRadius: 4, overflow: "hidden" },
  distFill: { height: 8, backgroundColor: "#F59E0B", borderRadius: 4 },
  distCount: { color: colors.textSecondary, fontSize: font.sm, width: 24, textAlign: "right" },
  note: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.xl, textAlign: "center" },
});

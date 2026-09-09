import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { getBusinessReviews, reportReview } from "@/src/services/businessService";

export default function BizReviews() {
  const [data, setData] = useState<any | null>(null);
  useFocusEffect(useCallback(() => { getBusinessReviews().then(setData).catch(() => {}); }, []));

  const report = (id: string) => {
    showAlert("Report this review?", "Our moderation team will look at it. Businesses can't remove reviews themselves.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: async () => {
        try { await reportReview(id, "Reported by business owner"); showAlert("Reported", "Thanks — our team will review it."); }
        catch (e: any) { showAlert("Report", e?.message || "Could not report."); }
      } },
    ]);
  };

  return (
    <BizShell title="Reviews">
      <BizCard>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text style={st.big}>{data?.average_rating != null ? `${data.average_rating} ★` : "No reviews yet"}</Text>
          <Text style={st.sub}>{data?.review_count || 0} total</Text>
        </View>
        {[5, 4, 3, 2, 1].map((n) => {
          const c = data?.distribution?.[String(n)] || 0;
          const pct = data?.review_count ? (c / data.review_count) * 100 : 0;
          return (
            <View key={n} style={st.distRow}>
              <Text style={st.distLbl}>{n}★</Text>
              <View style={st.track}><View style={[st.fill, { width: `${pct}%` }]} /></View>
              <Text style={st.count}>{c}</Text>
            </View>
          );
        })}
      </BizCard>
      <BizCard>
        <Text style={st.section}>Recent reviews</Text>
        {(data?.reviews || []).length === 0 ? <Text style={st.empty}>Reviews from Business Event attendees appear here.</Text> :
          data.reviews.map((r: any) => (
            <View key={r.id} style={st.row}>
              <Text style={{ color: "#F59E0B", fontWeight: "800" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
              {!!r.text && <Text style={st.txt}>{r.text}</Text>}
              {!!r.tags?.length && <Text style={st.tags}>{r.tags.join(" · ")}</Text>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                <Text style={st.meta}>{r.reviewer_name} · {r.event_title} · {new Date(r.created_at).toLocaleDateString()}</Text>
                <Pressable testID={`review-report-${r.id}`} onPress={() => report(r.id)}><Text style={st.report}>Report</Text></Pressable>
              </View>
            </View>
          ))}
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  big: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.sm },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  distLbl: { color: colors.text, fontSize: font.sm, fontWeight: "700", width: 26 },
  track: { flex: 1, height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, backgroundColor: "#F59E0B" },
  count: { color: colors.textSecondary, fontSize: font.sm, width: 26, textAlign: "right" },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  txt: { color: colors.text, fontSize: font.sm, marginTop: 4, lineHeight: 19 },
  tags: { color: colors.cobalt, fontSize: 12, fontWeight: "700", marginTop: 3 },
  meta: { color: colors.textTertiary, fontSize: 11 },
  report: { color: "#DC2626", fontSize: 11, fontWeight: "800" },
});

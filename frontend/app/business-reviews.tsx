import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { getBusinessReviews, BizReview } from "@/src/services/businessService";

/** Mobile Reviews & Ratings for the business owner. */
export default function BusinessReviews() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ average_rating: number | null; review_count: number; reviews: BizReview[] } | null>(null);

  useFocusEffect(useCallback(() => {
    getBusinessReviews().then((r) => setData(r)).catch(() => {});
  }, []));

  return (
    <View style={[st.wrap, { paddingTop: insets.top + spacing.md }]}>
      <View style={st.topRow}>
        <Pressable testID="bizrev-back" onPress={() => router.back()} hitSlop={10} style={st.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Reviews & Ratings</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={st.summary}>
        <Text style={st.avg}>{data?.average_rating != null ? data.average_rating : "—"}</Text>
        <Ionicons name="star" size={18} color="#F59E0B" />
        <Text style={st.count}>{data?.review_count ?? 0} review{(data?.review_count ?? 0) === 1 ? "" : "s"} from confirmed attendees</Text>
      </View>
      <FlatList
        data={data?.reviews || []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}
        ListEmptyComponent={
          <View style={st.emptyBox}>
            <Ionicons name="star-outline" size={26} color={colors.textTertiary} />
            <Text style={st.empty}>Reviews from confirmed attendees will appear here after your events.</Text>
          </View>
        }
        renderItem={({ item: r }) => (
          <View style={st.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={st.stars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
              <Text style={st.meta}>· {new Date(r.created_at).toLocaleDateString()}</Text>
            </View>
            {!!r.text && <Text style={st.txt}>{r.text}</Text>}
            {r.tags?.length > 0 && <Text style={st.tags}>{r.tags.join(" · ")}</Text>}
            <Text style={st.meta}>{r.reviewer_name} · {r.event_title}</Text>
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  back: { minWidth: 44, minHeight: 44, justifyContent: "center", marginLeft: -6 },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  summary: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  avg: { color: colors.text, fontSize: 26, fontWeight: "800" },
  count: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  emptyBox: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.xl, backgroundColor: colors.card },
  empty: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", lineHeight: 20 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  stars: { color: "#F59E0B", fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  txt: { color: colors.text, fontSize: font.base, lineHeight: 20, marginTop: 6 },
  tags: { color: colors.cobalt, fontSize: font.sm, fontWeight: "700", marginTop: 4 },
  meta: { color: colors.textTertiary, fontSize: font.sm, marginTop: 4 },
});

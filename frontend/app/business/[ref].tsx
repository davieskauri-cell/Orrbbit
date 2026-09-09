import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { getPublicBusiness } from "@/src/services/businessService";

/** Public Business Profile — shared route for mobile app and orrbbit.com/business/[slug]. */
export default function PublicBusiness() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const [b, setB] = useState<any | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (ref) getPublicBusiness(String(ref)).then(setB).catch(() => setErr(true));
  }, [ref]);

  if (err) return <View style={st.center}><Text style={st.errTxt}>Business not found.</Text></View>;
  if (!b) return <View style={st.center}><ActivityIndicator color={colors.cobalt} /></View>;

  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
      <View style={{ position: "relative" }}>
        {b.cover_url ? <Image source={{ uri: b.cover_url }} style={st.cover} /> : <View style={[st.cover, { backgroundColor: colors.cobaltSoft }]} />}
        <Pressable onPress={() => router.back()} style={[st.back, { top: insets.top + 8 }]} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <View style={st.headRow}>
          {b.logo_url ? <Image source={{ uri: b.logo_url }} style={st.logo} /> :
            <View style={[st.logo, { backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" }]}><Ionicons name="storefront" size={26} color={colors.cobalt} /></View>}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={st.name}>{b.name}</Text>
              {b.verified && (
                <View style={st.verBadge}><Ionicons name="checkmark-circle" size={13} color="#FFF" /><Text style={st.verTxt}>VERIFIED BUSINESS</Text></View>
              )}
            </View>
            <Text style={st.cat}>{b.category}{b.secondary_category ? ` · ${b.secondary_category}` : ""}</Text>
          </View>
        </View>

        {b.average_rating != null && (
          <View style={st.ratingRow} testID="biz-rating">
            <Text style={st.ratingBig}>{b.average_rating} ★</Text>
            <Text style={st.ratingSub}>{b.review_count} review{b.review_count === 1 ? "" : "s"}</Text>
          </View>
        )}

        <Text style={st.desc}>{b.description}</Text>
        <View style={st.metaBox}>
          <Text style={st.metaTxt}>📍 {b.location_display}</Text>
          {!!b.website && <Text style={[st.metaTxt, { color: colors.cobalt }]} onPress={() => Linking.openURL(b.website)}>🌐 {b.website}</Text>}
          {!!b.phone && <Text style={st.metaTxt}>📞 {b.phone}</Text>}
          {!!b.opening_hours && <Text style={st.metaTxt}>🕒 {b.opening_hours}</Text>}
        </View>

        <Text style={st.section}>Upcoming Events</Text>
        {(b.upcoming_events || []).length === 0 ? <Text style={st.empty}>No upcoming events right now.</Text> :
          b.upcoming_events.map((e: any) => (
            <Pressable key={e.id} testID={`pub-ev-${e.id}`} onPress={() => router.push(`/event/${e.id}`)} style={st.evRow}>
              <View style={st.evBadge}><Ionicons name="storefront" size={11} color="#FFF" /><Text style={st.evBadgeTxt}>BUSINESS EVENT</Text></View>
              <Text style={st.evTitle}>{e.title}</Text>
              <Text style={st.evMeta}>{e.category} · {new Date(e.start_datetime).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
            </Pressable>
          ))}

        {(b.past_events || []).length > 0 && (
          <>
            <Text style={st.section}>Past Events</Text>
            {b.past_events.map((e: any) => (
              <Text key={e.id} style={st.pastTxt}>{e.title} · {new Date(e.start_datetime).toLocaleDateString()}</Text>
            ))}
          </>
        )}

        <Text style={st.section}>Reviews</Text>
        {(b.reviews || []).length === 0 ? <Text style={st.empty}>No reviews yet.</Text> :
          b.reviews.map((r: any) => (
            <View key={r.id} style={st.revRow}>
              <Text style={st.revStars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
              {!!r.text && <Text style={st.revTxt}>{r.text}</Text>}
              <Text style={st.revMeta}>{r.reviewer_name} · {r.event_title}</Text>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  errTxt: { color: colors.textSecondary, fontSize: font.base },
  cover: { width: "100%", height: 170 },
  back: { position: "absolute", left: 14, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, padding: 8 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: -26 },
  logo: { width: 68, height: 68, borderRadius: 18, borderWidth: 3, borderColor: colors.surface },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  verBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.teal, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  verTxt: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  cat: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: spacing.lg },
  ratingBig: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  ratingSub: { color: colors.textSecondary, fontSize: font.sm },
  desc: { color: colors.text, fontSize: font.base, lineHeight: 21, marginTop: spacing.lg },
  metaBox: { marginTop: spacing.md, gap: 5 },
  metaTxt: { color: colors.textSecondary, fontSize: font.sm },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  evRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.sm },
  evBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.cobalt, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 5 },
  evBadgeTxt: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  evTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  evMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  pastTxt: { color: colors.textSecondary, fontSize: font.sm, marginBottom: 4 },
  revRow: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm },
  revStars: { color: "#F59E0B", fontSize: font.base, fontWeight: "700" },
  revTxt: { color: colors.text, fontSize: font.sm, marginTop: 4, lineHeight: 19 },
  revMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 5 },
});

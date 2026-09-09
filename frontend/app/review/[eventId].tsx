import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { getReviewEligibility, submitReview } from "@/src/services/businessService";

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [state, setState] = useState<any | null>(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (eventId) getReviewEligibility(String(eventId)).then(setState).catch(() => setState({ eligible: false, reason: "Event not found" }));
  }, [eventId]);

  const toggle = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const submit = async () => {
    if (rating < 1) return showAlert("Rating required", "Choose 1-5 stars.");
    setBusy(true);
    try {
      await submitReview(String(eventId), { rating, text: text.trim(), tags });
      showAlert("Thanks for your review!", "Your feedback helps the Orrbbit community.");
      router.back();
    } catch (e: any) {
      showAlert("Review", e?.message || "Could not submit review.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <View style={st.center}><ActivityIndicator color={colors.cobalt} /></View>;

  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: spacing.md }}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={st.title}>How was your experience?</Text>
      {state.event && (
        <View style={st.evCard}>
          {state.event.cover_image && <Image source={{ uri: state.event.cover_image }} style={st.evImg} />}
          <Text style={st.evTitle}>{state.event.title}</Text>
          <Text style={st.evMeta}>Hosted by {state.event.business_name} · {new Date(state.event.start_datetime).toLocaleDateString()}</Text>
        </View>
      )}
      {!state.eligible ? (
        <View style={st.blocked}>
          <Ionicons name="lock-closed" size={20} color={colors.textTertiary} />
          <Text style={st.blockedTxt}>{state.reason}</Text>
        </View>
      ) : (
        <>
          <View style={st.stars} testID="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={38} color="#F59E0B" />
              </Pressable>
            ))}
          </View>
          <Text style={st.label}>Quick feedback (optional)</Text>
          <View style={st.tagWrap}>
            {(state.tags || []).map((t: string) => (
              <Pressable key={t} onPress={() => toggle(t)} style={[st.tag, tags.includes(t) && st.tagOn]}>
                <Text style={[st.tagTxt, tags.includes(t) && { color: "#FFF" }]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={st.label}>Written review (optional)</Text>
          <TextInput
            testID="review-text"
            value={text} onChangeText={(v) => setText(v.slice(0, 500))} multiline maxLength={500}
            placeholder="Share what it was like…" placeholderTextColor={colors.textTertiary}
            style={st.input} />
          <Text style={st.count}>{text.length}/500</Text>
          <Pressable testID="review-submit" onPress={submit} disabled={busy} style={[st.cta, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.ctaTxt}>Submit review</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  evCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg },
  evImg: { width: "100%", height: 120, borderRadius: 12, marginBottom: spacing.md },
  evTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  evMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 3 },
  blocked: { alignItems: "center", gap: 8, marginTop: spacing.xxl },
  blockedTxt: { color: colors.textSecondary, fontSize: font.base, textAlign: "center" },
  stars: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: spacing.xl },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tagOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  tagTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.lg, minHeight: 100, textAlignVertical: "top", color: colors.text, fontSize: font.base },
  count: { color: colors.textTertiary, fontSize: 11, textAlign: "right", marginTop: 4 },
  cta: { backgroundColor: colors.cobalt, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
});

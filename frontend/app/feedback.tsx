import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { trackFeedbackSubmitted } from "@/src/services/analyticsService";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const SPOKE = ["Yes, we spoke", "Not yet", "No", "I felt uncomfortable"];
const EXPERIENCE = ["Great", "Good", "Okay", "Awkward", "Unsafe"];

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [spoke, setSpoke] = useState<string | null>(null);
  const [experience, setExperience] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!spoke || !experience) return;
    setBusy(true);
    try {
      await api("/feedback", { method: "POST", body: { spoke, experience, comments } });
      trackFeedbackSubmitted();
      Alert.alert("Thank you!", "Your feedback helps us make Intro better.");
      router.replace("/(tabs)");
    } catch {
      setBusy(false);
    }
  };

  const Chips = ({ options, value, onPick, prefix }: any) => (
    <View style={styles.chips}>
      {options.map((o: string) => {
        const active = value === o;
        return (
          <Pressable
            key={o}
            testID={`${prefix}-${o}`}
            onPress={() => onPick(o)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && { color: "#FFF" }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      keyboardShouldPersistTaps="handled"
      testID="feedback-screen"
    >
      <Text style={styles.title}>How did it go?</Text>

      <Text style={styles.question}>Did INTRO help you start a real conversation?</Text>
      <Chips options={SPOKE} value={spoke} onPick={setSpoke} prefix="spoke" />

      <Text style={styles.question}>How was the experience?</Text>
      <Chips options={EXPERIENCE} value={experience} onPick={setExperience} prefix="exp" />

      <Text style={styles.question}>Anything we should improve?</Text>
      <TextInput
        testID="feedback-comments"
        value={comments}
        onChangeText={setComments}
        multiline
        placeholder="Optional…"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />

      <PrimaryButton
        testID="feedback-submit"
        title="Submit feedback"
        onPress={submit}
        disabled={!spoke || !experience}
        loading={busy}
        style={{ marginTop: spacing.xl }}
      />
      <SecondaryButton
        testID="feedback-skip"
        title="Skip"
        onPress={() => router.replace("/(tabs)")}
        style={{ marginTop: spacing.sm, borderWidth: 0 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  question: { color: colors.text, fontSize: font.lg, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: font.base,
    minHeight: 80,
    textAlignVertical: "top",
  },
});

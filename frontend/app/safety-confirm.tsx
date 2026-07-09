import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startTemporaryLocationSharing } from "@/src/services/meetupService";
import { trackMeetupStarted } from "@/src/services/analyticsService";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CHECKLIST = [
  "Meet in a public area",
  "Keep your phone with you",
  "Trust your instincts",
  "End the meetup anytime",
  "Report or block if needed",
];

export default function SafetyConfirm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, point } = useLocalSearchParams<{ userId: string; point?: string }>();
  const [busy, setBusy] = useState(false);

  const proceed = async () => {
    setBusy(true);
    try {
      await startTemporaryLocationSharing(userId!, point);
      trackMeetupStarted();
      router.replace("/meetup");
    } catch {
      setBusy(false);
    }
  };

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
      testID="safety-confirm-screen"
    >
      <View style={{ alignItems: "center" }}>
        <View style={styles.shield}>
          <Ionicons name="shield-checkmark" size={34} color={colors.teal} />
        </View>
        <Text style={styles.title}>Meet safely</Text>
        <Text style={styles.sub}>
          Only meet if you feel comfortable. Stay in a public place. You can end location
          sharing at any time.
        </Text>
        {!!point && (
          <Text style={styles.pointText} testID="chosen-meetup-point">Meetup point: {point}</Text>
        )}
        <Text style={styles.reminder}>Keep it simple, respectful and low-pressure.</Text>
      </View>

      <View style={styles.card}>
        {CHECKLIST.map((c) => (
          <View key={c} style={styles.row}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.rowText}>{c}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton
          testID="safety-confirm-continue"
          title="Continue to share location"
          onPress={proceed}
          loading={busy}
        />
        <SecondaryButton
          testID="safety-confirm-cancel"
          title="Cancel"
          onPress={() => router.replace("/(tabs)")}
          style={{ borderWidth: 0 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  shield: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: {
    color: colors.textSecondary,
    fontSize: font.lg,
    textAlign: "center",
    lineHeight: 24,
    marginTop: spacing.md,
  },
  pointText: { color: colors.teal, fontSize: font.base, fontWeight: "800", marginTop: spacing.md, textAlign: "center" },
  reminder: { color: colors.orange, fontSize: font.sm, fontWeight: "700", marginTop: spacing.sm, textAlign: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowText: { color: colors.text, fontSize: font.lg, fontWeight: "500" },
});

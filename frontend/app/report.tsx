import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { reportUser } from "@/src/services/safetyService";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const REASONS = [
  "Spam",
  "No-show",
  "Harassment",
  "Fake profile",
  "Repeated unwanted contact",
  "Recruiter spam",
  "Unsafe interaction",
  "Threatening behaviour",
  "Stalking concern",
  "Other",
];

export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, name } = useLocalSearchParams<{ userId: string; name: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || !userId) return;
    setBusy(true);
    try {
      await reportUser(userId, reason, details);
      Alert.alert("Thanks. We'll review this report.", "You will no longer see this person.");
      router.replace("/(tabs)");
    } catch {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      keyboardShouldPersistTaps="handled"
      testID="report-screen"
    >
      <View style={styles.header}>
        <Pressable testID="report-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Report user</Text>
      </View>
      {!!name && <Text style={styles.sub}>Reporting {name}. Reports are confidential.</Text>}

      {REASONS.map((r) => {
        const active = reason === r;
        return (
          <Pressable
            key={r}
            testID={`report-reason-${r}`}
            onPress={() => setReason(r)}
            style={[styles.reason, active && styles.reasonActive]}
          >
            <Ionicons
              name={active ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={active ? colors.pink : colors.textTertiary}
            />
            <Text style={[styles.reasonText, active && { color: colors.text, fontWeight: "700" }]}>{r}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.label}>Tell us what happened (optional)</Text>
      <TextInput
        testID="report-details"
        value={details}
        onChangeText={setDetails}
        multiline
        placeholder="Anything that helps us understand…"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />

      <PrimaryButton
        testID="report-submit"
        title="Submit report"
        color={colors.pink}
        onPress={submit}
        disabled={!reason}
        loading={busy}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  reasonActive: { borderColor: colors.pink, backgroundColor: "#FFF5F7" },
  reasonText: { color: colors.textSecondary, fontSize: font.lg },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: font.base,
    minHeight: 90,
    textAlignVertical: "top",
  },
});

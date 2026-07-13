import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { updateVibe } from "@/src/services/userService";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const AMBER = "#F59E0B";
const TYPES = ["Need help", "Can help", "Paid task", "Selling something", "Collaboration"];
const CATEGORIES = ["Business", "HR", "Tech", "Home", "Car", "Fitness", "Other"];
const PAYMENTS = ["Free advice", "Open to paying", "Paid task", "Skill swap", "Not sure"];

const HOW_IT_WORKS = [
  { label: "Choose Opportunity", text: "Select Opportunity to ask for help, offer a service, or share something useful nearby." },
  { label: "Add Key Details", text: "Write a short public summary and optional private details for after you connect." },
  { label: "See It Nearby", text: "Nearby users can discover the opportunity on the Radar and choose whether to connect." },
  { label: "Discuss After Connecting", text: "Once you connect, private details unlock so you can talk more confidently." },
];

export default function OpportunityDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user, setUser } = useAuth();
  const { refresh } = useApp();
  const existing = user?.vibe_details || {};
  const [type, setType] = useState<string | null>(existing.opportunity_type || null);
  const [category, setCategory] = useState<string | null>(existing.category || null);
  const [summary, setSummary] = useState<string>(existing.public_summary || "");
  const [privateDetails, setPrivateDetails] = useState<string>(existing.private_details || "");
  const [payment, setPayment] = useState<string | null>(existing.payment || null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isEditing = user?.vibe === "opportunity" && !!existing.public_summary;

  const done = () => {
    if (next === "tabs") router.replace("/etiquette?next=tabs");
    else router.back();
  };

  const save = async () => {
    setError(null);
    if (!type || !category || !summary.trim()) {
      setError("Pick a type, a category and add a short public summary.");
      return;
    }
    setBusy(true);
    try {
      const updated = await api("/users/me/vibe-details", {
        method: "PUT",
        body: {
          details: {
            opportunity_type: type,
            category,
            public_summary: summary.trim(),
            private_details: privateDetails.trim(),
            payment: payment || "Not sure",
            intent: summary.trim(),
            visibility: "public",
          },
        },
      });
      setUser(updated as any);
      await refresh();
      done();
    } catch (e: any) {
      setError(e.message || "Couldn't save your opportunity.");
    }
    setBusy(false);
  };

  const deleteOpportunity = () => {
    showAlert("Delete your Opportunity?", "It will disappear from the Radar and your vibe will switch to Open to Chat.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api("/users/me/vibe-details", { method: "PUT", body: { details: {} } });
            const updated = await updateVibe("open_to_chat");
            setUser(updated as any);
            await refresh();
            router.back();
          } catch {}
        },
      },
    ]);
  };

  const pills = (options: string[], value: string | null, onPick: (v: string) => void, prefix: string) => (
    <View style={styles.pills}>
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable
            key={o}
            testID={`${prefix}-${o.replace(/[^a-zA-Z0-9]+/g, "-")}`}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onPick(o)}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="opportunity-details-screen"
      >
        <View style={styles.header}>
          <Pressable testID="opp-back" onPress={done} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Opportunity Details</Text>
        </View>
        <Text style={styles.sub}>Let people nearby know what you need or what you can offer.</Text>

        <View style={styles.howCard} testID="opp-how-it-works">
          {HOW_IT_WORKS.map((s, i) => (
            <View key={s.label} style={styles.howRow}>
              <View style={styles.howNum}>
                <Text style={styles.howNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.howLabel}>{s.label}</Text>
                <Text style={styles.howText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.label}>Opportunity Type</Text>
        {pills(TYPES, type, setType, "opp-type")}

        <Text style={styles.label}>Category</Text>
        {pills(CATEGORIES, category, setCategory, "opp-category")}

        <Text style={styles.label}>Public Summary</Text>
        <TextInput
          testID="opp-summary"
          style={styles.input}
          value={summary}
          onChangeText={(t) => setSummary(t.slice(0, 80))}
          placeholder="Need help with a staff issue"
          placeholderTextColor={colors.textTertiary}
          maxLength={80}
        />
        <View style={styles.helperRow}>
          <Text style={styles.helper}>Visible to nearby users before you connect.</Text>
          <Text style={styles.counter}>{summary.length}/80</Text>
        </View>

        <Text style={styles.label}>Private Details</Text>
        <TextInput
          testID="opp-private"
          style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
          value={privateDetails}
          onChangeText={(t) => setPrivateDetails(t.slice(0, 300))}
          placeholder="Add extra details to share after you connect"
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={300}
        />
        <View style={styles.helperRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
            <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
            <Text style={styles.helper}>Only shared after mutual connection.</Text>
          </View>
          <Text style={styles.counter}>{privateDetails.length}/300</Text>
        </View>

        <Text style={styles.label}>Payment</Text>
        {pills(PAYMENTS, payment, setPayment, "opp-payment")}

        <View style={styles.policyNote}>
          <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
          <Text style={styles.policyText}>
            Not allowed: weapons, drugs, adult services, gambling, investment schemes, illegal items, medical claims, or unsafe offers.
          </Text>
        </View>

        {error && (
          <Text testID="opp-error" style={styles.error}>
            {error}
          </Text>
        )}

        <PrimaryButton testID="opp-save" title="Save Opportunity" color={AMBER} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
        <SecondaryButton testID="opp-cancel" title="Back" onPress={done} style={{ marginTop: spacing.sm, borderWidth: 0 }} />
        {isEditing && (
          <Pressable testID="opp-delete" style={styles.deleteBtn} onPress={deleteOpportunity}>
            <Ionicons name="trash-outline" size={15} color={colors.pink} />
            <Text style={styles.deleteText}>Delete Opportunity</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, lineHeight: 21 },
  howCard: {
    backgroundColor: AMBER + "0D",
    borderWidth: 1,
    borderColor: AMBER + "33",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  howRow: { flexDirection: "row", gap: spacing.md },
  howNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AMBER,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  howNumText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  howLabel: { color: colors.text, fontSize: font.sm, fontWeight: "800" },
  howText: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18, marginTop: 1 },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: "center",
  },
  pillActive: { backgroundColor: AMBER, borderColor: AMBER },
  pillText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  pillTextActive: { color: "#FFF", fontWeight: "700" },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.base,
    color: colors.text,
    minHeight: 48,
    backgroundColor: colors.card,
  },
  helperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  helper: { color: colors.textTertiary, fontSize: font.sm, flexShrink: 1 },
  counter: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600" },
  policyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  policyText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 18 },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.lg },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  deleteText: { color: colors.pink, fontSize: font.base, fontWeight: "700" },
});

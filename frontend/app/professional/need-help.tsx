import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CATEGORIES = ["HR", "Legal", "Accounting", "Finance", "Marketing", "Technology", "Business Consulting", "Engineering", "Trades", "Plumbing", "Electrical", "Automotive", "Property", "Education", "Photography", "Fitness", "Health and Wellbeing", "Other"];
const PAYMENTS = ["Open to paying", "Free advice", "Fixed fee", "Hourly", "Discuss after connecting", "Not sure"];
const EXPIRY = ["1 hour", "4 hours", "Today", "24 hours"];

export default function NeedHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [existing, setExisting] = useState<any>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [priv, setPriv] = useState("");
  const [payment, setPayment] = useState("Not sure");
  const [expiry, setExpiry] = useState("24 hours");
  const [availability, setAvailability] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any[]>("/help-requests/mine").then((rows) => {
      const act = rows.find((r) => r.status === "active" || r.status === "paused");
      if (act) {
        setExisting(act);
        setCategory(act.category);
        setSummary(act.public_summary);
        setPriv(act.private_details || "");
        setPayment(act.payment);
        setExpiry(act.expiry);
        setAvailability(act.availability || "");
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setError(null);
    if (!category || !summary.trim()) {
      setError("Pick a category and add a short public summary.");
      return;
    }
    setBusy(true);
    try {
      const body = { category, public_summary: summary.trim(), private_details: priv.trim(), payment, expiry, availability };
      if (existing) await api(`/help-requests/${existing.id}`, { method: "PUT", body });
      else await api("/help-requests", { method: "POST", body });
      router.back();
    } catch (e: any) {
      setError(e.message || "Couldn't save your request.");
    }
    setBusy(false);
  };

  const pills = (options: string[], value: string | null, onPick: (v: string) => void, prefix: string) => (
    <View style={styles.pills}>
      {options.map((o) => (
        <Pressable key={o} testID={`${prefix}-${o.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={[styles.pill, value === o && styles.pillActive]} onPress={() => onPick(o)}>
          <Text style={[styles.pillText, value === o && styles.pillTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled" testID="need-help-screen">
        <View style={styles.header}>
          <Pressable testID="nh-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{existing ? "Edit Help Request" : "Post a Help Request"}</Text>
        </View>
        <Text style={styles.sub}>Nearby professionals in this category will see your public summary only.</Text>

        <Text style={styles.label}>Category</Text>
        {pills(CATEGORIES, category, setCategory, "nh-cat")}

        <Text style={styles.label}>Public Summary</Text>
        <TextInput testID="nh-summary" style={styles.input} value={summary} onChangeText={(t) => setSummary(t.slice(0, 80))} placeholder="Need help with a staff performance issue" placeholderTextColor={colors.textTertiary} maxLength={80} />
        <View style={styles.helperRow}>
          <Text style={styles.helper}>Visible before you connect.</Text>
          <Text style={styles.helper}>{summary.length}/80</Text>
        </View>

        <Text style={styles.label}>Private Details</Text>
        <TextInput testID="nh-private" style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]} value={priv} onChangeText={(t) => setPriv(t.slice(0, 300))} placeholder="Extra details shared only after you accept an offer" placeholderTextColor={colors.textTertiary} multiline maxLength={300} />
        <View style={styles.helperRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
            <Text style={styles.helper}>Hidden until you accept an offer.</Text>
          </View>
          <Text style={styles.helper}>{priv.length}/300</Text>
        </View>

        <Text style={styles.label}>Payment Preference</Text>
        {pills(PAYMENTS, payment, setPayment, "nh-pay")}

        <Text style={styles.label}>Expiry</Text>
        {pills(EXPIRY, expiry, setExpiry, "nh-exp")}

        <Text style={styles.label}>Availability</Text>
        <TextInput testID="nh-availability" style={styles.input} value={availability} onChangeText={(t) => setAvailability(t.slice(0, 80))} placeholder="e.g. Available this afternoon" placeholderTextColor={colors.textTertiary} />

        {error && <Text testID="nh-error" style={styles.error}>{error}</Text>}
        <PrimaryButton testID="nh-save" title={existing ? "Save Changes" : "Post Request"} onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
        <SecondaryButton title="Back" onPress={() => router.back()} style={{ marginTop: spacing.sm, borderWidth: 0 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, minHeight: 36, justifyContent: "center" },
  pillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  pillText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  pillTextActive: { color: "#FFF", fontWeight: "700" },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.base, color: colors.text, minHeight: 52, backgroundColor: colors.card },
  helperRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  helper: { color: colors.textTertiary, fontSize: font.sm },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.lg },
});

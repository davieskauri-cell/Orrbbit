import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CATEGORIES = ["HR", "Legal", "Accounting", "Finance", "Marketing", "Technology", "Business Consulting", "Engineering", "Trades", "Plumbing", "Electrical", "Automotive", "Property", "Education", "Photography", "Fitness", "Health and Wellbeing", "Other"];
const ID_TYPES = ["Passport", "Driver licence", "Government ID"];
const EVIDENCE_TYPES = ["Degree", "Trade licence", "Government licence", "Professional membership", "Industry certificate", "Employer verification", "Business registration", "Portfolio"];

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<any>({ status: "Not Submitted" });
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ type: string; description: string }[]>([]);
  const [evType, setEvType] = useState<string | null>(null);
  const [evDesc, setEvDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<any>("/verification/status").then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  const addEvidence = () => {
    if (!evType || !evDesc.trim()) return;
    setEvidence([...evidence, { type: evType, description: evDesc.trim() }]);
    setEvType(null);
    setEvDesc("");
  };

  const submit = async () => {
    setError(null);
    if (!fullName.trim() || !idType) { setError("Step 1: add your full legal name and ID type."); return; }
    if (!category) { setError("Pick the category you want verified."); return; }
    if (evidence.length === 0) { setError("Step 2: add at least one piece of professional evidence."); return; }
    setBusy(true);
    try {
      await api("/verification/submit", { method: "POST", body: { full_name: fullName.trim(), id_type: idType, category, evidence } });
      await load();
    } catch (e: any) {
      setError(e.message || "Couldn't submit.");
    }
    setBusy(false);
  };

  const statusColor = status.status === "Approved" ? colors.success : status.status === "Pending Review" ? colors.orange : status.status === "Rejected" ? colors.pink : colors.textTertiary;
  const canSubmit = ["Not Submitted", "Rejected", "More Information Required", "Expired"].includes(status.status);

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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled" testID="verification-screen">
        <View style={styles.header}>
          <Pressable testID="ver-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Verification</Text>
        </View>

        <View style={styles.statusCard} testID="ver-status">
          <Ionicons name="shield-checkmark" size={18} color={statusColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status.status}</Text>
            {!!status.note && <Text style={styles.statusNote}>Reviewer note: {status.note}</Text>}
          </View>
        </View>

        {canSubmit ? (
          <>
            <Text style={styles.step}>STEP 1 · IDENTITY VERIFICATION</Text>
            <Text style={styles.label}>Full Legal Name</Text>
            <TextInput testID="ver-name" style={styles.input} value={fullName} onChangeText={setFullName} placeholder="As shown on your ID" placeholderTextColor={colors.textTertiary} />
            <Text style={styles.label}>ID Type</Text>
            {pills(ID_TYPES, idType, setIdType, "ver-id")}

            <Text style={styles.step}>STEP 2 · PROFESSIONAL EVIDENCE</Text>
            <Text style={styles.label}>Category to Verify</Text>
            {pills(CATEGORIES, category, setCategory, "ver-cat")}
            <Text style={styles.label}>Evidence Type</Text>
            {pills(EVIDENCE_TYPES, evType, setEvType, "ver-ev")}
            <Text style={styles.label}>Evidence Description</Text>
            <TextInput testID="ver-ev-desc" style={styles.input} value={evDesc} onChangeText={(t) => setEvDesc(t.slice(0, 300))} placeholder="e.g. CIPD Level 7 certificate #12345, issued 2019" placeholderTextColor={colors.textTertiary} />
            <SecondaryButton testID="ver-add-evidence" title="+ Add Evidence" onPress={addEvidence} style={{ marginTop: spacing.sm, minHeight: 44 }} />
            {evidence.map((e, i) => (
              <View key={i} style={styles.evRow}>
                <Ionicons name="document-text" size={14} color={colors.teal} />
                <Text style={styles.evText}>{e.type}: {e.description}</Text>
                <Pressable onPress={() => setEvidence(evidence.filter((_, j) => j !== i))} hitSlop={8}>
                  <Ionicons name="close" size={14} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}

            <Text style={styles.step}>STEP 3 · SUBMIT FOR REVIEW</Text>
            <Text style={styles.helper}>An INTRO admin will review your submission. Documents are never shown to other users. Approval is manual — nothing is auto-approved.</Text>
            {error && <Text testID="ver-error" style={styles.error}>{error}</Text>}
            <PrimaryButton testID="ver-submit" title="Submit for Review" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
          </>
        ) : (
          <Text style={styles.helper}>
            {status.status === "Pending Review"
              ? "Your submission is with our review team. You'll see the outcome here."
              : "Your verification is approved. Editing credential details on your profile will trigger re-review."}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  statusText: { fontSize: font.lg, fontWeight: "800" },
  statusNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  step: { color: colors.teal, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xxl },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, minHeight: 36, justifyContent: "center" },
  pillActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  pillText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  pillTextActive: { color: "#FFF", fontWeight: "700" },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.base, color: colors.text, minHeight: 48, backgroundColor: colors.card },
  evRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  evText: { color: colors.text, fontSize: font.sm, flex: 1 },
  helper: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 19, marginTop: spacing.md },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.md },
});

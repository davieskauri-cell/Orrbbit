import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const CATEGORIES = ["HR", "Legal", "Accounting", "Finance", "Marketing", "Technology", "Business Consulting", "Engineering", "Trades", "Plumbing", "Electrical", "Automotive", "Property", "Education", "Photography", "Fitness", "Health and Wellbeing", "Other"];

export default function CanHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<any>({ profession: "", primary_category: null, additional_categories: [], about: "", years_experience: "", qualifications: "", memberships: "", licences: "", certifications: "", specialties: "", availability: "", response_time: "", rate: "", rate_type: "" });
  const [verification, setVerification] = useState<any>({ status: "Not Submitted" });
  const [broadMap, setBroadMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any>("/professional/profile/me").then((res) => {
      setVerification(res.verification);
      if (res.profile) {
        const p = res.profile;
        setF({ ...p, years_experience: String(p.years_experience || ""), specialties: (p.specialties || []).join(", ") });
      }
    }).catch(() => {});
    api<any>("/config").then((c) => setBroadMap(c.profession_broad || {})).catch(() => {});
  }, []);

  const isVerified = verification.status === "Approved";
  const verifiedBroad = isVerified && verification.profession ? [broadMap[verification.profession] || "Other"] : null;
  const allowedCats = verifiedBroad || CATEGORIES;

  const set = (k: string, v: any) => setF((prev: any) => ({ ...prev, [k]: v }));

  const toggleExtra = (c: string) =>
    set("additional_categories", f.additional_categories.includes(c) ? f.additional_categories.filter((x: string) => x !== c) : [...f.additional_categories, c].slice(0, 4));

  const save = async () => {
    setError(null);
    if (!f.profession.trim() || !f.primary_category) {
      setError("Add your profession and pick a primary category.");
      return;
    }
    setBusy(true);
    try {
      await api("/professional/profile", {
        method: "POST",
        body: {
          ...f,
          years_experience: parseInt(f.years_experience) || 0,
          specialties: f.specialties.split(",").map((s: string) => s.trim()).filter(Boolean),
        },
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "Couldn't save your profile.");
    }
    setBusy(false);
  };

  const input = (key: string, label: string, placeholder: string, multiline = false) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`ch-${key}`}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
        value={String(f[key] ?? "")}
        onChangeText={(t) => set(key, t)}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
      />
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled" testID="can-help-screen">
        <View style={styles.header}>
          <Pressable testID="ch-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Professional Profile</Text>
        </View>
        <View style={styles.verRow}>
          <Ionicons name="shield-checkmark" size={14} color={verification.status === "Approved" ? colors.teal : colors.textTertiary} />
          <Text style={styles.verText}>Verification: {verification.status}</Text>
          <Pressable testID="ch-verify" onPress={() => router.push("/professional/verification")}>
            <Text style={styles.verLink}>{verification.status === "Approved" ? "View" : "Get Verified"}</Text>
          </Pressable>
        </View>
        {verification.status === "Approved" ? (
          <Text style={styles.reReviewNote}>Editing credentials (profession, category, qualifications, licences) will trigger re-review.</Text>
        ) : (
          <View style={styles.draftBanner} testID="ch-draft-banner">
            <Ionicons name="lock-closed" size={13} color={colors.orange} />
            <Text style={styles.draftText}>{"Your profile stays private until you're Professionally Verified. Only verified categories can be offered."}</Text>
          </View>
        )}

        {input("profession", "Profession", "e.g. HR Consultant")}

        <Text style={styles.label}>Primary Category{isVerified ? " (verified only)" : ""}</Text>
        <View style={styles.pills}>
          {allowedCats.map((c) => (
            <Pressable key={c} testID={`ch-cat-${c.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={[styles.pill, f.primary_category === c && styles.pillActive]} onPress={() => set("primary_category", c)}>
              <Text style={[styles.pillText, f.primary_category === c && styles.pillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        {isVerified && (
          <Text style={styles.reReviewNote}>{`You're verified for ${verification.profession}. Other categories require separate verification.`}</Text>
        )}

        {allowedCats.length > 1 && (
          <>
            <Text style={styles.label}>Additional Categories (up to 4)</Text>
            <View style={styles.pills}>
              {allowedCats.filter((c) => c !== f.primary_category).map((c) => (
                <Pressable key={c} testID={`ch-extra-${c.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={[styles.pill, f.additional_categories.includes(c) && styles.pillActiveTeal]} onPress={() => toggleExtra(c)}>
                  <Text style={[styles.pillText, f.additional_categories.includes(c) && styles.pillTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {input("about", "About", "What you help with and how", true)}
        {input("years_experience", "Years of Experience", "e.g. 8")}
        {input("qualifications", "Qualifications", "e.g. MBA (HR), CIPD Level 7")}
        {input("memberships", "Professional Memberships", "e.g. AHRI member")}
        {input("licences", "Licences", "e.g. Electrical licence #")}
        {input("certifications", "Certifications", "e.g. Cert IV")}
        {input("specialties", "Specialties (comma separated)", "e.g. Performance management, Disputes")}
        {input("availability", "Availability", "e.g. Weekdays after 5pm")}
        {input("response_time", "Response Time", "e.g. Usually replies within 1 hour")}
        {input("rate", "Rate (optional)", "e.g. $120")}
        {input("rate_type", "Rate Type (optional)", "e.g. Hourly / Fixed")}

        {error && <Text testID="ch-error" style={styles.error}>{error}</Text>}
        <PrimaryButton testID="ch-save" title="Save Profile" onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
        <SecondaryButton title="Back" onPress={() => router.back()} style={{ marginTop: spacing.sm, borderWidth: 0 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  verRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  verText: { color: colors.text, fontSize: font.sm, fontWeight: "700", flex: 1 },
  verLink: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  reReviewNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm },
  draftBanner: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  draftText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 18 },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, minHeight: 36, justifyContent: "center" },
  pillActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  pillActiveTeal: { backgroundColor: colors.teal, borderColor: colors.teal },
  pillText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  pillTextActive: { color: "#FFF", fontWeight: "700" },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.base, color: colors.text, minHeight: 52, backgroundColor: colors.card },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.lg },
});

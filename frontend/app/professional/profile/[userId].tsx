import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { requestConnection } from "@/src/services/matchingService";
import { distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function ProProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    api<any>(`/professional/profile/${userId}`).then(setP).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await requestConnection(p.user_id);
      if (res.status === "connected") {
        showAlert("You're already connected", `Head to Pings to continue with ${p.name}.`);
      } else {
        setRequested(true);
        showAlert("Request sent", `${p.name} will be asked to accept before you're connected.`);
      }
    } catch (e: any) {
      showAlert("Couldn't send request", e.message || "Please try again.");
    }
    setBusy(false);
  };

  const badgeInfo = () =>
    showAlert(
      "Verified by INTRO",
      `• Identity verified\n• Qualification/licence reviewed\n• Profession confirmed${p.verification?.verified_at ? `\n• Verified ${new Date(p.verification.verified_at).toLocaleDateString()}` : ""}`
    );

  if (loading || !p) {
    return <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator color={colors.teal} /></View>;
  }

  const row = (label: string, value?: string | number | null) =>
    value ? (
      <View style={styles.infoRow} key={label}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{String(value)}</Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 140, paddingHorizontal: spacing.xl }} testID="pro-profile-screen">
        <Pressable testID="pp-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.hero}>
          <Avatar uri={p.photo_url} name={p.name} size={72} ringColor={p.verified_by_intro ? colors.teal : colors.border} />
          <Text style={styles.name}>{p.name}</Text>
          {p.verified_by_intro && (
            <Pressable testID="verified-badge" style={styles.badge} onPress={badgeInfo}>
              <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
              <Text style={styles.badgeText}>Verified by INTRO</Text>
            </Pressable>
          )}
          <Text style={styles.profession}>{p.profession} · {p.primary_category}</Text>
          <Text style={styles.meta}>
            {p.active_now ? "Active now" : "Local"}{p.distance != null ? ` · ${distLabel(p.distance)}` : ""}
          </Text>
        </View>

        {!!p.about && <Text style={styles.about}>{p.about}</Text>}

        {p.professionally_verified && (
          <View style={[styles.card, shadow.card]} testID="pp-verified-card">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="shield-checkmark" size={16} color={colors.teal} />
              <Text style={styles.verTitle}>Professionally Verified</Text>
            </View>
            <Text style={styles.verProfession}>{p.verified_profession}</Text>
            {!!p.verified_categories?.length && (
              <View style={{ gap: 4 }}>
                <Text style={styles.infoLabel}>VERIFIED CATEGORIES</Text>
                {p.verified_categories.map((c: string) => (
                  <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.verCat}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!p.verified_since && <Text style={styles.verMeta}>Verified since {new Date(p.verified_since).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</Text>}
            {!!p.valid_until && (
              <Text style={[styles.verMeta, p.credential_status === "Expiring Soon" && { color: colors.warning, fontWeight: "700" }]}>
                Valid until {new Date(p.valid_until).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            )}
            <Text style={styles.verBy}>Verified by Intro</Text>
          </View>
        )}

        <View style={[styles.card, shadow.card]}>
          {row("Experience", p.years_experience ? `${p.years_experience} years` : null)}
          {row("Qualifications", p.qualifications)}
          {row("Memberships", p.memberships)}
          {row("Specialties", (p.specialties || []).join(", "))}
          {row("Availability", p.availability)}
          {row("Response time", p.response_time)}
          {row("Rate", p.rate ? `${p.rate}${p.rate_type ? ` (${p.rate_type})` : ""}` : null)}
        </View>

        {p.regulated && (
          <View style={styles.disclaimer} testID="regulated-disclaimer">
            <Ionicons name="information-circle" size={14} color={colors.textTertiary} />
            <Text style={styles.disclaimerText}>
              Verification confirms that documents were reviewed. It does not guarantee service quality, outcomes or suitability. Users should make their own checks before engaging a professional.
            </Text>
          </View>
        )}

        <Pressable testID="pp-report" style={styles.reportLink} onPress={() => router.push({ pathname: "/report", params: { userId: p.user_id, name: p.name } })}>
          <Text style={styles.reportText}>Report this professional</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton testID="pp-connect" title={requested ? "Request Sent ✓" : "Connect"} onPress={connect} loading={busy} disabled={requested} />
        <SecondaryButton title="Back" onPress={() => router.back()} style={{ marginTop: spacing.sm, borderWidth: 0, minHeight: 44 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { alignItems: "center", gap: 6, marginTop: spacing.md },
  name: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 5, minHeight: 28 },
  badgeText: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  profession: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: font.sm },
  about: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, marginTop: spacing.lg, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.md },
  verTitle: { color: colors.teal, fontSize: font.base, fontWeight: "800" },
  verProfession: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  verCat: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  verMeta: { color: colors.textSecondary, fontSize: font.sm },
  verBy: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  infoLabel: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "700" },
  infoValue: { color: colors.text, fontSize: font.sm, fontWeight: "600", flex: 1, textAlign: "right" },
  disclaimer: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  disclaimerText: { color: colors.textTertiary, fontSize: font.sm, lineHeight: 17, flex: 1 },
  reportLink: { alignSelf: "center", padding: spacing.md, marginTop: spacing.sm },
  reportText: { color: colors.pink, fontSize: font.sm, fontWeight: "700" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});

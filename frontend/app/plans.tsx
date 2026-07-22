import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "Free",
    radius: "Up to 50m",
    tagline: "Perfect for everyday nearby connections.",
    features: ["Up to 50m radius", "Choose vibe & details", "See nearby profiles", "Pings & matches", "Basic filters"],
    color: colors.grey,
  },
  {
    key: "plus",
    name: "IntroYu Plus",
    price: "$6.99 / month",
    radius: "Up to 100m",
    tagline: "For bigger venues, events and city blocks.",
    features: ["Everything in Free", "Up to 100m radius", "Advanced filters", "Verified-only filter", "Save profiles", "Priority visibility"],
    color: colors.teal,
  },
  {
    key: "pro",
    name: "IntroYu Pro",
    price: "$12.99 / month",
    radius: "250m – 500m max",
    tagline: "For campuses, festivals, conferences and large social spaces.",
    features: ["Everything in Plus", "Up to 500m radius", "Extended discovery", "Event & Campus Mode", "More clusters and insights", "Advanced intent filters", "Recruiter & hiring filters"],
    color: colors.orange,
  },
];

export default function PlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const current = user?.plan || "free";

  const done = () => {
    if (next === "setup") router.replace("/(auth)/intent");
    else router.back();
  };

  const choose = async (planKey: string) => {
    if (planKey === current && next !== "setup") return done();
    setBusy(planKey);
    try {
      if (planKey !== "free" && planKey !== current) {
        // placeholder — no live payments in this prototype
        await new Promise<void>((resolve, reject) =>
          showAlert(
            "Payments are not active in this prototype",
            "Continue with a demo upgrade?",
            [
              { text: "Cancel", style: "cancel", onPress: () => reject(new Error("cancel")) },
              { text: "Demo upgrade", onPress: () => resolve() },
            ]
          )
        );
      }
      if (planKey !== current) {
        const updated = await api("/users/me/state", { method: "PUT", body: { plan: planKey } });
        setUser(updated as any);
      }
      router.replace(`/plan-confirmed?plan=${planKey}${next === "setup" ? "&next=setup" : ""}`);
    } catch {}
    setBusy(null);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="plans-screen"
    >
      <View style={styles.header}>
        {router.canGoBack() && (
          <Pressable testID="plans-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        <Text style={styles.title}>{next === "setup" ? "Choose your IntroYu plan" : "IntroYu Plans"}</Text>
      </View>
      <Text style={styles.sub}>
        {next === "setup" ? "Pick your discovery radius to get started." : "Choose your discovery radius."}
      </Text>
      <View style={styles.privacyNote}>
        <Ionicons name="lock-closed" size={13} color={colors.teal} />
        <Text style={styles.privacyText}>
          Higher radius does not reveal exact locations. Other users are always approximate.
        </Text>
      </View>

      {PLANS.map((p) => {
        const isCurrent = current === p.key;
        return (
          <View key={p.key} style={[styles.card, shadow.card, isCurrent && { borderColor: p.color, borderWidth: 1.5 }]} testID={`plan-card-${p.key}`}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={[styles.planRadius, { color: p.color }]}>{p.radius}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.planPrice}>{p.price}</Text>
                {isCurrent && (
                  <View style={[styles.currentChip, { backgroundColor: p.color + "18" }]}>
                    <Text style={[styles.currentText, { color: p.color }]}>Current Plan</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.tagline}>{p.tagline}</Text>
            {p.features.map((f) => (
              <View key={f} style={styles.featRow}>
                <Ionicons name="checkmark" size={14} color={p.color} />
                <Text style={styles.featText}>{f}</Text>
              </View>
            ))}
            <PrimaryButton
              testID={`plan-choose-${p.key}`}
              title={isCurrent ? (next === "setup" ? `Continue ${p.name}` : "Current Plan") : p.key === "free" ? "Continue Free" : `Upgrade to ${p.name}`}
              disabled={isCurrent && next !== "setup"}
              loading={busy === p.key}
              onPress={() => choose(p.key)}
              style={{ marginTop: spacing.md, backgroundColor: p.key === "free" ? colors.teal : colors.orange }}
            />
          </View>
        );
      })}

      <Text style={styles.footnote}>Payments are not active in this prototype.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  planName: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  planRadius: { fontSize: font.base, fontWeight: "800", marginTop: 2 },
  planPrice: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  currentChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, marginTop: 4 },
  currentText: { fontSize: 10, fontWeight: "800" },
  tagline: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4, marginBottom: spacing.md },
  featRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  featText: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  footnote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.xl },
});

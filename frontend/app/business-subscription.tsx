import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { showAlert } from "@/src/lib/alert";
import { openLegal } from "@/src/lib/legalLinks";
import { getBusinessSubscription, cancelBusinessSubscription, activateBusinessSubscription } from "@/src/services/businessService";

const INCLUDES = [
  "Business Profile", "Verified badge (once approved)", "Host Business Events",
  "Nearby discovery", "Attendee management", "Analytics & insights",
  "Ratings & reviews", "Mobile & desktop access", "Local offers & promotions", "Dedicated business tools",
];

/** Mobile Orrbbit Business subscription management. */
export default function BusinessSubscription() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<any | null>(null);

  const load = useCallback(() => { getBusinessSubscription().then(setSub).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const active = sub?.status === "active" || sub?.status === "grace";

  const manage = () => {
    showAlert("Manage Subscription",
      sub?.guidance || "Manage your subscription through the App Store / Google Play on the device you subscribed with.");
  };

  const cancel = () => {
    showAlert("Cancel Subscription?",
      "Your Business features stay available until the end of the current billing period.",
      [
        { text: "Keep Subscription", style: "cancel" },
        {
          text: "Cancel Subscription", style: "destructive",
          onPress: async () => {
            try { await cancelBusinessSubscription(); load(); showAlert("Subscription cancelled", "You won't be billed again."); }
            catch (e: any) { showAlert("Subscription", e?.message || "Could not cancel."); }
          },
        },
      ]);
  };

  const restore = async () => {
    try { await activateBusinessSubscription(); load(); showAlert("Purchase restored", "Your Orrbbit Business subscription is active."); }
    catch (e: any) { showAlert("Restore Purchase", e?.message || "No previous purchase found for this account."); }
  };

  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View style={st.topRow}>
        <Pressable testID="bizsub-back" onPress={() => router.back()} hitSlop={10} style={st.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={st.logoRow}><LogoMark size={26} /><Wordmark height={17} /></View>
        <View style={{ width: 24 }} />
      </View>
      <Text style={st.title}>Subscription</Text>

      <View style={st.planCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <LogoMark size={38} />
          <View>
            <Text style={st.planName}>Orrbbit Business</Text>
            <Text style={st.planPrice}>{sub?.price || "$5.99"} <Text style={st.planPer}>/ month</Text></Text>
          </View>
        </View>
        <Text style={st.planTag}>Connect. Host. Grow.</Text>
      </View>

      <View style={[st.stateCard, { backgroundColor: active ? "#E7F8EE" : "#FEF3C7" }]} testID="bizsub-status">
        <Ionicons name={active ? "checkmark-circle" : "alert-circle"} size={18} color={active ? colors.success : "#B45309"} />
        <View style={{ flex: 1 }}>
          <Text style={[st.stateTitle, { color: active ? "#15803D" : "#B45309" }]}>
            {active ? "Active Subscription" : `Subscription ${(sub?.status || "…").replace("_", " ")}`}
          </Text>
          <Text style={st.stateSub}>{active ? "Your plan is active and renewing." : "Reactivate to keep your Business features."}</Text>
        </View>
      </View>

      <View style={st.kvCard}>
        {[
          ["Plan", "Orrbbit Business"],
          ["Price", `${sub?.price || "$5.99"} / month`],
          ["Start Date", sub?.started_at ? new Date(sub.started_at).toLocaleDateString() : "—"],
          ["Next Renewal", sub?.renews_at ? new Date(sub.renews_at).toLocaleDateString() : "—"],
          ["Platform", sub?.platform ? String(sub.platform).replace("sandbox", "Staged (pre-store)") : "—"],
          ["Status", (sub?.status || "…").replace("_", " ")],
        ].map(([k, v]) => (
          <View key={k as string} style={st.kvRow}>
            <Text style={st.kvKey}>{k}</Text>
            <Text style={st.kvVal}>{v}</Text>
          </View>
        ))}
      </View>

      <Pressable testID="bizsub-manage" onPress={manage} style={st.primaryBtn}>
        <Text style={st.primaryTxt}>Manage Subscription</Text>
      </Pressable>
      {active ? (
        <Pressable testID="bizsub-cancel" onPress={cancel} style={st.outlineBtn}>
          <Text style={st.outlineTxt}>Cancel Subscription</Text>
        </Pressable>
      ) : (
        <Pressable testID="bizsub-restore" onPress={restore} style={st.outlineBtn}>
          <Text style={[st.outlineTxt, { color: colors.cobalt }]}>Restore Purchase</Text>
        </Pressable>
      )}

      <Text style={st.section}>Plan Includes</Text>
      <View style={st.incCard}>
        {INCLUDES.map((i) => (
          <View key={i} style={st.incRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={st.incTxt}>{i}</Text>
          </View>
        ))}
      </View>

      {!!sub?.guidance && <Text style={st.guidance}>{sub.guidance}</Text>}
      <Text style={st.note}>Payment is handled safely through Apple In-App Purchase / Google Play Billing — Orrbbit never stores card details.</Text>
      <Pressable onPress={() => openLegal("support")} style={st.linkRow} hitSlop={8}>
        <Text style={st.helpTxt}>Need help with your subscription? <Text style={st.linkTxt}>Contact Support</Text></Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  back: { minWidth: 44, minHeight: 44, justifyContent: "center", marginLeft: -6 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", letterSpacing: -0.3 },
  planCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.lg, marginTop: spacing.lg },
  planName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  planPrice: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  planPer: { fontSize: font.sm, color: colors.textSecondary, fontWeight: "600" },
  planTag: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.sm },
  stateCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: spacing.lg, marginTop: spacing.md },
  stateTitle: { fontSize: font.base, fontWeight: "800" },
  stateSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 1 },
  kvCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.card },
  kvKey: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  kvVal: { color: colors.text, fontSize: font.sm, fontWeight: "700", textTransform: "capitalize" },
  primaryBtn: { backgroundColor: colors.cobalt, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  outlineTxt: { color: "#DC2626", fontSize: font.base, fontWeight: "800" },
  linkRow: { alignItems: "center", marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  linkTxt: { color: colors.teal, fontSize: font.sm, fontWeight: "700", textDecorationLine: "underline" },
  helpTxt: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center" },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  incCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg },
  incRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 5 },
  incTxt: { color: colors.text, fontSize: font.base },
  guidance: { color: "#B45309", fontSize: font.sm, marginTop: spacing.md, lineHeight: 19 },
  note: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.md, lineHeight: 18, textAlign: "center" },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { getBusinessSubscription, cancelBusinessSubscription, activateBusinessSubscription } from "@/src/services/businessService";

const INCLUDES = [
  "Business Profile", "Verified badge once approved", "Mobile Business Dashboard",
  "Desktop Business Dashboard", "Business Hosted Events", "Event poster/photo",
  "Nearby Radar discovery", "Attendee management", "Notifications", "Analytics",
  "Ratings & reviews", "Business tools"];

export default function BizSubscription() {
  const [sub, setSub] = useState<any | null>(null);
  const load = useCallback(() => { getBusinessSubscription().then(setSub).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const active = sub?.status === "active" || sub?.status === "grace";

  const manage = () => showAlert("Manage Subscription",
    sub?.guidance || "Manage your subscription through the App Store / Google Play on the device you subscribed with.");
  const cancel = () => showAlert("Cancel Subscription?",
    "Your Business features stay available until the end of the current billing period.",
    [
      { text: "Keep Subscription", style: "cancel" },
      { text: "Cancel Subscription", style: "destructive",
        onPress: async () => { try { await cancelBusinessSubscription(); load(); } catch (e: any) { showAlert("Subscription", e?.message || "Could not cancel."); } } },
    ]);
  const restore = async () => {
    try { await activateBusinessSubscription(); load(); showAlert("Purchase restored", "Your Orrbbit Business subscription is active."); }
    catch (e: any) { showAlert("Restore Purchase", e?.message || "No previous purchase found for this account."); }
  };

  return (
    <BizShell title="Subscription">
      <BizCard>
        <Text style={st.plan}>ORRBBIT BUSINESS — FULL ACCESS</Text>
        <Text style={st.price}>$5.99<Text style={st.per}>/month</Text></Text>
        <View style={st.stateRow}>
          <Text style={st.stateLbl}>Status:</Text>
          <Text style={[st.state, { color: sub?.status === "active" ? colors.teal : colors.textSecondary }]} testID="bizsub-status">
            {(sub?.status || "…").replace("_", " ")}
          </Text>
        </View>
        {sub?.started_at && <Text style={st.meta}>Started {new Date(sub.started_at).toLocaleDateString()}</Text>}
        {sub?.renews_at && <Text style={st.meta}>{active ? "Renews" : "Access until"} {new Date(sub.renews_at).toLocaleDateString()}</Text>}
        {sub?.platform && <Text style={st.meta}>Platform: {String(sub.platform).replace("sandbox", "Staged (pre-store)")}</Text>}
        {!!sub?.guidance && <Text style={st.guidance}>{sub.guidance}</Text>}
        <Text style={st.note}>Payment is handled safely through Apple In-App Purchase / Google Play Billing on your device — Orrbbit never stores card details, and there is no card checkout on desktop.</Text>
        <View style={st.btnRow}>
          <Pressable testID="bizsub-manage" onPress={manage} style={st.primaryBtn}><Text style={st.primaryTxt}>Manage Subscription</Text></Pressable>
          {active ? (
            <Pressable testID="bizsub-cancel" onPress={cancel} style={st.outlineBtn}><Text style={st.outlineTxt}>Cancel Subscription</Text></Pressable>
          ) : (
            <Pressable testID="bizsub-restore" onPress={restore} style={st.outlineBtn}><Text style={[st.outlineTxt, { color: colors.cobalt }]}>Restore Purchase</Text></Pressable>
          )}
        </View>
      </BizCard>
      <BizCard>
        <Text style={st.section}>Includes</Text>
        {INCLUDES.map((i) => (
          <View key={i} style={st.incRow}>
            <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
            <Text style={st.incTxt}>{i}</Text>
          </View>
        ))}
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  plan: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  price: { color: colors.text, fontSize: 40, fontWeight: "800", marginTop: 4 },
  per: { fontSize: font.base, color: colors.textSecondary, fontWeight: "600" },
  stateRow: { flexDirection: "row", gap: 6, marginTop: spacing.md },
  stateLbl: { color: colors.textSecondary, fontSize: font.base },
  state: { fontSize: font.base, fontWeight: "800", textTransform: "capitalize" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4 },
  guidance: { color: "#B45309", fontSize: font.sm, marginTop: spacing.md, lineHeight: 19 },
  note: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.md, lineHeight: 18 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, minHeight: 44, justifyContent: "center" },
  primaryTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, minHeight: 44, justifyContent: "center" },
  outlineTxt: { color: "#DC2626", fontSize: font.sm, fontWeight: "800" },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.sm },
  incRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  incTxt: { color: colors.text, fontSize: font.sm },
});

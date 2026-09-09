import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { getBusinessSubscription } from "@/src/services/businessService";

const INCLUDES = [
  "Business Profile", "Verified badge once approved", "Mobile Business Dashboard",
  "Desktop Business Dashboard", "Business Hosted Events", "Event poster/photo",
  "Nearby Radar discovery", "Attendee management", "Notifications", "Analytics",
  "Ratings & reviews", "Business tools"];

export default function BizSubscription() {
  const [sub, setSub] = useState<any | null>(null);
  useFocusEffect(useCallback(() => { getBusinessSubscription().then(setSub).catch(() => {}); }, []));

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
        {sub?.renews_at && <Text style={st.meta}>Renews {new Date(sub.renews_at).toLocaleDateString()}</Text>}
        {!!sub?.guidance && <Text style={st.guidance}>{sub.guidance}</Text>}
        <Text style={st.note}>Payment is handled safely through Apple In-App Purchase / Google Play Billing on your device — Orrbbit never stores card details, and there is no card checkout on desktop.</Text>
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
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.sm },
  incRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  incTxt: { color: colors.text, fontSize: font.sm },
});

import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { getMyBusiness, submitBusinessVerification, Business } from "@/src/services/businessService";
import { showAlert } from "@/src/lib/alert";
import { VerifBadge } from "./index";

export default function BusinessProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [biz, setBiz] = useState<Business | null>(null);

  useFocusEffect(useCallback(() => {
    getMyBusiness().then((r) => setBiz(r.business)).catch(() => {});
  }, []));

  const submitVerification = async () => {
    if (!biz) return;
    try {
      await submitBusinessVerification({
        legal_name: biz.name, abn: biz.abn || "", email: biz.email || "",
        website: biz.website || "", address: biz.location_display,
      });
      showAlert("Submitted for review", "Our team will review your business verification shortly.");
      getMyBusiness().then((r) => setBiz(r.business)).catch(() => {});
    } catch (e: any) {
      showAlert("Verification", e?.message || "Could not submit verification.");
    }
  };

  const sub = biz?.subscription;
  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
      <Text style={st.title}>Business Profile</Text>
      {biz && (
        <>
          {biz.cover_url && <Image source={{ uri: biz.cover_url }} style={st.cover} />}
          <View style={st.headRow}>
            {biz.logo_url ? <Image source={{ uri: biz.logo_url }} style={st.logo} /> :
              <View style={[st.logo, st.logoPh]}><Ionicons name="storefront" size={22} color={colors.cobalt} /></View>}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={st.name} numberOfLines={1}>{biz.name}</Text>
                {biz.verified && <Ionicons name="checkmark-circle" size={18} color={colors.teal} />}
              </View>
              <Text style={st.cat}>{biz.category} · {biz.location_display}</Text>
            </View>
          </View>
          <VerifBadge status={biz.verification_status || "Not Submitted"} />
          {!!biz.verification_note && <Text style={st.note}>Note from Orrbbit: {biz.verification_note}</Text>}
          {(biz.verification_status === "Not Submitted" || biz.verification_status === "More Info Required" || biz.verification_status === "Rejected") && (
            <Pressable testID="biz-verify-submit" onPress={submitVerification} style={st.verifyBtn}>
              <Ionicons name="shield-checkmark" size={16} color="#FFF" />
              <Text style={st.verifyTxt}>{biz.verification_status === "Not Submitted" ? "Submit for verification" : "Resubmit verification"}</Text>
            </Pressable>
          )}

          <Text style={st.desc}>{biz.description}</Text>
          <View style={st.metaBox}>
            {!!biz.website && <Text style={st.metaTxt}>🌐 {biz.website}</Text>}
            {!!biz.phone && <Text style={st.metaTxt}>📞 {biz.phone}</Text>}
            <Text style={st.metaTxt}>✉️ {biz.email}</Text>
          </View>

          <View style={st.subCard}>
            <Text style={st.subTitle}>Orrbbit Business — Full Access</Text>
            <Text style={st.subPrice}>{sub?.price || "$5.99/month"}</Text>
            <Text style={st.subState}>Status: {(sub?.status || "not_subscribed").replace("_", " ")}</Text>
            {sub?.billing_pending_configuration && (
              <Text style={st.subNote}>Store billing configuration pending — Business access is currently staged. Apple/Google in-app purchase setup is required before live charges.</Text>
            )}
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            <Pressable testID="biz-edit-profile" onPress={() => router.push("/(auth)/business-setup")} style={st.rowBtn}>
              <Ionicons name="create-outline" size={18} color={colors.text} /><Text style={st.rowTxt}>Edit Business Profile</Text>
            </Pressable>
            <Pressable testID="biz-view-public" onPress={() => router.push(`/business/${biz.slug || biz.id}`)} style={st.rowBtn}>
              <Ionicons name="eye-outline" size={18} color={colors.text} /><Text style={st.rowTxt}>View Public Profile</Text>
            </Pressable>
            <Pressable testID="biz-logout" onPress={signOut} style={st.rowBtn}>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" /><Text style={[st.rowTxt, { color: "#DC2626" }]}>Log out</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginBottom: spacing.lg },
  cover: { width: "100%", height: 130, borderRadius: 20, marginBottom: spacing.lg },
  headRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
  logo: { width: 56, height: 56, borderRadius: 16 },
  logoPh: { backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800", flexShrink: 1 },
  cat: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  note: { color: "#B45309", fontSize: font.sm, marginTop: spacing.sm },
  verifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.teal, borderRadius: 14, paddingVertical: 12, marginTop: spacing.md },
  verifyTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  desc: { color: colors.text, fontSize: font.base, lineHeight: 21, marginTop: spacing.lg },
  metaBox: { marginTop: spacing.md, gap: 4 },
  metaTxt: { color: colors.textSecondary, fontSize: font.sm },
  subCard: { borderWidth: 1, borderColor: colors.cobalt, backgroundColor: colors.cobaltSoft, borderRadius: 16, padding: spacing.lg, marginTop: spacing.xl },
  subTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  subPrice: { color: colors.cobalt, fontSize: font.xl, fontWeight: "800", marginTop: 2 },
  subState: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4, fontWeight: "600" },
  subNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: 6, lineHeight: 17 },
  rowBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.lg },
  rowTxt: { color: colors.text, fontSize: font.base, fontWeight: "700" },
});

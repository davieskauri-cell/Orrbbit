import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { getMyBusiness, submitBusinessVerification, Business } from "@/src/services/businessService";
import { showAlert } from "@/src/lib/alert";
import { openLegal } from "@/src/lib/legalLinks";
import { openBusinessDashboard, copyBusinessDashboardLink } from "@/src/lib/businessLinks";
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

  const deleteAccount = () => {
    showAlert(
      "Delete Business Account?",
      "This permanently deletes your business account, Business Profile and cancels your hosted events. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api("/users/me", { method: "DELETE" });
              await signOut();
            } catch (e: any) {
              showAlert("Delete account", e?.message || "Could not delete your account.");
            }
          },
        },
      ]
    );
  };

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

          <Section title="ACCOUNT">
            <Row testID="biz-edit-profile" icon="create-outline" label="Edit Business Profile" onPress={() => router.push("/(auth)/business-setup")} />
            <Row testID="biz-menu-verification" icon="shield-checkmark-outline" label="Business Verification" badge={biz.verification_status} onPress={() => router.push("/(auth)/business-setup")} />
            <Row testID="biz-menu-contact" icon="call-outline" label="Business Contact Details" onPress={() => router.push("/business/settings")} />
          </Section>
          <Section title="BUSINESS">
            <Row testID="biz-menu-events" icon="calendar-outline" label="My Events" onPress={() => router.push("/(business)/events")} />
            <Row testID="biz-menu-reviews" icon="star-outline" label="Reviews & Ratings" onPress={() => router.push("/business-reviews")} />
            <Row testID="biz-menu-insights" icon="bar-chart-outline" label="Insights / Analytics" onPress={() => router.push("/(business)/insights")} />
            <Row testID="biz-menu-notifications" icon="notifications-outline" label="Notifications" onPress={() => router.push("/(business)/notifications")} />
          </Section>
          <Section title="SUBSCRIPTION">
            <Row testID="biz-menu-plan" icon="ribbon-outline" label="Orrbbit Business Plan" badge={(sub?.status || "not subscribed").replace("_", " ")} onPress={() => router.push("/business-subscription")} />
            <Row testID="biz-menu-manage-sub" icon="card-outline" label="Manage Subscription" onPress={() => router.push("/business-subscription")} />
          </Section>
          <Section title="WEB ACCESS">
            <Row testID="biz-open-dashboard" icon="desktop-outline" label="Open Business Web Dashboard" onPress={openBusinessDashboard} />
            <Row testID="biz-copy-dashboard" icon="copy-outline" label="Copy Business Dashboard Link" onPress={copyBusinessDashboardLink} />
            <Row testID="biz-view-public" icon="eye-outline" label="View Public Business Profile" onPress={() => router.push(`/business/${biz.slug || biz.id}`)} />
          </Section>
          <Section title="SUPPORT & LEGAL">
            <Row icon="help-buoy-outline" label="Help & Support" onPress={() => openLegal("support")} />
            <Row icon="document-text-outline" label="Terms of Service" onPress={() => openLegal("terms")} />
            <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => openLegal("privacy")} />
            <Row icon="people-outline" label="Community Guidelines" onPress={() => openLegal("community_guidelines")} />
            <Row icon="shield-outline" label="Safety Centre" onPress={() => openLegal("safety")} />
            <Row icon="receipt-outline" label="Payments / Cancellation / Refund Policy" onPress={() => openLegal("refunds")} />
            <Row icon="briefcase-outline" label="Business Policies" onPress={() => openLegal("policies")} />
          </Section>
          <Section title="ACCOUNT SETTINGS">
            <Row testID="biz-menu-settings" icon="settings-outline" label="Notification Settings" onPress={() => router.push("/business/settings")} />
            <Row icon="mail-outline" label="Email Preferences" onPress={() => router.push("/email-preferences")} />
            <Row icon="key-outline" label="Password / Security" onPress={() => router.push("/(auth)/forgot-password")} />
            <Row testID="biz-logout" icon="log-out-outline" label="Sign Out" danger onPress={signOut} />
          </Section>
          <Section title="DANGER ZONE">
            <Row testID="biz-delete-account" icon="trash-outline" label="Delete Business Account" danger onPress={deleteAccount} />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={st.sectionLbl}>{title}</Text>
      <View style={st.sectionBox}>{children}</View>
    </View>
  );
}

function Row({ icon, label, onPress, badge, danger, testID }: { icon: string; label: string; onPress: () => void; badge?: string; danger?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={st.menuRow}>
      <Ionicons name={icon as any} size={18} color={danger ? "#DC2626" : colors.cobalt} />
      <Text style={[st.menuTxt, danger && { color: "#DC2626" }]}>{label}</Text>
      {!!badge && <View style={st.menuBadge}><Text style={st.menuBadgeTxt}>{badge}</Text></View>}
      <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
    </Pressable>
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
  sectionLbl: { color: colors.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.sm },
  sectionBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.card, minHeight: 48 },
  menuTxt: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "600" },
  menuBadge: { backgroundColor: colors.cobaltSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  menuBadgeTxt: { color: colors.cobalt, fontSize: 10, fontWeight: "800" },
});

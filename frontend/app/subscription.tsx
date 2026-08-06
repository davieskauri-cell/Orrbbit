import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { track } from "@/src/services/analyticsService";
import { LEGAL_LINKS } from "@/src/lib/legalLinks";
import { colors, spacing, radius, font } from "@/src/theme";

const NAVY = "#0B2545";
const PLAN_NAMES: Record<string, string> = { free: "Orrbbit Free", plus: "Orrbbit Plus", pro: "Orrbbit Pro" };
const PLAN_RADIUS: Record<string, string> = { free: "Up to 250 m", plus: "Up to 500 m", pro: "Up to 1 km" };

type Sub = {
  plan: string;
  max_radius_m: number;
  billing_mode: string;
  entitlement: null | {
    plan: string; entitlement_status: string; product_id: string; platform: string;
    sandbox: boolean; purchase_date: string; renewal_date: string;
    auto_renew_status: boolean; cancellation_date: string | null;
  };
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Sub>("/users/me/subscription").then(setSub).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res: any = await api("/billing/restore", { method: "POST" });
      if (res.restored) {
        track("purchase_restored");
        const updated = await api("/auth/me");
        setUser(updated as any);
        load();
      }
      showAlert(res.restored ? "Purchases restored" : "Nothing to restore", res.message);
    } catch (e: any) {
      showAlert("Restore failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const manage = () => {
    if (!sub?.entitlement) return router.push("/plans");
    if (sub.entitlement.sandbox) {
      showAlert(
        "Manage test subscription",
        "This is a sandbox (test) subscription. You can turn off auto-renew or end it now.",
        [
          { text: "Cancel auto-renew", onPress: async () => {
            try {
              const r: any = await api("/billing/sandbox/cancel", { method: "POST", body: {} });
              showAlert("Done", r.message); load();
            } catch (e: any) { showAlert("Error", e.message); }
          } },
          { text: "End now (simulate expiry)", style: "destructive", onPress: async () => {
            try {
              const r: any = await api("/billing/sandbox/expire", { method: "POST", body: {} });
              track("subscription_expired");
              const updated = await api("/auth/me"); setUser(updated as any);
              showAlert("Done", r.message); load();
            } catch (e: any) { showAlert("Error", e.message); }
          } },
          { text: "Close", style: "cancel" },
        ]
      );
    } else {
      showAlert("Manage subscription", "Manage or cancel your subscription in your App Store or Google Play account settings.");
    }
  };

  if (!sub) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.loading}>Loading your subscription…</Text>
      </View>
    );
  }

  const renewalLine = () => {
    const e = sub.entitlement;
    if (!e) return "No active subscription";
    if (e.cancellation_date || !e.auto_renew_status) return `Cancelled — active until ${new Date(e.renewal_date).toLocaleDateString()}`;
    return `Renews ${new Date(e.renewal_date).toLocaleDateString()}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      testID="subscription-screen"
    >
      <View style={styles.headerRow}>
        <Pressable testID="sub-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Subscription</Text>
      </View>

      <View style={styles.planCard} testID="sub-plan-card">
        <View style={styles.planRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={sub.plan === "free" ? "person" : sub.plan === "plus" ? "people" : "radio"} size={22} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{PLAN_NAMES[sub.plan] || sub.plan}</Text>
            <Text style={styles.planRadius}>{PLAN_RADIUS[sub.plan]}</Text>
            <Text style={styles.renewal}>{renewalLine()}</Text>
          </View>
          {sub.entitlement?.sandbox && (
            <View style={styles.sandboxTag}>
              <Text style={styles.sandboxText}>TEST</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.menu}>
        {sub.plan !== "pro" && (
          <Pressable testID="sub-upgrade" style={styles.row} onPress={() => router.push(`/plans?plan=${sub.plan === "free" ? "plus" : "pro"}`)}>
            <Ionicons name="arrow-up-circle-outline" size={20} color={colors.teal} />
            <Text style={styles.rowLabel}>Upgrade options</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
        <Pressable testID="sub-restore" style={styles.row} onPress={restore}>
          <Ionicons name="refresh-outline" size={20} color={colors.teal} />
          <Text style={styles.rowLabel}>{busy ? "Checking…" : "Restore Purchases"}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
        {sub.plan !== "free" && (
          <Pressable testID="sub-manage" style={styles.row} onPress={manage}>
            <Ionicons name="settings-outline" size={20} color={colors.teal} />
            <Text style={styles.rowLabel}>Manage Subscription</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
        <Pressable testID="sub-support" style={styles.row} onPress={() => Linking.openURL(LEGAL_LINKS.support).catch(() => {})}>
          <Ionicons name="help-circle-outline" size={20} color={colors.teal} />
          <Text style={styles.rowLabel}>Subscription support</Text>
          <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      <Text style={styles.note}>
        Your plan controls your maximum Radar radius across People and Professional modes. Safety
        features, messaging after acceptance and privacy controls are always included on every plan.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loading: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  backBtn: { minHeight: 44, minWidth: 34, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  planCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, backgroundColor: "#FFF", borderWidth: 1.5, borderColor: colors.teal, borderRadius: radius.lg, padding: spacing.lg },
  planRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  planName: { color: NAVY, fontSize: font.xl, fontWeight: "800" },
  planRadius: { color: colors.teal, fontSize: font.base, fontWeight: "800", marginTop: 2 },
  renewal: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  sandboxTag: { backgroundColor: "#FFF4EC", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  sandboxText: { color: colors.orange, fontSize: 10, fontWeight: "800" },
  menu: { marginHorizontal: spacing.xl, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.border, minHeight: 52 },
  rowLabel: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "600" },
  note: { color: colors.textTertiary, fontSize: font.sm, lineHeight: 19, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});

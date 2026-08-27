import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import Logo from "@/src/components/Logo";
import { LEGAL_LINKS } from "@/src/lib/legalLinks";
import { track } from "@/src/services/analyticsService";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const NAVY = "#0B2545";

const PLANS = [
  {
    key: "free",
    name: "Orrbbit Free",
    tagline: "Best for people directly nearby",
    price: null,
    radius: "Up to 250 m",
    maxRadiusM: 250,
    badge: { text: "Included", style: "soft" as const },
    icon: "person" as const,
    features: [
      "People + Professional modes",
      "Radar + Nearby",
      "Connection requests",
      "Messaging after acceptance",
      "Basic filters",
      "Full privacy + safety controls",
    ],
  },
  {
    key: "plus",
    name: "Orrbbit Plus",
    tagline: "Expand your orbit",
    price: "$6.99 per month",
    radius: "Up to 500 m",
    maxRadiusM: 500,
    badge: { text: "Most Popular", style: "teal" as const },
    icon: "people" as const,
    features: [
      "Everything in Free",
      "Radius up to 500 m",
      "Additional filters",
      "Longer Crossed Paths history",
      "More visibility controls",
      "Expanded nearby discovery",
    ],
  },
  {
    key: "pro",
    name: "Orrbbit Pro",
    tagline: "Unlock your widest local reach",
    price: "$11.99 per month",
    radius: "Up to 1 km",
    maxRadiusM: 1000,
    badge: { text: "Best Reach", style: "navy" as const },
    icon: "radio" as const,
    features: [
      "Everything in Plus",
      "250 m, 500 m, 750 m and 1 km settings",
      "Advanced People + Professional filters",
      "Extended Crossed Paths history",
      "Enhanced profile insights",
      "Priority alerts for nearby activity",
    ],
  },
];

const RADIUS_CHIPS = [
  { label: "250m", m: 250 },
  { label: "500m", m: 500 },
  { label: "750m", m: 750 },
  { label: "1km", m: 1000 },
];

const PLAN_ORDER: Record<string, number> = { free: 0, plus: 1, pro: 2 };

export default function PlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next, plan: preselect } = useLocalSearchParams<{ next?: string; plan?: string }>();
  const { user, setUser } = useAuth();
  const current = user?.plan || "free";

  const [selected, setSelected] = useState<string>(
    preselect && PLAN_ORDER[preselect] !== undefined ? preselect : current
  );
  const [billing, setBilling] = useState<{ purchases_available: boolean; sandbox_eligible: boolean; billing_mode: string } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [almostVisible, setAlmostVisible] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("plan_screen_viewed");
    api("/billing/config").then((c: any) => setBilling(c)).catch(() => setBilling({ purchases_available: false, sandbox_eligible: false, billing_mode: "disabled" }));
  }, []);

  useEffect(() => {
    if (selected === "free") track("free_plan_selected");
    else if (selected === "plus") track("plus_plan_selected");
    else if (selected === "pro") track("pro_plan_selected");
  }, [selected]);

  const done = () => {
    if (next === "setup") router.replace("/(auth)/profile-setup");
    else router.back();
  };

  const canPurchase = !!billing?.sandbox_eligible; // server re-verifies — never trust this alone
  const selPlan = PLANS.find((p) => p.key === selected)!;
  const isCurrent = selected === current;
  const isUpgrade = PLAN_ORDER[selected] > PLAN_ORDER[current];
  const currentIsPaid = current !== "free";

  const ctaTitle = () => {
    if (isCurrent) return currentIsPaid ? "Current Plan" : "Continue with Free";
    if (selected === "free") return currentIsPaid ? "Manage Subscription" : "Continue with Free";
    return selected === "plus" ? "Choose Plus" : "Choose Pro";
  };

  const onCta = async () => {
    if (busy) return;
    if (isCurrent) {
      if (!currentIsPaid) return done();
      return router.push("/subscription");
    }
    if (selected === "free") {
      if (currentIsPaid) return router.push("/subscription");
      return done();
    }
    if (!canPurchase) {
      // Payments not enabled for this account/build — branded pre-launch sheet, never a fake checkout.
      track(selected === "plus" ? "plus_interest_viewed" : "pro_interest_viewed");
      setAlmostVisible(true);
      return;
    }
    setConfirmVisible(true);
  };

  const notifyMe = async () => {
    if (notifyBusy) return;
    setNotifyBusy(true);
    try {
      track(selected === "plus" ? "plus_interest" : "pro_interest");
      const res: any = await api("/billing/interest", { method: "POST", body: { plan: selected } });
      setAlmostVisible(false);
      showAlert("Thanks!", res?.message || "We'll let you know when subscriptions are available.");
    } catch (e: any) {
      showAlert("Couldn't save that", e?.message || "Please try again.");
    }
    setNotifyBusy(false);
  };

  const confirmPurchase = async () => {
    setBusy(true);
    track("purchase_started");
    try {
      const res: any = await api("/billing/sandbox/purchase", {
        method: "POST",
        body: { plan: selected, platform: Platform.OS },
      });
      track("purchase_completed");
      track(isUpgrade ? "subscription_upgraded" : "subscription_downgraded");
      const updated = await api("/auth/me");
      setUser(updated as any);
      setConfirmVisible(false);
      showAlert("You're all set", res.message, [{ text: "Continue", onPress: done }]);
    } catch (e: any) {
      track("purchase_failed");
      setConfirmVisible(false);
      showAlert("Purchase not completed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      const res: any = await api("/billing/restore", { method: "POST" });
      if (res.restored) {
        track("purchase_restored");
        const updated = await api("/auth/me");
        setUser(updated as any);
      }
      showAlert(res.restored ? "Purchases restored" : "Nothing to restore", res.message);
    } catch (e: any) {
      showAlert("Restore failed", e.message || "Please try again.");
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl + 90 }}
        showsVerticalScrollIndicator={false}
        testID="plans-screen"
      >
        <View style={styles.topRow}>
          <Pressable testID="plans-back" onPress={() => (next === "setup" ? done() : router.back())} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={NAVY} />
          </Pressable>
          <View style={styles.logoWrap}>
            <Logo size={30} />
          </View>
          <View style={{ width: 34 }} />
        </View>

        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.sub}>Select the radius that fits your world.</Text>

        {PLANS.map((p) => {
          const sel = selected === p.key;
          const cur = current === p.key;
          return (
            <Pressable
              key={p.key}
              testID={`plan-card-${p.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}. ${p.tagline}. ${p.price ? `${p.price.replace("per month", "per month")}. ` : "Free. "}${p.radius}.${cur ? " Current plan." : ""}${sel ? " Selected." : ""}`}
              style={[
                styles.card,
                shadow.card,
                sel && styles.cardSelected,
                p.key === "pro" && !sel && styles.cardPro,
              ]}
              onPress={() => setSelected(p.key)}
            >
              <View style={styles.cardHead}>
                <View style={[styles.iconCircle, p.key === "pro" && { backgroundColor: "#E8EDF5" }]}>
                  <Ionicons name={p.icon} size={22} color={p.key === "pro" ? NAVY : colors.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{p.name}</Text>
                  <Text style={styles.planTagline}>{p.tagline}</Text>
                  <Text style={styles.planRadius}>{p.radius}</Text>
                  {!!p.price && <Text style={styles.planPrice}>{p.price}</Text>}
                </View>
                <View style={[styles.badge, p.badge.style === "teal" && styles.badgeTeal, p.badge.style === "navy" && styles.badgeNavy]}>
                  <Text style={[styles.badgeText, p.badge.style !== "soft" && { color: "#FFF" }]}>{p.badge.text}</Text>
                </View>
              </View>
              <View style={styles.featureList}>
                {p.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              {cur && (
                <View style={styles.currentTag} testID={`current-plan-${p.key}`}>
                  <Ionicons name="checkmark" size={12} color={colors.teal} />
                  <Text style={styles.currentTagText}>Current plan</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        <Text style={styles.radiusHeading}>Choose your radar radius</Text>
        <View style={styles.chipRow} accessibilityLabel={`Radius options for ${selPlan.name}`}>
          {RADIUS_CHIPS.map((c) => {
            const unlocked = c.m <= selPlan.maxRadiusM;
            return (
              <View key={c.m} style={[styles.chip, unlocked ? styles.chipOn : styles.chipOff]}>
                {!unlocked && <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />}
                <Text style={[styles.chipText, unlocked && { color: "#FFF" }]}>{c.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={15} color={colors.teal} />
          <Text style={styles.infoText}>Higher radius available with Plus and Pro plans.</Text>
        </View>

        {currentIsPaid && (
          <Pressable testID="plans-manage" style={styles.manageLink} onPress={() => router.push("/subscription")}>
            <Text style={styles.manageLinkText}>Manage plan</Text>
          </Pressable>
        )}
        <Pressable testID="plans-restore" style={styles.manageLink} onPress={restore}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="plans-cta"
          title={ctaTitle()}
          onPress={onCta}
          loading={busy}
          color={colors.teal}
          disabled={isCurrent && currentIsPaid}
        />
      </View>

      <Modal visible={almostVisible} transparent animationType="slide" onRequestClose={() => setAlmostVisible(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setAlmostVisible(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]} onPress={() => {}} testID="almost-ready-sheet">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetIconWrap}>
              <Ionicons name={selected === "pro" ? "radio" : "people"} size={26} color={selected === "pro" ? NAVY : colors.teal} />
            </View>
            <Text style={styles.sheetTitle} testID="almost-ready-title">
              {selected === "pro" ? "Orrbbit Pro is almost ready" : "Orrbbit Plus is almost ready"}
            </Text>
            <Text style={styles.sheetBody}>
              Paid subscriptions are not yet available in this build. You can explore the plan now,
              and we{"'"}ll let you know when subscriptions are available.
            </Text>
            <PrimaryButton testID="almost-notify-btn" title="Notify me" onPress={notifyMe} loading={notifyBusy} color={colors.teal} />
            <Pressable testID="almost-notnow-btn" style={styles.cancelBtn} onPress={() => setAlmostVisible(false)}>
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => { track("purchase_cancelled"); setConfirmVisible(false); }}>
        <View style={styles.overlay}>
          <View style={styles.confirmCard} testID="purchase-confirm">
            <Text style={styles.confirmTitle}>{selPlan.name}</Text>
            <Text style={styles.confirmPrice}>{selPlan.price} · {selPlan.radius}</Text>
            {selPlan.features.slice(0, 4).map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color={colors.teal} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
            {billing?.billing_mode === "sandbox" && (
              <View style={styles.sandboxTag} testID="sandbox-label">
                <Ionicons name="flask-outline" size={12} color={colors.orange} />
                <Text style={styles.sandboxText}>Test purchase (sandbox) — no money is charged</Text>
              </View>
            )}
            <Text style={styles.recurring}>
              Payment will be charged through your App Store or Google Play account. The subscription
              renews automatically unless cancelled through your store account.
            </Text>
            <View style={styles.legalRow}>
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_LINKS.terms)}>Terms</Text>
              <Text style={styles.legalDot}>·</Text>
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_LINKS.privacy)}>Privacy</Text>
              <Text style={styles.legalDot}>·</Text>
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_LINKS.refunds)}>Refunds</Text>
              <Text style={styles.legalDot}>·</Text>
              <Text style={styles.legalLink} onPress={restore}>Restore Purchases</Text>
            </View>
            <PrimaryButton testID="purchase-confirm-btn" title={`Subscribe · ${selPlan.price}`} onPress={confirmPurchase} loading={busy} color={colors.teal} />
            <Pressable
              testID="purchase-cancel-btn"
              style={styles.cancelBtn}
              onPress={() => { track("purchase_cancelled"); setConfirmVisible(false); }}
            >
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg },
  backBtn: { minHeight: 44, minWidth: 34, justifyContent: "center" },
  logoWrap: { flex: 1, alignItems: "center" },
  title: { color: NAVY, fontSize: font.display, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
  sub: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", marginTop: 4, marginBottom: spacing.lg },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: "#FFF",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardSelected: { borderColor: colors.teal, borderWidth: 2 },
  cardPro: { borderColor: "#C7D2E0" },
  cardHead: { flexDirection: "row", gap: spacing.md },
  iconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  planName: { color: NAVY, fontSize: font.xl, fontWeight: "800" },
  planTagline: { color: colors.textSecondary, fontSize: font.sm, marginTop: 1 },
  planRadius: { color: colors.teal, fontSize: font.lg, fontWeight: "800", marginTop: 4 },
  planPrice: { color: NAVY, fontSize: font.base, fontWeight: "700", marginTop: 2 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.tealSoft, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  badgeTeal: { backgroundColor: colors.teal },
  badgeNavy: { backgroundColor: NAVY },
  badgeText: { color: colors.teal, fontSize: 11, fontWeight: "800", textAlign: "center", maxWidth: 72 },
  featureList: { marginTop: spacing.md, gap: 7 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { color: colors.text, fontSize: font.sm, fontWeight: "500", flex: 1 },
  currentTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: spacing.md, backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  currentTagText: { color: colors.teal, fontSize: 11, fontWeight: "800" },
  radiusHeading: { color: NAVY, fontSize: font.lg, fontWeight: "800", textAlign: "center", marginTop: spacing.lg },
  chipRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: 10, minHeight: 40 },
  chipOn: { backgroundColor: colors.teal },
  chipOff: { backgroundColor: "#FFF", borderWidth: 1.5, borderColor: colors.border },
  chipText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "800" },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  infoText: { color: colors.textSecondary, fontSize: font.sm },
  manageLink: { alignItems: "center", marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  manageLinkText: { color: NAVY, fontWeight: "800", fontSize: font.base },
  restoreText: { color: colors.textSecondary, fontWeight: "600", fontSize: font.sm },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  overlay: { flex: 1, backgroundColor: "rgba(8,26,53,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: "#FFF", borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 400, gap: 7 },
  confirmTitle: { color: NAVY, fontSize: font.xl, fontWeight: "800" },
  confirmPrice: { color: colors.teal, fontSize: font.lg, fontWeight: "800", marginBottom: 4 },
  sandboxTag: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF4EC", borderRadius: 8, padding: spacing.sm, marginTop: 4 },
  sandboxText: { color: colors.orange, fontSize: 11, fontWeight: "800", flex: 1 },
  recurring: { color: colors.textSecondary, fontSize: 11.5, lineHeight: 17, marginTop: 6 },
  legalRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: spacing.md },
  legalLink: { color: colors.teal, fontSize: font.sm, fontWeight: "700", textDecorationLine: "underline" },
  legalDot: { color: colors.textTertiary },
  cancelBtn: { alignItems: "center", paddingVertical: 10, minHeight: 42, justifyContent: "center" },
  cancelText: { color: colors.textSecondary, fontWeight: "600" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(8,26,53,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFF", borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm, maxHeight: "80%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  sheetIconWrap: { alignSelf: "center", width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: NAVY, fontSize: font.lg, fontWeight: "800", textAlign: "center" },
  sheetBody: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20, textAlign: "center", marginBottom: spacing.sm },
});

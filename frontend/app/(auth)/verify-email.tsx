import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, AppState, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font } from "@/src/theme";

export default function VerifyEmailGate() {
  const { user, refreshUser, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cooldown, setCooldown] = useState(0);
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<any>(null);

  const checkVerified = async () => {
    const u: any = await refreshUser().catch(() => null);
    if (u?.email_verified) {
      // Continue onboarding at the correct step: Profile Setup → Set Vibe → Radar
      if (u?.vibe) router.replace("/(tabs)");
      else if ((u?.photos || []).length < 2) router.replace("/(auth)/profile-setup");
      else router.replace("/(auth)/choose-vibe");
    }
    return !!u?.email_verified;
  };

  useEffect(() => {
    checkVerified();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") checkVerified(); // auto-continue when returning from the mail app
    });
    return () => { sub.remove(); if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    timer.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(timer.current); return 0; } return c - 1; });
    }, 1000);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setMsg("");
    try {
      await api("/email/resend-verification", { method: "POST", body: {} });
      setMsg("Verification email sent.");
      startCooldown();
    } catch (e: any) {
      setMsg(e?.message || "Couldn't resend right now. Please try again shortly.");
    }
  };

  const submitNewEmail = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r: any = await api("/email/change-unverified", { method: "POST", body: { new_email: newEmail.trim() } });
      await refreshUser().catch(() => {});
      setChanging(false);
      setNewEmail("");
      setMsg(`Verification email sent to ${r.email}.`);
      startCooldown();
    } catch (e: any) {
      setMsg(e?.message || "Couldn't change the email.");
    }
    setBusy(false);
  };

  const confirmVerified = async () => {
    setBusy(true);
    const ok = await checkVerified();
    if (!ok) setMsg("We haven't been able to confirm your email yet. Please open the verification link in your email and try again.");
    setBusy(false);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.brand}>
        <LogoMark size={56} />
        <Wordmark height={24} />
      </View>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>We&rsquo;ve sent a verification link to</Text>
      <Text style={styles.email} testID="gate-email">{user?.email}</Text>
      <Text style={styles.sub}>Open the email and tap Verify Email to continue to Orrbbit.</Text>

      <View style={{ width: "100%", marginTop: spacing.xl, gap: spacing.md }}>
        <PrimaryButton testID="gate-open-email" title="Open Email" onPress={() => Linking.openURL("message:").catch(() => Linking.openURL("mailto:"))} />
        <Pressable
          testID="gate-resend"
          onPress={resend}
          disabled={cooldown > 0}
          style={[styles.secondaryBtn, cooldown > 0 && { opacity: 0.55 }]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>
            {cooldown > 0 ? `Resend available in ${cooldown} seconds` : "Resend verification email"}
          </Text>
        </Pressable>
        <Pressable testID="gate-check" onPress={confirmVerified} disabled={busy} style={styles.secondaryBtn} accessibilityRole="button">
          <Text style={styles.secondaryText}>I&rsquo;ve verified my email</Text>
        </Pressable>
      </View>

      {changing ? (
        <View style={{ width: "100%", marginTop: spacing.lg }}>
          <TextInput
            testID="gate-new-email"
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Correct email address"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />
          <PrimaryButton testID="gate-change-submit" title="Update & resend" onPress={submitNewEmail} loading={busy} style={{ marginTop: spacing.sm }} />
        </View>
      ) : (
        <Pressable testID="gate-change" onPress={() => setChanging(true)} style={{ marginTop: spacing.lg, minHeight: 44, justifyContent: "center" }}>
          <Text style={styles.linkText}>Wrong email? Change email</Text>
        </Pressable>
      )}

      {!!msg && <Text style={styles.msg} testID="gate-msg">{msg}</Text>}
      <Text style={styles.note}>Once verified, return to Orrbbit and we&rsquo;ll continue automatically.</Text>
      <Text style={styles.help}>Need help? Contact support@orrbbit.com</Text>
      <Pressable testID="gate-logout" onPress={signOut} style={{ marginTop: spacing.md, minHeight: 44, justifyContent: "center" }}>
        <Text style={[styles.linkText, { color: colors.textSecondary }]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: "center", paddingHorizontal: spacing.xl },
  brand: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginBottom: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", lineHeight: 21 },
  email: { color: colors.teal, fontSize: font.lg, fontWeight: "800", marginVertical: spacing.xs },
  secondaryBtn: {
    minHeight: 48, alignItems: "center", justifyContent: "center",
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  secondaryText: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  linkText: { color: colors.teal, fontSize: font.base, fontWeight: "700" },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, minHeight: 48, color: colors.text, fontSize: font.base,
  },
  msg: { color: colors.orange, fontSize: font.sm, textAlign: "center", marginTop: spacing.md },
  note: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.lg },
  help: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm },
});

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { LogoMark } from "@/src/components/Logo";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import FormField from "@/src/components/FormField";
import { colors, spacing, font } from "@/src/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError(null);
    if (!email.trim().includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setStep("reset");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { email: email.trim(), code: code.trim(), new_password: password },
      });
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable testID="forgot-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <LogoMark size={56} />
        </View>

        {step === "email" && (
          <>
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.sub}>{"Enter your email and we'll send you a 6-digit reset code."}</Text>
            <FormField
              label="Email"
              inputTestID="forgot-email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {error && <Text testID="forgot-error" style={styles.error}>{error}</Text>}
            <PrimaryButton
              testID="forgot-send"
              title="Send Reset Code"
              onPress={sendCode}
              loading={busy}
              style={{ marginTop: spacing.xl }}
            />
          </>
        )}

        {step === "reset" && (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sub}>
              We sent a 6-digit code to {email.trim()}. It expires in 15 minutes.
            </Text>
            <FormField
              label="Reset code"
              inputTestID="forgot-code"
              value={code}
              onChangeText={(t: string) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="123456"
              keyboardType="number-pad"
            />
            <FormField
              label="New password"
              inputTestID="forgot-new-password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
            />
            <FormField
              label="Confirm new password"
              inputTestID="forgot-confirm-password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              secureTextEntry
            />
            {error && <Text testID="forgot-error" style={styles.error}>{error}</Text>}
            <PrimaryButton
              testID="forgot-reset"
              title="Reset Password"
              onPress={reset}
              loading={busy}
              style={{ marginTop: spacing.xl }}
            />
            <Pressable testID="forgot-resend" onPress={sendCode} style={styles.linkRow}>
              <Text style={styles.linkText}>{"Didn't get it? "}</Text>
              <Text style={[styles.linkText, { color: colors.teal, fontWeight: "700" }]}>Resend code</Text>
            </Pressable>
          </>
        )}

        {step === "done" && (
          <View style={{ alignItems: "center" }} testID="forgot-done">
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={30} color={colors.teal} />
            </View>
            <Text style={styles.title}>Password updated</Text>
            <Text style={styles.sub}>You can now sign in to Orrbbit with your new password.</Text>
            <PrimaryButton
              testID="forgot-go-login"
              title="Back to Log In"
              onPress={() => router.replace("/(auth)/login")}
              style={{ alignSelf: "stretch", marginTop: spacing.lg }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.md, marginLeft: -6 },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", textAlign: "center" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.xl, textAlign: "center", lineHeight: 21 },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.lg },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl, paddingVertical: spacing.md },
  linkText: { color: colors.textSecondary, fontSize: font.base },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTestMode } from "@/src/lib/testMode";
import { LogoMark } from "@/src/components/Logo";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, demoLogin } = useAuth();
  const [testMode] = useTestMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const go = (u: { vibe: string | null }) =>
    router.replace(u.vibe ? "/(tabs)" : "/(auth)/choose-vibe");

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const u = await signIn(email.trim(), password);
      go(u);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setError(null);
    setDemoBusy(true);
    try {
      const u = await demoLogin();
      go(u);
    } catch (e: any) {
      setError(e.message || "Demo login failed");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable testID="login-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
          <LogoMark size={56} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>{"Log in to see who's nearby."}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={styles.input}
        />

        {error && (
          <Text testID="login-error" style={styles.error}>
            {error}
          </Text>
        )}

        <PrimaryButton
          testID="login-submit"
          title="Log In"
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing.xl }}
        />
        {testMode && (
          <SecondaryButton
            testID="login-demo"
            title={demoBusy ? "Loading demo…" : "Use Demo Account"}
            onPress={demo}
            color={colors.teal}
            style={{ marginTop: spacing.md, borderColor: colors.teal }}
          />
        )}

        <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.linkRow}>
          <Text style={styles.linkText}>New here? </Text>
          <Text style={[styles.linkText, { color: colors.orange, fontWeight: "700" }]}>Create Account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.md, marginLeft: -6 },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", textAlign: "center" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.xs, marginBottom: spacing.xl, textAlign: "center" },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", marginBottom: spacing.sm, marginTop: spacing.lg },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: font.lg,
    minHeight: 50,
  },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.lg },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl, paddingVertical: spacing.md },
  linkText: { color: colors.textSecondary, fontSize: font.base },
});

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
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, font } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable testID="login-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to pick up your radar.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.onSurfaceSecondary}
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
          placeholderTextColor={colors.onSurfaceSecondary}
          secureTextEntry
          style={styles.input}
        />

        {error && (
          <Text testID="login-error" style={styles.error}>
            {error}
          </Text>
        )}

        <Pressable testID="login-submit" style={styles.btn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/register")} style={styles.linkRow}>
          <Text style={styles.linkText}>New here? </Text>
          <Text style={[styles.linkText, { color: colors.brandPrimary }]}>Create account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.xl, marginLeft: -6 },
  title: { color: colors.onSurface, fontSize: font.display, fontWeight: "500" },
  sub: { color: colors.onSurfaceTertiary, fontSize: font.lg, marginTop: spacing.xs, marginBottom: spacing.xxl },
  label: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginBottom: spacing.sm, marginTop: spacing.lg },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontSize: font.lg,
  },
  error: { color: colors.error, fontSize: font.base, marginTop: spacing.lg },
  btn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "500" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  linkText: { color: colors.onSurfaceTertiary, fontSize: font.base },
});

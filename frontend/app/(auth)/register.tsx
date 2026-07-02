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

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Enter a name, email, and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await register({ email: email.trim(), password, display_name: name.trim(), bio });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Registration failed");
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
        <Pressable testID="register-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>Set up your radar profile in seconds.</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          testID="register-name"
          value={name}
          onChangeText={setName}
          placeholder="Alex"
          placeholderTextColor={colors.onSurfaceSecondary}
          style={styles.input}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="register-email"
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
          testID="register-password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.onSurfaceSecondary}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.label}>Bio (optional)</Text>
        <TextInput
          testID="register-bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A line about you"
          placeholderTextColor={colors.onSurfaceSecondary}
          multiline
          style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
        />

        {error && (
          <Text testID="register-error" style={styles.error}>
            {error}
          </Text>
        )}

        <Pressable testID="register-submit" style={styles.btn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow}>
          <Text style={styles.linkText}>Already have an account? </Text>
          <Text style={[styles.linkText, { color: colors.brandPrimary }]}>Sign in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.lg, marginLeft: -6 },
  title: { color: colors.onSurface, fontSize: font.display, fontWeight: "500" },
  sub: { color: colors.onSurfaceTertiary, fontSize: font.lg, marginTop: spacing.xs, marginBottom: spacing.lg },
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
    marginTop: spacing.xl,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "500" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  linkText: { color: colors.onSurfaceTertiary, fontSize: font.base },
});

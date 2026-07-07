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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { trackSignup } from "@/src/services/analyticsService";
import { colors, spacing, radius, font } from "@/src/theme";

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [confirm18, setConfirm18] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const social = () =>
    Alert.alert("Coming soon", "Social sign-in is coming soon. Use email for now.");

  const submit = async () => {
    setError(null);
    const ageNum = parseInt(age, 10);
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!ageNum || ageNum < 18) return setError("INTRO is currently only available for users 18 and older.");
    if (!confirm18) return setError("Please confirm you are 18 or older.");
    setBusy(true);
    try {
      await register({ email: email.trim(), password, name: name.trim(), age: ageNum });
      trackSignup();
      router.replace("/(auth)/intent");
    } catch (e: any) {
      setError(e.message || "Registration failed");
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
        <Pressable testID="register-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>Meet real people, right around you.</Text>

        <Pressable testID="apple-btn" style={styles.socialBtn} onPress={social}>
          <Ionicons name="logo-apple" size={20} color={colors.text} />
          <Text style={styles.socialText}>Continue with Apple</Text>
        </Pressable>
        <Pressable testID="google-btn" style={styles.socialBtn} onPress={social}>
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={styles.socialText}>Continue with Google</Text>
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          testID="register-name"
          value={name}
          onChangeText={setName}
          placeholder="Alex Smith"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          testID="register-email"
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
          testID="register-password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          style={styles.input}
        />
        <Text style={styles.label}>Age</Text>
        <TextInput
          testID="register-age"
          value={age}
          onChangeText={setAge}
          placeholder="18+"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={3}
          style={styles.input}
        />

        <Pressable
          testID="register-18-checkbox"
          style={styles.checkRow}
          onPress={() => setConfirm18(!confirm18)}
        >
          <Ionicons
            name={confirm18 ? "checkbox" : "square-outline"}
            size={24}
            color={confirm18 ? colors.teal : colors.textTertiary}
          />
          <Text style={styles.checkText}>I confirm I am 18 or older.</Text>
        </Pressable>

        {error && (
          <Text testID="register-error" style={styles.error}>
            {error}
          </Text>
        )}

        <PrimaryButton
          testID="register-submit"
          title="Sign Up"
          onPress={submit}
          loading={busy}
          style={{ marginTop: spacing.lg }}
        />

        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow}>
          <Text style={styles.linkText}>Already have an account? </Text>
          <Text style={[styles.linkText, { color: colors.orange, fontWeight: "700" }]}>Log in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  back: { marginBottom: spacing.md, marginLeft: -6 },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.xs, marginBottom: spacing.lg },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  socialText: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.textTertiary, fontSize: font.sm },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", marginBottom: spacing.sm, marginTop: spacing.md },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  checkText: { color: colors.text, fontSize: font.base, fontWeight: "500" },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.md },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, paddingVertical: spacing.md },
  linkText: { color: colors.textSecondary, fontSize: font.base },
});

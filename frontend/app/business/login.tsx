import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { colors, spacing, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

/** Business login at orrbbit.com/business/login — SAME account as the mobile app. */
export default function BusinessLogin() {
  const router = useRouter();
  const { token, user, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token && user?.account_type === "business") return <Redirect href="/business/dashboard" />;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const u = await signIn(email.trim(), password);
      if (u.account_type !== "business") {
        await signOut();
        setError("This account isn't a Business account. Log in with your Orrbbit Business credentials.");
        return;
      }
      router.replace("/business/dashboard");
    } catch (e: any) {
      setError(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={st.wrap}>
      <View style={st.card}>
        <Text style={st.brand}>orrbbit <Text style={{ color: colors.cobalt }}>business</Text></Text>
        <Text style={st.sub}>Manage your Business Profile and Hosted Events. Same account as the Orrbbit app.</Text>
        <TextInput testID="bizlogin-email" value={email} onChangeText={setEmail} placeholder="Business email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.textTertiary} style={st.input} />
        <TextInput testID="bizlogin-password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry placeholderTextColor={colors.textTertiary} style={st.input} />
        {error && <Text style={st.error}>{error}</Text>}
        <Pressable testID="bizlogin-submit" onPress={submit} disabled={busy} style={[st.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.ctaTxt}>Log in</Text>}
        </Pressable>
        <Text style={st.hint}>New to Orrbbit Business? Create a Business account in the Orrbbit app.</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F6F8FB", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.xxl },
  brand: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: 12, fontSize: font.base, color: colors.text, marginBottom: spacing.md },
  error: { color: "#DC2626", fontSize: font.sm, marginBottom: spacing.md },
  cta: { backgroundColor: colors.cobalt, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  ctaTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
  hint: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.lg, textAlign: "center", lineHeight: 18 },
});

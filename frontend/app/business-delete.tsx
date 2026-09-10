import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";

const PHRASE = "DELETE MY BUSINESS";

/** Two-step, typed-confirmation Business account deletion (same safety level as Personal). */
export default function BusinessDelete() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === PHRASE && password.length > 0;

  const confirmFinal = () => {
    setError(null);
    showAlert(
      "Are you absolutely sure?",
      "This is your final confirmation. Once you delete your Business account, it cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Business Account", style: "destructive", onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api("/users/me", { method: "DELETE", body: JSON.stringify({ password, confirmation: "DELETE" }) });
      await signOut();
    } catch (e: any) {
      setError(e?.message || "Could not delete your account. Check your password and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={st.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled">
      <Pressable testID="bizdel-back" onPress={() => router.back()} hitSlop={10} style={st.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={st.title}>Delete Business Account</Text>

      <View style={st.warnCard}>
        <View style={st.warnIcon}><Ionicons name="alert" size={26} color="#FFF" /></View>
        <Text style={st.warnTitle}>Delete your Business account?</Text>
        <Text style={st.warnTxt}>
          This action cannot be undone. Your Business Profile, active access and associated account data will be
          permanently removed according to Orrbbit&apos;s deletion and retention policies.
        </Text>
      </View>

      <View style={st.listCard}>
        <Text style={st.listTitle}>This will also:</Text>
        {[
          "Cancel all active and upcoming Business Events",
          "Notify confirmed attendees (in-app and by email)",
          "Remove your business from discovery and Radar",
          "End access to Business features",
          "Business subscription cancellation is handled separately where applicable",
          "Retain certain records where legally or safely required",
        ].map((t) => (
          <View key={t} style={st.listRow}>
            <Ionicons name="close-circle" size={15} color="#DC2626" />
            <Text style={st.listTxt}>{t}</Text>
          </View>
        ))}
      </View>

      <Text style={st.label}>To confirm, type <Text style={{ fontWeight: "800" }}>{PHRASE}</Text></Text>
      <TextInput
        testID="bizdel-phrase"
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={`Type ${PHRASE}`}
        placeholderTextColor={colors.textTertiary}
        style={[st.input, typed.trim().toUpperCase() === PHRASE && { borderColor: colors.success }]}
      />
      <Text style={st.label}>Current password</Text>
      <TextInput
        testID="bizdel-password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••••"
        placeholderTextColor={colors.textTertiary}
        style={st.input}
      />
      {error && <Text style={st.error}>{error}</Text>}

      <Pressable
        testID="bizdel-continue"
        onPress={confirmFinal}
        disabled={!ready || busy}
        style={[st.deleteBtn, (!ready || busy) && st.deleteBtnDisabled]}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.deleteTxt}>Delete Business Account</Text>}
      </Pressable>
      <Pressable testID="bizdel-cancel" onPress={() => router.back()} style={st.cancelBtn}>
        <Text style={st.cancelTxt}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  back: { minWidth: 44, minHeight: 44, justifyContent: "center", marginLeft: -6 },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", letterSpacing: -0.3 },
  warnCard: { alignItems: "center", backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 18, padding: spacing.xl, marginTop: spacing.lg },
  warnIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  warnTitle: { color: "#B91C1C", fontSize: font.lg, fontWeight: "800", textAlign: "center" },
  warnTxt: { color: colors.text, fontSize: font.sm, lineHeight: 20, textAlign: "center", marginTop: spacing.sm },
  listCard: { backgroundColor: "#FFF7F7", borderWidth: 1, borderColor: "#FECACA", borderRadius: 16, padding: spacing.lg, marginTop: spacing.md },
  listTitle: { color: "#B91C1C", fontSize: font.sm, fontWeight: "800", marginBottom: spacing.sm },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 },
  listTxt: { flex: 1, color: colors.text, fontSize: font.sm, lineHeight: 19 },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: 13, fontSize: font.base, color: colors.text, minHeight: 50 },
  error: { color: "#DC2626", fontSize: font.sm, marginTop: spacing.md },
  deleteBtn: { backgroundColor: "#DC2626", borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  deleteBtnDisabled: { backgroundColor: "#FCA5A5" },
  deleteTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
  cancelBtn: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  cancelTxt: { color: colors.text, fontSize: font.base, fontWeight: "700" },
});

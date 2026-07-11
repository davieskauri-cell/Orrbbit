import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function JoinEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res: any = await api("/events/join-code", { method: "POST", body: { code: code.trim() } });
      setUser(res.user);
      showAlert(`Welcome to ${res.event_name}`, "People at this event are now prioritised on your radar.");
      router.back();
    } catch {
      setError("Event code not found.");
    }
    setBusy(false);
  };

  const leave = async () => {
    const res: any = await api("/events/leave", { method: "POST" });
    setUser(res.user);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="join-event-screen"
    >
      <View style={styles.header}>
        <Pressable testID="join-event-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Join an Intro event</Text>
      </View>
      <Text style={styles.sub}>
        Enter an event code or scan a QR code to join a live Intro trial.
      </Text>

      {user?.event_name ? (
        <View style={styles.activeCard} testID="active-event-card">
          <Ionicons name="calendar" size={18} color={colors.teal} />
          <Text style={styles.activeText}>{"You're in: "}{user.event_name}</Text>
          <Pressable testID="leave-event" onPress={leave}>
            <Text style={styles.leaveText}>Leave</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Event code</Text>
      <TextInput
        testID="event-code-input"
        style={styles.input}
        value={code}
        onChangeText={(t) => { setCode(t); setError(""); }}
        placeholder="e.g. INTRO100"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
      />
      {!!error && <Text style={styles.error} testID="event-code-error">{error}</Text>}

      <PrimaryButton testID="join-event-submit" title="Join Event" onPress={join} loading={busy} style={{ marginTop: spacing.lg }} />
      <SecondaryButton
        testID="scan-qr"
        title="Scan QR code"
        onPress={() => showAlert("QR scanning coming soon", "For now, enter the event code printed under the QR poster.")}
        style={{ marginTop: spacing.sm }}
      />

      {user?.is_demo && (
        <View style={styles.demoHint}>
          <Text style={styles.demoTitle}>Demo event codes</Text>
          {["INTRO100", "FOUNDERNIGHT", "CAMPUSCHAT", "MELBOURNEBETA", "NETWORK100", "COFFEECHAT"].map((c) => (
            <Pressable key={c} testID={`demo-code-${c}`} onPress={() => setCode(c)}>
              <Text style={styles.demoCode}>{c}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 21 },
  activeCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  activeText: { color: colors.text, fontSize: font.base, fontWeight: "700", flex: 1 },
  leaveText: { color: colors.pink, fontSize: font.sm, fontWeight: "700" },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.lg,
    color: colors.text, minHeight: 50, letterSpacing: 2, fontWeight: "700",
  },
  error: { color: colors.pink, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm },
  demoHint: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl },
  demoTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm },
  demoCode: { color: colors.teal, fontSize: font.base, fontWeight: "700", paddingVertical: 6 },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { getTrialStats, joinTrialMode, leaveTrialMode } from "@/src/services/trialService";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function TrialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const active = !!user?.trial_mode_active;

  useEffect(() => {
    getTrialStats().then((r) => setEvent(r.event)).catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = active ? await leaveTrialMode() : await joinTrialMode();
      setUser(updated as any);
    } catch {}
    setBusy(false);
  };

  const STATS = event
    ? [
        { label: "Active users", value: event.active_users },
        { label: "Pings created", value: event.pings_created },
        { label: "Mutual accepts", value: event.mutual_accepts },
        { label: "Conversations confirmed", value: event.conversations_confirmed },
      ]
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="trial-screen"
    >
      <View style={styles.header}>
        <Pressable testID="trial-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Trial Mode</Text>
      </View>

      <Text style={styles.bigTitle}>100 Metre Social Experiment</Text>
      <Text style={styles.sub}>
        Join a live INTRO trial and see who nearby is open to connecting.
      </Text>

      {event && (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{active ? "LIVE — YOU'RE IN" : "LIVE NOW"}</Text>
          </View>
          <Text style={styles.eventName}>{event.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location" size={14} color={colors.orange} />
            <Text style={styles.metaText}>{event.venue}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time" size={14} color={colors.orange} />
            <Text style={styles.metaText}>
              {event.start_time} – {event.end_time}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            {STATS.map((s) => (
              <View key={s.label} style={styles.statBox}>
                <Text style={styles.statNum}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <PrimaryButton
        testID="trial-join"
        title={active ? "Leave Trial Mode" : "Join Trial Mode"}
        color={active ? colors.grey : colors.orange}
        onPress={toggle}
        loading={busy}
        style={{ marginTop: spacing.xl }}
      />
      <SecondaryButton
        testID="trial-invite"
        title="Invite people nearby"
        onPress={() => router.push("/invite")}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  bigTitle: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm, lineHeight: 23 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  eventName: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  metaText: { color: colors.textSecondary, fontSize: font.base },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  statBox: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  statNum: { color: colors.orange, fontSize: font.xxl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, textAlign: "center" },
});

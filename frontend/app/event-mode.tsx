import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function EventModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [event, setEvent] = useState<any>(null);
  const active = !!user?.event_active;

  useEffect(() => {
    api("/events/demo").then((r: any) => setEvent(r.event)).catch(() => {});
  }, []);

  const toggle = async () => {
    const updated = await api("/users/me/state", { method: "PUT", body: { event_active: !active } });
    setUser(updated as any);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="event-mode-screen"
    >
      <View style={styles.header}>
        <Pressable testID="event-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>IntroU Event Mode</Text>
      </View>
      <Text style={styles.sub}>
        Use IntroU at live events to see who nearby is open to networking, coffee, advice or
        a chat.
      </Text>

      <View style={styles.typeWrap}>
        {(event?.types || []).map((t: string) => (
          <View key={t} style={styles.typeChip}>
            <Text style={styles.typeText}>{t}</Text>
          </View>
        ))}
      </View>

      {event && (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{active ? "JOINED — LIVE" : "LIVE NOW"}</Text>
          </View>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.meta}>
            {event.location} · {event.start_time} – {event.end_time}
          </Text>
          <View style={styles.statsGrid}>
            {[
              [event.active_users, "Active users"],
              [event.pings, "Pings"],
              [event.profile_views, "Profile views"],
              [event.mutual_accepts, "Mutual accepts"],
              [event.conversations_confirmed, "Conversations"],
            ].map(([v, l]) => (
              <View key={l as string} style={styles.statBox}>
                <Text style={styles.statNum}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <PrimaryButton
        testID="event-join"
        title={active ? "Leave Event" : "Join Event"}
        color={active ? colors.grey : colors.orange}
        onPress={toggle}
        style={{ marginTop: spacing.xl }}
      />
      <SecondaryButton
        testID="event-create"
        title="Create Event"
        onPress={() => showAlert("Coming soon", "Event creation opens with your first venue partnership.")}
        style={{ marginTop: spacing.sm }}
      />
      <SecondaryButton
        testID="event-invite"
        title="Invite People"
        onPress={() => router.push("/invite")}
        style={{ marginTop: spacing.sm, borderWidth: 0 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21 },
  typeWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  typeChip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  typeText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  eventName: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.base, marginTop: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  statBox: { width: "31%", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
});

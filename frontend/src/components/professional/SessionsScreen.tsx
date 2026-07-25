import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import EmptyState from "@/src/components/EmptyState";
import SessionCard from "@/src/components/professional/SessionCard";
import { colors, spacing, font } from "@/src/theme";

/** Professional Mode "Sessions" tab — accepted consultations/conversations. */
export default function SessionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<any>("/professional/sessions");
      setSessions(res.sessions || []);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = sessions.filter((s) => s.status === "active" || s.status === "follow_up");
  const past = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="pro-sessions-screen">
      <Text style={styles.h1}>Sessions</Text>
      <Text style={styles.sub}>Conversations unlock here after a professional accepts a request.</Text>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.teal}
          />
        }
      >
        {sessions.length === 0 && (
          <EmptyState
            testID="sessions-empty"
            icon="briefcase-outline"
            title="No sessions yet"
            text="When a connection request is accepted, your conversation appears here."
          />
        )}
        {open.length > 0 && (
          <>
            <Text style={styles.section}>Active</Text>
            {open.map((s) => (
              <SessionCard key={s.id} s={s} onPress={() => router.push(`/professional/session/${s.id}`)} />
            ))}
          </>
        )}
        {past.length > 0 && (
          <>
            <Text style={styles.section}>Past</Text>
            {past.map((s) => (
              <SessionCard key={s.id} s={s} onPress={() => router.push(`/professional/session/${s.id}`)} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  h1: { color: colors.text, fontSize: font.xxl, fontWeight: "800", paddingHorizontal: spacing.xl },
  sub: { color: colors.textSecondary, fontSize: font.sm, paddingHorizontal: spacing.xl, marginTop: 2, marginBottom: spacing.sm },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  section: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
});

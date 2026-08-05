import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import { colors, spacing, radius, font } from "@/src/theme";

type Blocked = { user_id: string; name: string; photo_url?: string | null; blocked_at?: string };

export default function BlockedUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    api<{ blocked: Blocked[] }>("/blocks")
      .then((r) => setBlocked(r.blocked))
      .catch(() => {})
      .finally(() => setLoaded(true));
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const unblock = (u: Blocked) => {
    showAlert(
      `Unblock ${u.name}?`,
      "They will be able to see and contact you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/blocks/${u.user_id}`, { method: "DELETE" });
              setBlocked((prev) => prev.filter((b) => b.user_id !== u.user_id));
            } catch (e: any) {
              showAlert("Couldn't unblock", e.message || "Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      testID="blocked-users-screen"
    >
      <View style={styles.headerRow}>
        <Pressable testID="blocked-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Blocked Users</Text>
      </View>
      <Text style={styles.sub}>Blocked people can&apos;t see you, ping you or message you.</Text>

      {loaded && blocked.length === 0 && (
        <View style={styles.empty} testID="blocked-empty">
          <Ionicons name="ban-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyText}>You can block someone from their profile or from a chat.</Text>
        </View>
      )}

      {blocked.map((u) => (
        <View key={u.user_id} style={styles.rowCard} testID={`blocked-row-${u.user_id}`}>
          <Avatar uri={u.photo_url} name={u.name} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{u.name}</Text>
            {!!u.blocked_at && (
              <Text style={styles.date}>Blocked {new Date(u.blocked_at).toLocaleDateString()}</Text>
            )}
          </View>
          <Pressable testID={`unblock-${u.user_id}`} style={styles.unblockBtn} onPress={() => unblock(u)}>
            <Text style={styles.unblockText}>Unblock</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  backBtn: { minHeight: 44, minWidth: 34, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, paddingHorizontal: spacing.xl, marginTop: spacing.xs, marginBottom: spacing.lg },
  empty: { alignItems: "center", paddingTop: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center" },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  date: { color: colors.textTertiary, fontSize: font.sm, marginTop: 1 },
  unblockBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.teal,
    minHeight: 40,
    justifyContent: "center",
  },
  unblockText: { color: colors.teal, fontWeight: "700", fontSize: font.sm },
});

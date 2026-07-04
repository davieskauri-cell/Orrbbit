import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, Ping } from "@/src/context/AppContext";
import { listPings, dismissPing } from "@/src/services/pingService";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import EmptyState from "@/src/components/EmptyState";
import { colors, spacing, radius, font } from "@/src/theme";

const PHRASE: Record<string, string> = {
  networking: "wants to connect",
  need_advice: "needs advice",
  open_to_chat: "is open to chat",
  coffee_drinks: "is up for coffee",
  relationship: "wants something real",
  gym_buddy: "wants to train",
  exploring: "is exploring nearby",
};

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

export default function PingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vibeMap } = useApp();
  const [pings, setPings] = useState<Ping[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPings(await listPings());
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 10000);
      return () => clearInterval(t);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const dismiss = async (id: string) => {
    setPings((prev) => prev.map((p) => (p.id === id ? { ...p, status: "dismissed" } : p)));
    dismissPing(id).catch(() => {});
  };

  const sections: { title: string; items: Ping[] }[] = [
    { title: "New", items: pings.filter((p) => p.status === "new") },
    { title: "Recent", items: pings.filter((p) => p.status === "recent") },
    { title: "Dismissed", items: pings.filter((p) => p.status === "dismissed") },
  ];

  const empty = pings.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Pings</Text>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        }
      >
        {empty ? (
          <EmptyState
            testID="pings-empty"
            icon="notifications"
            title="No pings yet"
            text="When someone compatible is nearby, you'll get a gentle ping here."
          />
        ) : (
          sections.map(
            (s) =>
              s.items.length > 0 && (
                <View key={s.title}>
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                  {s.items.map((p) => {
                    const vibe = vibeMap[p.vibe];
                    return (
                      <View key={p.id} style={styles.row} testID={`ping-row-${p.id}`}>
                        <Avatar uri={p.user.photo_url} name={p.user.name} size={52} ringColor={vibe?.color} />
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={styles.headline}>
                            <Text style={{ fontWeight: "800" }}>{p.user.name}</Text>{" "}
                            {PHRASE[p.vibe] || "wants to connect"}
                          </Text>
                          <View style={styles.metaRow}>
                            <VibePill vibe={vibe} small />
                            <Text style={styles.meta}>{p.distance}m</Text>
                            <Text style={styles.meta}>·</Text>
                            <Text style={styles.meta}>{timeAgo(p.created_at)}</Text>
                          </View>
                        </View>
                        <View style={styles.actions}>
                          <Pressable
                            testID={`ping-view-${p.id}`}
                            style={styles.viewBtn}
                            onPress={() => router.push(`/person/${p.user.id}`)}
                          >
                            <Text style={styles.viewText}>View</Text>
                          </Pressable>
                          {p.status !== "dismissed" && (
                            <Pressable testID={`ping-dismiss-${p.id}`} onPress={() => dismiss(p.id)}>
                              <Text style={styles.dismissText}>Dismiss</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headline: { color: colors.text, fontSize: font.base },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: colors.textSecondary, fontSize: font.sm },
  actions: { alignItems: "flex-end", gap: 6 },
  viewBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  viewText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
  dismissText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600", padding: 4 },
});

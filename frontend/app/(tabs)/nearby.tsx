import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import UserRow from "@/src/components/UserRow";
import EmptyState from "@/src/components/EmptyState";
import { colors, spacing, font } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open_to_chat", label: "Open to Chat" },
  { key: "relationship", label: "Relationship" },
  { key: "coffee_drinks", label: "Coffee" },
  { key: "networking", label: "Networking" },
  { key: "need_advice", label: "Need Advice" },
  { key: "gym_buddy", label: "Gym Buddy" },
];

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { nearby, vibeMap, refresh } = useApp();
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const data = filter === "all" ? nearby : nearby.filter((n) => n.vibe === filter);
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Nearby</Text>
      <Text style={styles.sub}>Within {user?.radius || 50}m of you</Text>

      <View style={{ height: 52 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        }
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => (
          <UserRow user={item} vibeMap={vibeMap} onPress={(u) => router.push(`/person/${u.id}`)} />
        )}
        ListEmptyComponent={
          hidden ? (
            <EmptyState
              testID="nearby-invisible"
              icon="eye-off"
              title="You are invisible."
              text="Turn visibility on to see who's nearby."
            />
          ) : (
            <EmptyState
              testID="nearby-empty"
              icon="compass"
              title="No one nearby right now."
              text="Try increasing your radius up to 100m or changing your vibe."
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", paddingHorizontal: spacing.xl },
  sub: { color: colors.textSecondary, fontSize: font.base, paddingHorizontal: spacing.xl, marginTop: 2, marginBottom: spacing.md },
  filters: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  filterTextActive: { color: "#FFF" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border },
});

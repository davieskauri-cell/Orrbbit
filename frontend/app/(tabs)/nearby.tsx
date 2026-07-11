import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
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
  const [detailFilters, setDetailFilters] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const DETAIL_FILTERS: { key: string; label: string; test: (n: any) => boolean }[] = [
    { key: "active", label: "Active now", test: (n) => !!n.active_now },
    { key: "verified", label: "Verified", test: (n) => !!n.verified },
    { key: "same_vibe", label: "Same vibe", test: (n) => !!user?.vibe && n.vibe === user.vibe },
    { key: "hiring", label: "Hiring now", test: (n) => !!n.vibe_details?.recruiter_mode || !!n.vibe_details?.hiring_roles?.length },
    { key: "recruiters", label: "Recruiters", test: (n) => !!n.vibe_details?.recruiter_mode || n.vibe_details?.professional_identity === "Recruiter" },
    { key: "job_seekers", label: "Job seekers", test: (n) => !!n.vibe_details?.job_seeker_mode || n.vibe_details?.professional_identity === "Job seeker" },
    { key: "founders", label: "Founders", test: (n) => ["Founder", "Business owner"].includes(n.vibe_details?.professional_identity) },
    { key: "mentors", label: "Mentors", test: (n) => !!(n.vibe_details?.can_help_with?.length || n.vibe_details?.offer_categories?.length) },
    { key: "long_term", label: "Long-term", test: (n) => !!n.vibe_details?.relationship_intention?.includes("Long-term") },
    { key: "coffee_now", label: "Coffee now", test: (n) => n.vibe === "coffee_drinks" && n.vibe_details?.time === "Now" },
    { key: "career_advice", label: "Career advice", test: (n) => (n.vibe_details?.advice_category || "").includes("Career") || (n.vibe_details?.can_help_with || []).some((h: string) => h.toLowerCase().includes("career")) },
    { key: "weights", label: "Weights", test: (n) => (n.vibe_details?.training_type || []).includes("Weights") },
  ];

  const toggleDetail = (key: string) =>
    setDetailFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const data = (filter === "all" ? nearby : nearby.filter((n) => n.vibe === filter)).filter((n) =>
    detailFilters.every((k) => DETAIL_FILTERS.find((f) => f.key === k)?.test(n))
  );
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Nearby</Text>
      <Text style={styles.sub}>
        {nearby.length >= 100
          ? "100+ people nearby · Showing the best 100 based on your vibe, filters and safety settings."
          : `Within ${user?.radius || 50}m of you`}
      </Text>

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

      <View style={{ height: 44 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {DETAIL_FILTERS.map((f) => {
            const active = detailFilters.includes(f.key);
            return (
              <Pressable
                key={f.key}
                testID={`dfilter-${f.key}`}
                onPress={() => toggleDetail(f.key)}
                style={[styles.detailChip, active && styles.detailChipActive]}
              >
                <Text style={[styles.detailText, active && styles.detailTextActive]}>{f.label}</Text>
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
        ListFooterComponent={
          data.length >= 100 ? (
            <View style={styles.capCard} testID="nearby-cap-note">
              <Text style={styles.capTitle}>Showing up to 100 people within your radius</Text>
              <Text style={styles.capText}>To keep the map clear and safe.</Text>
              <Pressable
                testID="nearby-why-limit"
                onPress={() =>
                  showAlert(
                    "Why limit?",
                    "INTRO limits visible people so the map stays clear, safe and relevant. Use filters to refine who you see."
                  )
                }
                hitSlop={6}
              >
                <Text style={styles.capLink}>Why limit?</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          hidden ? (
            <EmptyState
              testID="nearby-invisible"
              icon="eye-off"
              title="You are invisible."
              text="Turn visibility on when you are open to connecting."
            />
          ) : (
            <View>
              <EmptyState
                testID="nearby-empty"
                icon="compass"
                title="No one nearby right now"
                text="INTRO works best when people are close by. Try increasing your radius, changing your vibe, joining an event, or inviting people nearby."
              />
              <View style={styles.emptyActions}>
                {[
                  { label: "Increase radius", route: "/privacy", testID: "empty-radius" },
                  { label: "Change vibe", route: "/vibe", testID: "empty-vibe" },
                  { label: "Join event", route: "/join-event", testID: "empty-event" },
                  { label: "Invite people", route: "/invite", testID: "empty-invite" },
                  { label: "Demo mode", route: "/demo-accounts", testID: "empty-demo" },
                ].map((a) => (
                  <Pressable key={a.label} testID={a.testID} style={styles.emptyBtn} onPress={() => router.push(a.route as any)}>
                    <Text style={styles.emptyBtnText}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
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
  capNote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", paddingVertical: spacing.lg },
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
  detailChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  detailText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  detailTextActive: { color: colors.teal, fontWeight: "800" },
  emptyActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", paddingHorizontal: spacing.xl },
  emptyBtn: { backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 40, justifyContent: "center" },
  emptyBtnText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border },
});

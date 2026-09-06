import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, ScrollView, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/src/lib/alert";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import UserRow from "@/src/components/UserRow";
import EmptyState from "@/src/components/EmptyState";
import { colors, spacing, font } from "@/src/theme";
import { nearbyEvents, EVENT_CATEGORY_ICONS, type OrbEvent } from "@/src/services/eventService";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open_to_chat", label: "Open to Chat" },
  { key: "relationship", label: "Relationship" },
  { key: "coffee_drinks", label: "Coffee" },
  { key: "networking", label: "Networking" },
  { key: "need_advice", label: "Need Advice" },
  { key: "gym_buddy", label: "Activity Buddy" },
  { key: "new_friends", label: "New Friends" },
  { key: "going_out", label: "Going Out" },
  { key: "events", label: "Events" },
  { key: "new_to_area", label: "New to Area" },
  { key: "travelling", label: "Travelling" },
  { key: "exploring", label: "Exploring" },
];

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { nearby, vibeMap, refresh, coords, requestLocation, appMode } = useApp();
  const [filter, setFilter] = useState("all");
  const [detailFilters, setDetailFilters] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { vibe: vibeParam } = useLocalSearchParams<{ vibe?: string }>();

  // direct entry to this tab (deep link / cluster tap) — make sure discovery is loaded
  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // cluster taps on the radar open this list pre-filtered to the cluster's vibe
  useEffect(() => {
    if (vibeParam && FILTERS.some((f) => f.key === vibeParam)) setFilter(String(vibeParam));
  }, [vibeParam]);

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

  if (appMode === "professional") {
    return <ProfessionalNearby role={user?.professional_role} coords={coords} insetsTop={insets.top} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Nearby</Text>
      <Text style={styles.sub}>
        {nearby.length >= 100
          ? "100+ people nearby · Showing the best 100 based on your vibe, filters and safety settings."
          : `Within ${(user?.radius || 250) >= 1000 ? "1 km" : `${user?.radius || 250}m`} of you`}
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

      {filter === "events" ? (
        <NearbyEventsList coords={coords} />
      ) : (
      <>
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
                    "Orrbbit limits visible people so the map stays clear, safe and relevant. Use filters to refine who you see."
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
                text="Orrbbit works best when people are close by. Try increasing your radius, changing your vibe, joining an event, or inviting people nearby."
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
      </>
      )}
    </View>
  );
}

/** Nearby → Events: same backend event data as the Radar hotspots (GET /events/nearby). */
function NearbyEventsList({ coords }: { coords: any }) {
  const router = useRouter();
  const [events, setEvents] = useState<OrbEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = React.useCallback(async () => {
    const lat = coords?.lat ?? -37.8136;
    const lng = coords?.lng ?? 144.9631;
    try { const r = await nearbyEvents(lat, lng); setEvents(r.events); }
    catch { setEvents([]); }
  }, [coords]);
  useEffect(() => { load(); }, [load]);
  // refetch on focus so cancelled events disappear without a manual refresh
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const when = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  };

  return (
    <FlatList
      data={events || []}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.teal} />}
      ListEmptyComponent={
        events === null ? null : (
          <EmptyState
            testID="nearby-events-empty"
            icon="flame-outline"
            title="No events nearby right now"
            text="Events appear here when someone hosts within your area. Host one yourself from the Radar → Events."
          />
        )
      }
      renderItem={({ item: ev }) => (
        <Pressable testID={`nearby-event-${ev.id}`} style={styles.evCard} onPress={() => router.push(`/event/${ev.id}`)}>
          {ev.cover_image ? (
            <Image source={{ uri: ev.cover_image }} style={styles.evCover} resizeMode="cover" />
          ) : (
            <View style={styles.evCoverPlaceholder}>
              <Ionicons name={(EVENT_CATEGORY_ICONS[ev.category] || "flame") as any} size={34} color={colors.orange} />
            </View>
          )}
          <View style={styles.evBody}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.evTitle} numberOfLines={1}>{ev.title}</Text>
              {ev.status === "full" && <Text style={styles.evFull}>FULL</Text>}
            </View>
            <Text style={styles.evMeta}>{ev.category} · Approx. {ev.distance >= 1000 ? `${(ev.distance / 1000).toFixed(1)}km` : `${ev.distance}m`} away</Text>
            <Text style={styles.evMeta}>{when(ev.start_datetime)}</Text>
            <Text style={styles.evGoing}>
              {ev.going} going{ev.spots_left != null ? ` · ${ev.spots_left} spot${ev.spots_left === 1 ? "" : "s"} left` : ""}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ alignSelf: "center" }} />
        </Pressable>
      )}
    />
  );
}

function ProfessionalNearby({ role, coords, insetsTop }: { role?: string | null; coords: any; insetsTop: number }) {
  const router = useRouter();
  const [pros, setPros] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [verRequired, setVerRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const canHelp = role === "can_help";

  const load = React.useCallback(async () => {
    if (!coords) return;
    try {
      if (canHelp) {
        const res = await api<any>(`/professional/requests?lat=${coords.lat}&lng=${coords.lng}`);
        setRequests(res.requests);
        setVerRequired(!!res.verification_required);
      } else {
        const res = await api<any>(`/professionals?lat=${coords.lat}&lng=${coords.lng}`);
        setPros(res.professionals);
      }
    } catch {}
  }, [coords, canHelp]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insetsTop + spacing.sm }]}>
      <Text style={styles.title}>Nearby</Text>
      <Text style={styles.sub}>{canHelp ? "Help requests matching your verified categories" : "Verified professionals near you"}</Text>
      <FlatList
        data={canHelp ? requests : pros}
        keyExtractor={(item: any) => item.id || item.user_id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.teal} />}
        ListEmptyComponent={
          canHelp ? (
            verRequired ? (
              <EmptyState icon="shield-half" title="Verification required" text="Complete professional verification to view and respond to help requests." />
            ) : (
              <EmptyState icon="briefcase-outline" title="No matching help requests nearby" text="New requests will appear here when they match your verified categories." />
            )
          ) : (
            <EmptyState icon="people-outline" title="No verified professionals found nearby" text="Try increasing your distance or selecting another category." />
          )
        }
        renderItem={({ item }: any) =>
          canHelp ? (
            <Pressable testID={`nearby-req-${item.id}`} style={styles.proCard} onPress={() => router.push(`/professional/request/${item.id}`)}>
              <Text style={styles.proBadge}>{item.category}</Text>
              <Text style={styles.proTitle}>{item.public_summary}</Text>
              <Text style={styles.proMeta}>{item.payment} · ~{item.distance}m away</Text>
            </Pressable>
          ) : (
            <Pressable testID={`nearby-pro-${item.user_id}`} style={styles.proCard} onPress={() => router.push(`/professional/profile/${item.user_id}`)}>
              <Text style={styles.proTitle}>{item.name} · {item.profession}</Text>
              {item.verified_by_intro && <Text style={styles.proBadge}>✓ Professionally Verified</Text>}
              <Text style={styles.proMeta}>{item.primary_category} · ~{item.distance}m{item.response_time ? ` · ${item.response_time}` : ""}</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  evCard: { flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.md, marginBottom: spacing.md },
  evCover: { width: 96, height: 72, borderRadius: 12, backgroundColor: colors.border },
  evCoverPlaceholder: { width: 96, height: 72, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center" },
  evBody: { flex: 1, gap: 2, justifyContent: "center" },
  evTitle: { color: colors.text, fontSize: font.base, fontWeight: "800", flexShrink: 1 },
  evFull: { color: colors.orange, fontSize: font.micro, fontWeight: "800" },
  evMeta: { color: colors.textSecondary, fontSize: font.sm },
  evGoing: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  proCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: spacing.lg, marginBottom: spacing.md, gap: 4 },
  proBadge: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  proTitle: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  proMeta: { color: colors.textSecondary, fontSize: font.sm },
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", paddingHorizontal: spacing.xl },
  sub: { color: colors.textSecondary, fontSize: font.base, paddingHorizontal: spacing.xl, marginTop: 2, marginBottom: spacing.md },
  filters: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  capNote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", paddingVertical: spacing.lg },
  capCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, gap: 4, alignItems: "center" },
  capTitle: { color: colors.text, fontSize: font.base, fontWeight: "700", textAlign: "center" },
  capText: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center" },
  capLink: { color: colors.teal, fontSize: font.sm, fontWeight: "700", marginTop: 4 },
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
    paddingVertical: 8,
    minHeight: 32,
    justifyContent: "center",
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

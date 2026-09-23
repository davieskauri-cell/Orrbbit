import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, RefreshControl, StyleSheet } from "react-native";
import { useRouter, Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/lib/api";
import { nearbyEvents, OrbEvent } from "@/src/services/eventService";
import Avatar from "@/src/components/Avatar";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { colors, spacing, font, shadow } from "@/src/theme";

const PURPLE = "#7C5CFC";
const PURPLE_SOFT = "#F0EBFF";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning! ☀️";
  if (h < 17) return "Good afternoon! 👋";
  return "Good evening! 🌙";
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = d.toDateString() === now.toDateString()
    ? "Today"
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

const distLabel = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

/** Orrbbit Today — People Mode dashboard. All numbers come from the live APIs. */
export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { nearby, coords, vibeMap, appMode, setAppMode, requestLocation, refresh: refreshNearby } = useApp();
  const [events, setEvents] = useState<OrbEvent[]>([]);
  const [proCount, setProCount] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Today is the first screen after login — kick off the existing location flow
  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    // unread badge doesn't need coords
    try {
      const n: any = await api("/notifications");
      setUnread(n.unread || 0);
    } catch {}
    if (!coords) return;
    try {
      const r: any = await nearbyEvents(coords.lat, coords.lng);
      setEvents(r.events || []);
    } catch {}
    try {
      const p: any = await api(`/professionals?lat=${coords.lat}&lng=${coords.lng}`);
      setProCount((p.professionals || []).length);
    } catch {}
  }, [coords]);
  useEffect(() => { load(); }, [load]);

  // refresh live counts every 30s while Today is open, and whenever it regains focus
  // (nearby people already poll every 8s via AppContext)
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshNearby()]);
    setRefreshing(false);
  };

  // Today is People Mode only — Professional mode keeps its existing home
  if (appMode === "professional") return <Redirect href="/(tabs)" />;

  const now = Date.now();
  const liveEvents = events.filter(
    (e) => e.status !== "cancelled" && new Date(e.start_datetime).getTime() <= now && new Date(e.end_datetime).getTime() >= now
  );
  const online = nearby.filter((n) => n.active_now);
  // "looking to chat" — nearby people whose current vibe is a social/chat vibe (real vibe data)
  const chatty = nearby.filter((n) => {
    const label = (vibeMap[n.vibe || ""]?.label || n.vibe || "").toLowerCase();
    return /chat|friend|social|meet|going out|hang/.test(label);
  });
  const radius = user?.radius || 750;
  // Personal + Business events together, soonest first
  const upcoming = [...events]
    .filter((e) => e.status !== "cancelled" && new Date(e.end_datetime).getTime() >= now)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    .slice(0, 3);

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
      testID="today-screen"
    >
      {/* header */}
      <View style={st.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <LogoMark size={30} />
          <Wordmark height={20} />
          {user?.is_demo && <Text style={st.demoBadge} testID="demo-badge">DEMO</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable testID="today-bell" onPress={() => router.push("/notifications")} style={st.iconBtn} hitSlop={6}>
            <Ionicons name="notifications-outline" size={21} color={colors.text} />
            {unread > 0 && (
              <View style={st.bellBadge} testID="today-bell-badge">
                <Text style={st.bellBadgeTxt}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </Pressable>
          <Pressable testID="today-settings" onPress={() => router.push("/(tabs)/profile")} style={st.iconBtn} hitSlop={6}>
            <Ionicons name="settings-outline" size={21} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* greeting */}
      <Text style={st.greeting} testID="today-greeting">{greeting()}</Text>
      <Text style={st.greetSub}>Let’s see what’s happening around you.</Text>

      {/* top 3-stat card */}
      <View style={[st.statCard, shadow.card]} testID="today-stats">
        <View style={st.statCell}>
          <Text style={[st.statNum, { color: colors.orange }]}>{events.length}</Text>
          <Text style={st.statLabel}>Events{"\n"}nearby</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.statCell}>
          <Text style={[st.statNum, { color: colors.teal }]}>{nearby.length}</Text>
          <Text style={st.statLabel}>People{"\n"}nearby</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.statCell}>
          <Text style={[st.statNum, { color: colors.text }]}>{distLabel(radius)}</Text>
          <Text style={st.statLabel}>Radius</Text>
        </View>
      </View>

      {/* around you right now */}
      <Text style={st.sectionTitle}>Around you right now</Text>
      <View style={st.avatarRow}>
        {nearby.slice(0, 5).map((n) => (
          <Pressable key={n.id} testID={`today-person-${n.id}`} onPress={() => router.push(`/person/${n.id}`)}>
            <Avatar uri={n.photo_url} name={n.name} size={52} ringColor={vibeMap[n.vibe || ""]?.color || colors.teal} />
          </Pressable>
        ))}
        <View style={st.onlinePill}>
          <Text style={st.onlineNum}>+{Math.max(online.length, 0)}</Text>
          <Text style={st.onlineTxt}>online</Text>
        </View>
      </View>

      {/* 3 cards */}
      <View style={st.cardRow}>
        <Pressable testID="today-live-events" style={[st.miniCard, { backgroundColor: colors.orangeSoft }]} onPress={() => router.push("/(tabs)")}>
          <View style={[st.miniIcon, { backgroundColor: "#FFFFFF" }]}>
            <Ionicons name="flame" size={18} color={colors.orange} />
          </View>
          <Text style={[st.miniNum, { color: colors.orange }]}>{liveEvents.length}</Text>
          <Text style={st.miniLabel}>Live events</Text>
        </Pressable>
        <Pressable testID="today-chat" style={[st.miniCard, { backgroundColor: PURPLE_SOFT }]} onPress={() => router.push("/(tabs)")}>
          <View style={[st.miniIcon, { backgroundColor: "#FFFFFF" }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color={PURPLE} />
          </View>
          <Text style={[st.miniNum, { color: PURPLE }]}>{chatty.length}</Text>
          <Text style={st.miniLabel}>People looking to chat</Text>
        </Pressable>
        <Pressable
          testID="today-pros"
          style={[st.miniCard, { backgroundColor: colors.tealSoft }]}
          onPress={() => { setAppMode("professional"); router.push("/(tabs)"); }}
        >
          <View style={[st.miniIcon, { backgroundColor: "#FFFFFF" }]}>
            <Ionicons name="briefcase" size={18} color={colors.teal} />
          </View>
          <Text style={[st.miniNum, { color: colors.teal }]}>{proCount ?? "—"}</Text>
          <Text style={st.miniLabel}>Professionals nearby</Text>
        </Pressable>
      </View>

      {/* active zone banner */}
      <Pressable testID="today-active-zone" style={st.zoneBanner} onPress={() => router.push("/(tabs)")}>
        <View style={st.zoneIcon}>
          <Ionicons name="walk" size={18} color={PURPLE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.zoneTitle}>
            {nearby.length + events.length >= 5 ? "You’re in an Orrbbit Active Zone" : "Activity building around you"}
          </Text>
          <Text style={st.zoneSub}>
            {nearby.length + events.length >= 5 ? "High activity nearby" : "Keep your radar on"} · {distLabel(radius)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={PURPLE} />
      </Pressable>

      {/* happening near you */}
      <View style={st.hnyRow}>
        <Text style={st.sectionTitle}>Happening near you</Text>
        <Pressable testID="today-see-all" onPress={() => router.push("/(tabs)")} style={{ flexDirection: "row", alignItems: "center", gap: 2 }} hitSlop={8}>
          <Text style={st.seeAll}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.teal} />
        </Pressable>
      </View>
      {upcoming.length > 0 ? (
        upcoming.map((ev) => {
          const isBiz = ev.host_type === "business";
          return (
            <Pressable key={ev.id} testID={`today-event-${ev.id}`} style={[st.eventCard, shadow.card]} onPress={() => router.push(`/event/${ev.id}`)}>
              {ev.cover_image ? (
                <Image source={{ uri: ev.cover_image }} style={st.eventImg} />
              ) : (
                <View style={[st.eventImg, { backgroundColor: isBiz ? colors.cobaltSoft : colors.orangeSoft, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name={isBiz ? "storefront" : "flame"} size={26} color={isBiz ? colors.cobalt : colors.orange} />
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <View
                  style={[st.hostTag, { backgroundColor: isBiz ? colors.cobaltSoft : colors.orangeSoft }]}
                  testID={`today-event-tag-${ev.id}`}
                >
                  <Text style={[st.hostTagTxt, { color: isBiz ? colors.cobalt : colors.orange }]}>
                    {isBiz ? "Business Event" : "Personal Event"}
                  </Text>
                </View>
                <Text style={st.eventTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={st.eventMeta}>{whenLabel(ev.start_datetime)} · {distLabel(ev.distance)}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="people" size={13} color={colors.textTertiary} />
                  <Text style={st.eventMeta}>{ev.going} going</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          );
        })
      ) : (
        <View style={[st.eventCard, shadow.card, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={st.eventMeta}>No upcoming events in your radius yet — check back soon.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  demoBadge: { backgroundColor: colors.tealSoft, color: colors.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  bellBadge: { position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.background },
  bellBadgeTxt: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  greeting: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: spacing.lg },
  greetSub: { color: colors.textSecondary, fontSize: font.base, marginTop: 4 },
  statCard: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 18, paddingVertical: spacing.lg, marginTop: spacing.lg, alignItems: "center" },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  statNum: { fontSize: 24, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", lineHeight: 16 },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.md },
  onlinePill: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  onlineNum: { color: colors.teal, fontSize: font.base, fontWeight: "800" },
  onlineTxt: { color: colors.teal, fontSize: 9, fontWeight: "700" },
  cardRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  miniCard: { flex: 1, borderRadius: 16, padding: spacing.md, gap: 6, minHeight: 118 },
  miniIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  miniNum: { fontSize: 22, fontWeight: "800" },
  miniLabel: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 16, fontWeight: "600" },
  zoneBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: PURPLE_SOFT, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg },
  zoneIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  zoneTitle: { color: PURPLE, fontSize: font.base, fontWeight: "800" },
  zoneSub: { color: PURPLE, fontSize: font.sm, opacity: 0.8, marginTop: 2 },
  hnyRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  seeAll: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  eventCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, marginTop: spacing.md, minHeight: 84 },
  hostTag: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  hostTagTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  eventImg: { width: 72, height: 60, borderRadius: 12 },
  eventTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  eventMeta: { color: colors.textSecondary, fontSize: font.sm },
});

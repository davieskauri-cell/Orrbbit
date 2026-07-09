import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { toggleVisibility, startVisibilitySession } from "@/src/services/privacyService";
import { distLabel } from "@/src/lib/format";
import RadarView from "@/src/components/RadarView";
import VibePill from "@/src/components/VibePill";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import Logo from "@/src/components/Logo";
import ModeSelector from "@/src/components/ModeSelector";
import ModeCards from "@/src/components/ModeCards";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { coords, permission, nearby, vibeMap, requestLocation, refresh, visibilityEnded } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [, forceTick] = useState(0);

  // refresh the session countdown label every 30s
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const flipVisibility = async () => {
    const turningOn = !user?.visible;
    const updated = turningOn
      ? await startVisibilitySession(user?.visible_for || 30)
      : await toggleVisibility(false);
    setUser(updated as any);
  };

  const sessionMinsLeft = (() => {
    if (!user?.visible || !user?.visibility_expires_at) return null;
    const ms = new Date(user.visibility_expires_at).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 60000) : 0;
  })();

  const myVibe = user?.vibe ? vibeMap[user.vibe] : undefined;
  const compatible = nearby.filter((n) => n.compatible);
  const best = compatible[0];
  const bestVibe = best?.vibe ? vibeMap[best.vibe] : undefined;
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Logo size={26} />
        <View style={styles.headerRight}>
          <Pressable testID="visibility-toggle" onPress={flipVisibility} style={styles.iconBtn}>
            <Ionicons
              name={hidden ? "eye-off" : "eye"}
              size={20}
              color={hidden ? colors.textTertiary : colors.teal}
            />
          </Pressable>
          <Pressable testID="settings-btn" onPress={() => router.push("/privacy")} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <Pressable testID="current-vibe-pill" onPress={() => router.push("/vibe")} style={styles.vibeRow}>
        <VibePill vibe={myVibe} />
        <Text style={styles.vibeChange}>Change</Text>
        {sessionMinsLeft !== null && !hidden && (
          <View style={styles.sessionChip} testID="visibility-session-chip">
            <Ionicons name="eye" size={11} color={colors.teal} />
            <Text style={styles.sessionText}>Visible · {sessionMinsLeft}m left</Text>
          </View>
        )}
      </Pressable>

      <ModeSelector />
      <ModeCards />

      {user?.event_name && (
        <View style={styles.eventBanner} testID="event-banner">
          <Ionicons name="calendar" size={14} color={colors.teal} />
          <Text style={styles.eventBannerText}>{user.event_name} · people here are prioritised</Text>
        </View>
      )}

      {user?.trial_mode_active && (
        <Pressable testID="trial-banner" style={styles.trialBanner} onPress={() => router.push("/trial")}>
          <View style={styles.trialDot} />
          <Text style={styles.trialText}>Southbank Social Trial is live</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.orange} />
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        }
      >
        {hidden ? (
          <EmptyState
            testID="invisible-empty"
            icon="eye-off"
            title={visibilityEnded ? "Visibility ended. You are now invisible." : "You are invisible."}
            text="Turn visibility on when you are open to connecting."
            actionTitle={visibilityEnded ? "Turn visibility back on" : "Turn Visibility On"}
            onAction={flipVisibility}
          />
        ) : (
          <>
            <RadarView
              users={nearby}
              vibeMap={vibeMap}
              onSelect={(u) => router.push(`/person/${u.id}`)}
              meUri={user?.photo_url}
              meName={user?.name}
              radiusSetting={user?.radius || 50}
              coords={coords}
            />
            <View style={styles.approxNote}>
              <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />
              <Text style={styles.approxText}>
                Approximate distance only. Exact location stays hidden. Your exact location is
                only visible to you.
              </Text>
            </View>

            <View style={[styles.stats, shadow.card]}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{nearby.length}</Text>
                <Text style={styles.statLabel}>People nearby</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.teal }]}>{compatible.length}</Text>
                <Text style={styles.statLabel}>Open to connect</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.orange }]}>{user?.radius || 50}m</Text>
                <Text style={styles.statLabel}>Radius</Text>
              </View>
            </View>

            {permission === "denied" && (
              <View style={styles.banner} testID="location-banner">
                <Ionicons name="location-outline" size={16} color={colors.warning} />
                <Text style={styles.bannerText}>
                  Demo mode: using Melbourne CBD. Enable location for real nearby people.
                </Text>
              </View>
            )}

            {user?.vibe === "busy" ? (
              <View style={styles.busyCard} testID="busy-state">
                <Ionicons name="notifications-off" size={18} color={colors.grey} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.busyTitle}>{"You're marked as Busy"}</Text>
                  <Text style={styles.busyText}>
                    {"You will not receive pings until you change your vibe."}
                  </Text>
                </View>
                <Pressable testID="busy-change-vibe" onPress={() => router.push("/vibe")}>
                  <Text style={styles.busyAction}>Change vibe</Text>
                </Pressable>
              </View>
            ) : best ? (
              <View style={[styles.bestCard, shadow.card]} testID="nearby-now-card">
                <Text style={styles.bestKicker}>NEARBY NOW</Text>
                <View style={styles.bestRow}>
                  <Avatar uri={best.photo_url} name={best.name} size={62} ringColor={bestVibe?.color} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.bestName}>
                      {best.name}, {best.age}
                    </Text>
                    <VibePill vibe={bestVibe} small />
                    <Text style={styles.bestDist}>{distLabel(best.distance)}</Text>
                  </View>
                </View>
                {!!best.bio && (
                  <Text style={styles.bestBio} numberOfLines={2}>
                    {best.bio}
                  </Text>
                )}
                <PrimaryButton
                  testID="best-view-profile"
                  title="View Profile"
                  onPress={() => router.push(`/person/${best.id}`)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : nearby.length === 0 ? (
              <View style={styles.emptyWrap} testID="radar-empty">
                <Text style={styles.emptyTitle}>No one nearby right now</Text>
                <Text style={styles.emptyText}>
                  INTRO works best when people are close by. Try increasing your radius up to
                  100m, changing your vibe, or inviting people nearby.
                </Text>
                <View style={styles.emptyBtns}>
                  <SecondaryButton
                    testID="empty-increase-radius"
                    title="Increase radius"
                    onPress={() => router.push("/privacy")}
                    style={{ flex: 1, minHeight: 46 }}
                  />
                  <SecondaryButton
                    testID="empty-invite"
                    title="Invite people"
                    onPress={() => router.push("/invite")}
                    style={{ flex: 1, minHeight: 46 }}
                  />
                </View>
                <SecondaryButton
                  testID="empty-change-vibe"
                  title="Change vibe"
                  onPress={() => router.push("/vibe")}
                  style={{ marginTop: spacing.sm, minHeight: 46 }}
                />
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <SecondaryButton
                testID="change-vibe-btn"
                title="Change Vibe"
                onPress={() => router.push("/vibe")}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                testID="privacy-btn"
                title="Privacy"
                onPress={() => router.push("/privacy")}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  vibeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  vibeChange: { color: colors.orange, fontSize: font.sm, fontWeight: "700" },
  sessionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: "auto",
  },
  sessionText: { color: colors.teal, fontSize: 11, fontWeight: "700" },
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.orangeSoft,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  trialDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  trialText: { color: colors.orange, fontSize: font.sm, fontWeight: "800", flex: 1 },
  approxNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: spacing.sm,
  },
  approxText: { color: colors.textTertiary, fontSize: font.sm },
  eventBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  eventBannerText: { color: colors.teal, fontSize: font.sm, fontWeight: "700", flex: 1 },
  emptyWrap: { alignItems: "center", paddingVertical: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: font.xl, fontWeight: "700" },
  emptyText: {
    color: colors.textSecondary,
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  emptyBtns: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  statBox: { alignItems: "center", flex: 1 },
  statNum: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: colors.border },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: "#FFF8EB",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  busyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  busyTitle: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  busyText: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18, marginTop: 2 },
  busyAction: { color: colors.orange, fontSize: font.sm, fontWeight: "800", padding: spacing.sm },
  bestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  bestKicker: { color: colors.orange, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.md },
  bestRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bestName: { color: colors.text, fontSize: font.xl, fontWeight: "700" },
  bestDist: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  bestBio: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.md, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
});

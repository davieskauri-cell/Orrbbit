import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Modal } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type NearbyUser } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
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

const ALL_RADII = [10, 25, 50, 100, 250, 500];

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { coords, permission, nearby, vibeMap, requestLocation, refresh, visibilityEnded } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [preview, setPreview] = useState<NearbyUser | null>(null);
  const [, forceTick] = useState(0);

  const maxR = user?.max_radius || 50;

  const pickRadius = async (r: number) => {
    if (r > maxR) {
      setShowRadius(false);
      const needsPlus = r <= 100;
      showAlert(
        needsPlus ? "Unlock 100m with Intro Plus" : "Unlock extended discovery with Intro Pro",
        needsPlus
          ? "Free gives you up to 50m. Plus unlocks 100m for bigger venues, events and city blocks."
          : "Intro Pro unlocks 250m and 500m discovery for campuses, festivals, conferences and larger social spaces.",
        [
          { text: "Maybe later", style: "cancel" },
          { text: needsPlus ? "Upgrade to Plus" : "Upgrade to Pro", onPress: () => router.push("/plans") },
        ]
      );
      return;
    }
    try {
      const updated = await api("/users/me/state", { method: "PUT", body: { radius: r } });
      setUser(updated as any);
    } catch {}
    setShowRadius(false);
    refresh();
  };

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
  const strongMatches = compatible.filter((n) => (n.score ?? 0) >= 6);
  const activeCount = nearby.filter((n) => n.active_now).length;
  const best = strongMatches[0];
  const bestVibe = best?.vibe ? vibeMap[best.vibe] : undefined;
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Logo size={26} />
        <View style={styles.headerRight}>
          <Pressable testID="settings-btn" onPress={() => router.push("/privacy")} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.topRow}>
        <Pressable testID="current-vibe-pill" onPress={() => router.push("/vibe")} style={styles.vibeSelector}>
          <VibePill vibe={myVibe} small />
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          testID="visibility-toggle"
          onPress={flipVisibility}
          style={[styles.visChip, hidden && styles.visChipOff]}
        >
          <Ionicons
            name={hidden ? "eye-off" : "eye"}
            size={12}
            color={hidden ? colors.textTertiary : colors.teal}
          />
          <Text style={[styles.visChipText, hidden && { color: colors.textTertiary }]}>
            {hidden
              ? "Hidden"
              : sessionMinsLeft !== null
              ? `Visible · ${sessionMinsLeft}m left`
              : "Visible"}
          </Text>
        </Pressable>
      </View>

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
              onSelect={(u) => setPreview(u)}
              meUri={user?.photo_url}
              meName={user?.name}
              radiusSetting={user?.radius || 50}
              coords={coords}
              onFilters={() => router.push("/privacy")}
              onCluster={(us) => {
                const counts: Record<string, number> = {};
                us.forEach((u) => {
                  if (u.vibe) counts[u.vibe] = (counts[u.vibe] || 0) + 1;
                });
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                if (top && top[1] / us.length >= 0.5) router.push(`/(tabs)/nearby?vibe=${top[0]}`);
                else router.push("/(tabs)/nearby");
              }}
              onRadiusPress={() => setShowRadius(true)}
              onLearnMore={() => router.push("/location-privacy")}
            />

            {preview && (
              <View style={[styles.previewCard, shadow.card]} testID="marker-preview">
                <View style={styles.bestRow}>
                  <Avatar
                    uri={preview.photo_url}
                    name={preview.name}
                    size={52}
                    ringColor={preview.vibe ? vibeMap[preview.vibe]?.color : undefined}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.previewName}>
                      {preview.name}, {preview.age}
                    </Text>
                    <VibePill vibe={preview.vibe ? vibeMap[preview.vibe] : undefined} small />
                    {!!preview.intent && (
                      <Text style={styles.previewIntent} numberOfLines={1}>
                        {preview.intent}
                      </Text>
                    )}
                    <Text style={styles.bestDist}>{distLabel(preview.distance)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
                    <Pressable testID="preview-close" onPress={() => setPreview(null)} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      testID="preview-view-profile"
                      style={styles.previewBtn}
                      onPress={() => {
                        const id = preview.id;
                        setPreview(null);
                        router.push(`/person/${id}`);
                      }}
                    >
                      <Text style={styles.previewBtnText}>View Profile</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {(user?.radius || 50) >= 250 && (
              <Text style={styles.extendedNote} testID="extended-radius-note">
                Extended radius shows approximate nearby discovery only. Exact locations stay hidden.
              </Text>
            )}

            <View style={[styles.stats, shadow.card]}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{nearby.length >= 100 ? "100+" : nearby.length}</Text>
                <Text style={styles.statLabel}>Nearby</Text>
                <Text style={styles.statSub}>{activeCount} active now</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.teal }]}>{compatible.length}</Text>
                <Text style={styles.statLabel}>Aligned</Text>
                <Text style={styles.statSub}>{strongMatches.length} strong matches</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.orange }]}>{user?.radius || 50}m</Text>
                <Text style={styles.statLabel}>Radius</Text>
                <Text style={styles.statSub}>
                  {user?.plan === "pro" ? "Pro Plan 👑" : user?.plan === "plus" ? "Plus Plan" : "Free Plan"}
                </Text>
              </View>
            </View>

            {nearby.length >= 100 && (
              <View style={styles.densityCard} testID="high-density-card">
                <Text style={styles.densityTitle}>100+ people nearby</Text>
                <Text style={styles.densityText}>
                  Showing the best 100 based on your vibe, filters and safety settings.
                </Text>
                <Pressable
                  testID="why-limit"
                  onPress={() =>
                    showAlert(
                      "Why limit?",
                      "INTRO limits visible people so the map stays clear, safe and relevant. Use filters to refine who you see."
                    )
                  }
                  hitSlop={6}
                >
                  <Text style={styles.densityLink}>Why limit?</Text>
                </Pressable>
              </View>
            )}

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
              <View style={[styles.bestCard, shadow.card]} testID="best-match-card">
                <Text style={styles.bestKicker}>BEST NEARBY MATCH</Text>
                <View style={styles.bestRow}>
                  <Avatar uri={best.photo_url} name={best.name} size={62} ringColor={bestVibe?.color} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.bestName}>
                      {best.name}, {best.age}
                    </Text>
                    <VibePill vibe={bestVibe} small />
                    <Text style={styles.bestDist}>
                      {distLabel(best.distance)}
                      {best.context ? ` · ${best.context}` : ""}
                    </Text>
                  </View>
                </View>
                {!!best.bio && (
                  <Text style={styles.bestBio} numberOfLines={2}>
                    {best.bio}
                  </Text>
                )}
                {!!best.mutual_reason && (
                  <Text style={styles.whyShown} testID="why-shown">
                    Why shown: {best.mutual_reason}
                  </Text>
                )}
                <PrimaryButton
                  testID="best-view-profile"
                  title="View"
                  onPress={() => router.push(`/person/${best.id}`)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : nearby.length === 0 ? (
              <View style={styles.emptyWrap} testID="radar-empty">
                <Text style={styles.emptyTitle}>No one nearby right now</Text>
                <Text style={styles.emptyText}>
                  INTRO works best when people are close by. Try increasing your radius,
                  changing your vibe, or inviting people nearby.
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

            {nearby.length > 0 && (
              <View style={styles.nearbyNow} testID="nearby-now-row">
                <Text style={styles.nearbyNowKicker}>NEARBY NOW</Text>
                <View style={styles.nearbyNowInner}>
                  <PrimaryButton
                    testID="see-more-nearby"
                    title="See More Nearby"
                    onPress={() => router.push("/(tabs)/nearby")}
                    style={{ flex: 1, minHeight: 46 }}
                  />
                  <View style={styles.avatarStack}>
                    {nearby.slice(0, 4).map((u, i) => (
                      <View key={u.id} style={[styles.stackItem, i > 0 && { marginLeft: -10 }]}>
                        <Avatar uri={u.photo_url} name={u.name} size={30} />
                      </View>
                    ))}
                  </View>
                  {nearby.length > 4 && <Text style={styles.moreText}>+{nearby.length - 4} more</Text>}
                </View>
              </View>
            )}

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

      <Modal visible={showRadius} transparent animationType="slide" onRequestClose={() => setShowRadius(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowRadius(false)}>
          <Pressable style={[styles.radiusSheet, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Discovery radius</Text>
            <Text style={styles.sheetSub}>Your radius depends on your plan.</Text>
            {ALL_RADII.map((r) => {
              const locked = r > maxR;
              const selected = (user?.radius || 50) === r;
              return (
                <Pressable
                  key={r}
                  testID={`radius-sheet-${r}`}
                  style={[styles.sheetRow, selected && styles.sheetRowActive]}
                  onPress={() => pickRadius(r)}
                >
                  <Text style={[styles.sheetRowText, locked && { color: colors.textTertiary }]}>{r}m</Text>
                  {locked ? (
                    <View style={styles.lockTag}>
                      <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
                      <Text style={styles.lockTagText}>{r <= 100 ? "Plus" : "Pro"}</Text>
                    </View>
                  ) : selected ? (
                    <Ionicons name="checkmark" size={18} color={colors.teal} />
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={styles.sheetNote}>Bigger radius. Same privacy. Exact locations stay hidden.</Text>
          </Pressable>
        </Pressable>
      </Modal>
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
  vibeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  visChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  visChipOff: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  visChipText: { color: colors.teal, fontSize: 11, fontWeight: "700" },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  previewName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  previewIntent: { color: colors.textSecondary, fontSize: font.sm },
  previewBtn: {
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  previewBtnText: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  extendedNote: {
    color: colors.textTertiary,
    fontSize: font.sm,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  densityCard: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  densityTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  densityText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 19 },
  densityLink: { color: colors.teal, fontSize: font.sm, fontWeight: "800", marginTop: spacing.sm },
  statSub: { color: colors.textTertiary, fontSize: 9.5, fontWeight: "600", marginTop: 2, textAlign: "center" },
  nearbyNow: { marginTop: spacing.md },
  nearbyNowKicker: { color: colors.orange, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm },
  nearbyNowInner: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackItem: { borderWidth: 2, borderColor: colors.surface, borderRadius: 17 },
  moreText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  whyShown: { color: colors.teal, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.4)", justifyContent: "flex-end" },
  radiusSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  sheetTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  sheetSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, marginBottom: spacing.md },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 48,
  },
  sheetRowActive: { backgroundColor: colors.tealSoft },
  sheetRowText: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  lockTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  lockTagText: { color: colors.textTertiary, fontSize: 11, fontWeight: "800" },
  sheetNote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.md },
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

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Modal } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { api } from "@/src/lib/api";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type NearbyUser } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { toggleVisibility, startVisibilitySession } from "@/src/services/privacyService";
import { distLabel } from "@/src/lib/format";
import RadarView from "@/src/components/RadarView";
import RadiusSheet from "@/src/components/RadiusSheet";
import VibePill from "@/src/components/VibePill";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import Logo from "@/src/components/Logo";
import AppModeSwitch from "@/src/components/AppModeSwitch";
import ProfessionalHome from "@/src/components/ProfessionalHome";
import ProfessionalDisclaimerModal from "@/src/components/ProfessionalDisclaimerModal";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import { nearbyEvents, EVENT_CATEGORY_ICONS, type OrbEvent } from "@/src/services/eventService";

const EVENT_CATS = ["All Events", ...Object.keys(EVENT_CATEGORY_ICONS)];

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { coords, permission, nearby, vibeMap, requestLocation, refresh, visibilityEnded, appMode } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [preview, setPreview] = useState<NearbyUser | null>(null);
  const [, forceTick] = useState(0);
  // People Mode Events
  const [eventsOn, setEventsOn] = useState(true);
  const [eventCat, setEventCat] = useState("All Events");
  const [orbEvents, setOrbEvents] = useState<OrbEvent[]>([]);
  const [evSheet, setEvSheet] = useState(false);
  const [evPreview, setEvPreview] = useState<OrbEvent | null>(null);

  const loadEvents = React.useCallback(() => {
    if (!eventsOn) { setOrbEvents([]); return; }
    const lat = coords?.lat ?? -37.8136;
    const lng = coords?.lng ?? 144.9631;
    nearbyEvents(lat, lng, eventCat === "All Events" ? undefined : eventCat)
      .then((r) => setOrbEvents(r.events))
      .catch(() => {});
  }, [coords, eventsOn, eventCat]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  // refresh the session countdown label every 30s
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time radius entitlement migration notice
  useEffect(() => {
    if (user?.radius_migration_notice) {
      showAlert(
        "Radar radius updated",
        "Your Radar is currently set to 250 m. Upgrade anytime to expand your orbit.",
        [{ text: "OK" }]
      );
      api("/users/me/radius-notice-seen", { method: "POST" }).catch(() => {});
      setUser({ ...user, radius_migration_notice: false } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.radius_migration_notice]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    loadEvents();
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
  const best = strongMatches[0];
  const bestVibe = best?.vibe ? vibeMap[best.vibe] : undefined;
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  if (appMode === "professional") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Logo size={26} />
            {user?.is_demo && <Text style={styles.demoBadge} testID="demo-badge">DEMO</Text>}
          </View>
          <View style={styles.headerRight}>
            <Pressable testID="settings-btn" onPress={() => router.push("/privacy")} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
        <AppModeSwitch />
        <ProfessionalHome />
        <ProfessionalDisclaimerModal />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Logo size={26} />
          {user?.is_demo && <Text style={styles.demoBadge} testID="demo-badge">DEMO</Text>}
        </View>
        <View style={styles.headerRight}>
          <Pressable testID="settings-btn" onPress={() => router.push("/privacy")} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <AppModeSwitch />

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
              radiusSetting={user?.radius || 250}
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
              events={eventsOn ? orbEvents : []}
              onSelectEvent={(e) => setEvPreview(e)}
              onEventsPress={() => setEvSheet(true)}
              eventsActive={eventsOn && orbEvents.length > 0}
            />

            {preview && preview.vibe === "opportunity" ? (
              <View style={[styles.previewCard, shadow.card, { borderColor: "#F59E0B66" }]} testID="opportunity-preview">
                <View style={styles.oppHeader}>
                  <View style={styles.oppIconWrap}>
                    <Ionicons name="sparkles" size={13} color="#F59E0B" />
                  </View>
                  <Text style={styles.oppHeading}>Opportunity Nearby</Text>
                  <Pressable testID="preview-close" onPress={() => setPreview(null)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.bestRow}>
                  <Avatar uri={preview.photo_url} name={preview.name} size={46} ringColor="#F59E0B" />
                  <View style={{ flex: 1, gap: 2 }}>
                    {!!(preview.vibe_details?.category || preview.vibe_details?.opportunity_type) && (
                      <Text style={styles.oppMeta}>
                        {[preview.vibe_details?.category, preview.vibe_details?.opportunity_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                    {!!preview.vibe_details?.payment && (
                      <Text style={styles.oppPay}>{preview.vibe_details.payment}</Text>
                    )}
                    <Text style={styles.bestDist}>{distLabel(preview.distance)}</Text>
                  </View>
                </View>
                {!!(preview.vibe_details?.public_summary || preview.intent) && (
                  <Text style={styles.oppSummary} numberOfLines={2}>
                    {preview.vibe_details?.public_summary || preview.intent}
                  </Text>
                )}
                <PrimaryButton
                  testID="opportunity-connect"
                  title="Connect to Discuss"
                  color="#F59E0B"
                  onPress={() => {
                    const id = preview.id;
                    setPreview(null);
                    router.push(`/opportunity/${id}`);
                  }}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : preview ? (
              <View style={[styles.previewCard, shadow.card]} testID="marker-preview">
                <View style={styles.bestRow}>
                  <Avatar
                    uri={preview.photo_url}
                    name={preview.name}
                    size={52}
                    ringColor={preview.vibe ? vibeMap[preview.vibe]?.color : undefined}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
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
                    {!!preview.outside_age_preference && (
                      <Text style={styles.outsideAgeNote} testID="preview-outside-age">
                        A little outside your age preference
                      </Text>
                    )}
                    {!!preview.interests?.length && (
                      <Text style={styles.previewInterests} numberOfLines={1} testID="preview-interests">
                        {preview.interests.slice(0, 3).join(" • ")}
                        {preview.interests.length > 3 ? ` • +${preview.interests.length - 3}` : ""}
                      </Text>
                    )}
                    {!!preview.mutual_interests?.length && (
                      <Text style={styles.previewMutual} numberOfLines={1} testID="preview-mutual">
                        You both like {preview.mutual_interests.slice(0, 2).join(", ")}
                        {preview.mutual_interests.length > 2 ? ` +${preview.mutual_interests.length - 2}` : ""}
                      </Text>
                    )}
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
            ) : null}

            {(user?.radius || 250) >= 500 && (
              <Text style={styles.extendedNote} testID="extended-radius-note">
                Extended radius shows approximate nearby discovery only. Exact locations stay hidden.
              </Text>
            )}

            {user && user.people_discoverable === false && (
              <Pressable
                testID="complete-profile-banner"
                style={[styles.completeBanner, shadow.card]}
                onPress={() => router.push("/edit-profile")}
                accessibilityRole="button"
                accessibilityLabel="Complete your profile"
              >
                <Ionicons name="person-circle-outline" size={24} color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completeTitle}>Complete your profile</Text>
                  <Text style={styles.completeText}>
                    Add at least 2 photos so people nearby can get a better sense of who you are.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.teal} />
              </Pressable>
            )}

            <View style={[styles.stats, shadow.card]}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{nearby.length >= 100 ? "100+" : nearby.length}</Text>
                <Text style={styles.statLabel}>Nearby</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.teal }]}>{compatible.length}</Text>
                <Text style={styles.statLabel}>Aligned</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.orange }]}>{(user?.radius || 250) >= 1000 ? "1km" : `${user?.radius || 250}m`}</Text>
                <Text style={styles.statLabel}>Radius</Text>
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
                      "Orrbbit limits visible people so the map stays clear, safe and relevant. Use filters to refine who you see."
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
                  Orrbbit works best when people are close by. Try increasing your radius,
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
                <View style={styles.nearbyPreviewRow}>
                  <View style={styles.avatarStack}>
                    {nearby.slice(0, 5).map((u, i) => (
                      <View key={u.id} style={[styles.stackItem, i > 0 && { marginLeft: -8 }]}>
                        <Avatar uri={u.photo_url} name={u.name} size={34} />
                      </View>
                    ))}
                  </View>
                  {nearby.length > 5 && (
                    <Text
                      style={styles.moreText}
                      accessibilityLabel={`${nearby.length - 5} more people nearby`}
                    >
                      +{nearby.length - 5} more
                    </Text>
                  )}
                </View>
                <PrimaryButton
                  testID="see-more-nearby"
                  title="See More Nearby"
                  color={colors.teal}
                  onPress={() => router.push("/(tabs)/nearby")}
                  style={{ minHeight: 52, marginTop: spacing.md }}
                />
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

      <RadiusSheet visible={showRadius} onClose={() => setShowRadius(false)} onChanged={refresh} />

      {/* + Create Event — People Mode CTA */}
      {!hidden && (
        <Pressable testID="create-event-fab" style={[styles.eventFab, shadow.card, { bottom: insets.bottom + spacing.lg }]} onPress={() => router.push("/create-event")}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.eventFabTxt}>Create Event</Text>
        </Pressable>
      )}

      {/* Event hotspot preview — bottom sheet */}
      <Modal visible={!!evPreview} transparent animationType="slide" onRequestClose={() => setEvPreview(null)}>
        <Pressable style={styles.evSheetBg} onPress={() => setEvPreview(null)}>
          {evPreview && (
            <Pressable style={[styles.evSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}} testID="event-preview">
              <View style={styles.evHandle} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.evIcon}><Ionicons name={(EVENT_CATEGORY_ICONS[evPreview.category] || "flame") as any} size={22} color={colors.orange} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.evTitle} numberOfLines={1}>{evPreview.title} 🔥</Text>
                  <Text style={styles.evMeta}>Approx. {evPreview.distance >= 1000 ? `${(evPreview.distance / 1000).toFixed(1)}km` : `${evPreview.distance}m`} away · {new Date(evPreview.start_datetime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {new Date(evPreview.start_datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
                </View>
              </View>
              <Text style={styles.evMeta2}>{evPreview.going} going{evPreview.spots_left != null ? ` · ${evPreview.spots_left} spot${evPreview.spots_left === 1 ? "" : "s"} left` : ""} · {evPreview.category} · {evPreview.join_type === "approval" ? "Approval required" : "Everyone"}</Text>
              {!!evPreview.description && <Text style={styles.evDesc} numberOfLines={2}>“{evPreview.description}”</Text>}
              <Text style={styles.evHost}>Hosted by {evPreview.host?.name}</Text>
              <Pressable testID="ev-preview-open" style={styles.evJoinBtn} onPress={() => { const eid = evPreview.id; setEvPreview(null); router.push(`/event/${eid}`); }}>
                <Text style={styles.evJoinTxt}>{evPreview.my_status === "accepted" ? "✓ JOINED · VIEW EVENT" : "VIEW & JOIN EVENT"}</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {/* Events filter sheet */}
      <Modal visible={evSheet} transparent animationType="slide" onRequestClose={() => setEvSheet(false)}>
        <Pressable style={styles.evSheetBg} onPress={() => setEvSheet(false)}>
          <Pressable style={[styles.evSheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}} testID="events-sheet">
            <View style={styles.evHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.evTitle}>Events on Radar</Text>
              <Pressable testID="my-events-link" onPress={() => { setEvSheet(false); router.push("/my-events"); }}>
                <Text style={{ color: colors.teal, fontWeight: "700", fontSize: font.sm }}>My Events</Text>
              </Pressable>
            </View>
            <Pressable testID="events-toggle" style={styles.evToggleRow} onPress={() => setEventsOn(!eventsOn)}>
              <Text style={styles.evToggleTxt}>Show events</Text>
              <Ionicons name={eventsOn ? "toggle" : "toggle-outline"} size={30} color={eventsOn ? colors.teal : colors.textTertiary} />
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
              {EVENT_CATS.map((c) => (
                <Pressable key={c} testID={`ev-cat-${c}`} style={[styles.evCatChip, eventCat === c && styles.evCatChipOn]} onPress={() => setEventCat(c)}>
                  <Text style={[styles.evCatTxt, eventCat === c && { color: "#FFF" }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            {eventsOn && orbEvents.length === 0 && (
              <View style={styles.evEmpty} testID="events-empty">
                <Text style={styles.evEmptyTitle}>NO EVENTS NEARBY YET</Text>
                <Text style={styles.evEmptyTxt}>Nothing happening around you? Create something.</Text>
                <Pressable style={styles.evJoinBtn} onPress={() => { setEvSheet(false); router.push("/create-event"); }}>
                  <Text style={styles.evJoinTxt}>+ CREATE EVENT</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  eventFab: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  eventFabTxt: { color: "#FFF", fontWeight: "800", fontSize: font.sm },
  evSheetBg: { flex: 1, backgroundColor: "rgba(17,24,39,0.4)", justifyContent: "flex-end" },
  evSheet: { backgroundColor: "#FFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: spacing.xl, paddingTop: 8 },
  evHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  evIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center" },
  evTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  evMeta: { color: colors.textSecondary, fontSize: font.micro, marginTop: 2 },
  evMeta2: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.md, fontWeight: "600" },
  evDesc: { color: colors.textSecondary, fontSize: font.sm, fontStyle: "italic", marginTop: 6, lineHeight: 19 },
  evHost: { color: colors.textTertiary, fontSize: font.micro, marginTop: 6 },
  evJoinBtn: { backgroundColor: colors.orange, borderRadius: 999, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, alignSelf: "stretch" },
  evJoinTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base, letterSpacing: 0.4 },
  evToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, marginTop: 4 },
  evToggleTxt: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  evCatChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  evCatChipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  evCatTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  evEmpty: { alignItems: "center", paddingVertical: spacing.lg, gap: 4 },
  evEmptyTitle: { color: colors.text, fontWeight: "800", fontSize: font.sm, letterSpacing: 0.6 },
  evEmptyTxt: { color: colors.textSecondary, fontSize: font.sm },
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
  },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  demoBadge: { backgroundColor: colors.tealSoft, color: colors.teal, fontSize: 10, fontWeight: "800", letterSpacing: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
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
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  visChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    minHeight: 36,
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
  oppHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  oppIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F59E0B1A",
    alignItems: "center",
    justifyContent: "center",
  },
  oppHeading: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: "800" },
  oppMeta: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  oppPay: { color: "#F59E0B", fontSize: font.sm, fontWeight: "700" },
  oppSummary: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20, marginTop: spacing.md },
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
  nearbyNow: { marginTop: spacing.lg },
  nearbyNowKicker: { color: colors.orange, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginBottom: spacing.sm },
  nearbyPreviewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 40 },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackItem: { borderWidth: 2, borderColor: colors.surface, borderRadius: 19 },
  moreText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  whyShown: { color: colors.teal, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm, lineHeight: 18 },
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
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  statBox: { alignItems: "center", flex: 1, paddingHorizontal: spacing.xs },
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
  outsideAgeNote: { color: colors.textTertiary, fontSize: 11, fontStyle: "italic" },
  previewInterests: { color: colors.textTertiary, fontSize: 11, fontWeight: "600" },
  previewMutual: { color: colors.orange, fontSize: 11, fontWeight: "700" },
  completeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  completeTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  completeText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 17 },
  bestBio: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.md, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
});

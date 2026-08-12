import { resolvePhotoUri } from "@/src/lib/photo";
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, useWindowDimensions } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { requestConnection } from "@/src/services/matchingService";
import { blockUser } from "@/src/services/safetyService";
import { trackProfileView, trackMatchCreated } from "@/src/services/analyticsService";
import { api } from "@/src/lib/api";
import { distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import VibeDetailsCard from "@/src/components/VibeDetailsCard";
import InterestChip from "@/src/components/InterestChip";
import EmptyState from "@/src/components/EmptyState";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function PersonPreview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findUser, vibeMap, refresh } = useApp();
  const { user: me } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [requested, setRequested] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const { width } = useWindowDimensions();
  const user = findUser(id!);

  const DISMISS_REASONS = [
    "Wrong vibe", "Too far", "Not enough info", "Not interested",
    "Felt unsafe", "Not now", "Already saw this person", "Recruiter not relevant",
  ];

  const dismissWith = async (reason?: string) => {
    if (reason && user) {
      api("/dismissal-feedback", { method: "POST", body: { user_id: user.id, reason } }).catch(() => {});
    }
    router.back();
  };

  const hideFromPerson = async () => {
    if (!user) return;
    await api("/hide", { method: "POST", body: { user_id: user.id } }).catch(() => {});
    await refresh();
    router.back();
  };

  useEffect(() => {
    if (user) trackProfileView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <Pressable testID="person-close" onPress={() => router.back()} style={styles.closeFloat}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <EmptyState
          testID="person-out-of-range"
          icon="location"
          title="Out of range"
          text="They're outside your visible radius right now. Try increasing your radius."
        />
      </View>
    );
  }

  const vibe = user.vibe ? vibeMap[user.vibe] : undefined;
  const action = vibe?.action || "Let's Connect";
  const sameVibe = !!me?.vibe && me.vibe === user.vibe;
  const reason = user.mutual_reason || (sameVibe && vibe ? `You both chose ${vibe.label}` : null);
  const photos = (user.photos?.length ? user.photos : user.photo_url ? [user.photo_url] : []).slice(0, 6);
  const firstName = (user.name || "").split(" ")[0];
  const aboutRows = [
    { label: "Lives in", value: [user.city, user.country].filter(Boolean).join(", ") },
    { label: "From", value: user.home_city },
    { label: "Occupation", value: user.occupation },
    { label: "Education", value: user.education },
    { label: "Languages", value: user.languages },
  ].filter((r) => !!r.value);
  const joinedLabel = (() => {
    if (!user.joined) return null;
    const [y, m] = user.joined.split("-").map(Number);
    if (!y || !m) return null;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${months[m - 1]} ${y}`;
  })();

  const saveForLater = async () => {
    setSaved(true);
    try {
      await api("/saved", { method: "POST", body: { user_id: user.id, distance: user.distance } });
    } catch {
      setSaved(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const res = await requestConnection(user.id);
      if (res.status === "connected") {
        trackMatchCreated();
        router.replace({
          pathname: "/match",
          params: {
            userId: user.id,
            name: user.name,
            photo: user.photo_url || "",
            vibe: user.vibe || "",
          },
        });
        return;
      }
      setRequested(true);
      showAlert("Request sent", `${user.name} will be asked to accept before you're connected.`);
    } catch (e: any) {
      showAlert("Couldn't send request", e.message || "Please try again.");
    }
    setBusy(false);
  };

  const doBlock = () => {
    showAlert("Block this user?", `${user.name} won't see you and you won't see them.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockUser(user.id);
          await refresh();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.photoWrap}>
          {photos.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIdx(Math.min(photos.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))))}
              testID="profile-gallery"
            >
              {photos.map((p, i) => (
                <Pressable key={`${i}-${p.slice(0, 24)}`} onPress={() => setExpanded(true)} testID={`gallery-photo-${i}`}>
                  {failed[i] ? (
                    <View style={[styles.photoFallback, { width, height: 360 }]}>
                      <Avatar name={user.name} size={140} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: resolvePhotoUri(p) || p }}
                      style={{ width, height: 360, backgroundColor: colors.card }}
                      contentFit="cover"
                      transition={200}
                      onError={() => setFailed((f) => ({ ...f, [i]: true }))}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Avatar name={user.name} size={140} />
            </View>
          )}
          {photos.length > 1 && (
            <View style={styles.photoCounter} testID="photo-counter">
              <Ionicons name="images-outline" size={12} color="#FFF" />
              <Text style={styles.photoCounterText}>
                {photoIdx + 1}/{photos.length}
              </Text>
            </View>
          )}
          {photos.length > 1 && (
            <View style={styles.dotsRow}>
              {photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
              ))}
            </View>
          )}
          <Pressable
            testID="person-close"
            onPress={() => router.back()}
            style={[styles.close, { top: insets.top + spacing.sm }]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.distanceTag}>
            <Ionicons name="location" size={13} color={colors.orange} />
            <Text style={styles.distanceText}>{distLabel(user.distance)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {user.name}, {user.age}
            </Text>
            {user.verified && (
              <Ionicons name="checkmark-circle" size={22} color={colors.teal} testID="verified-badge" />
            )}
          </View>
          {!!user.outside_age_preference && (
            <Text style={styles.outsideAgeNote} testID="profile-outside-age">
              A little outside your age preference
            </Text>
          )}
          <View style={styles.badgeRow}>
            <VibePill vibe={vibe} />
            {user.active_now && (
              <View style={styles.activeBadge} testID="active-now-badge">
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Active now</Text>
              </View>
            )}
            <View style={styles.protectedBadge} testID="safety-protected-badge">
              <Ionicons name="shield-checkmark" size={12} color={colors.teal} />
              <Text style={styles.protectedText}>Orrbbit safety protected</Text>
            </View>
          </View>
          {!!reason && (
            <View style={styles.mutualVibe} testID="mutual-reason-label">
              <Ionicons name="sparkles" size={14} color={colors.orange} />
              <Text style={styles.mutualText}>{reason}</Text>
            </View>
          )}
          {!!user.intent && (
            <Text style={styles.intentLine} testID="person-intent">{user.intent}</Text>
          )}
          {!!user.bio && (
            <>
              <Text style={styles.sectionLabel}>ABOUT {firstName.toUpperCase()}</Text>
              <Text style={styles.bio}>{user.bio}</Text>
            </>
          )}

          <VibeDetailsCard details={user.vibe_details || {}} />

          {aboutRows.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ABOUT</Text>
              <View style={styles.aboutCard} testID="about-card">
                {aboutRows.map((r, i) => (
                  <View key={r.label} style={[styles.aboutRow, i > 0 && styles.aboutRowBorder]}>
                    <Text style={styles.aboutLabel}>{r.label}</Text>
                    <Text style={styles.aboutValue} numberOfLines={2}>
                      {r.value}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {!!user.interests?.length && (
            <>
              <Text style={styles.sectionLabel}>INTERESTS</Text>
              <View style={styles.chips}>
                {user.interests.map((i) => (
                  <InterestChip key={i} label={i} />
                ))}
              </View>
            </>
          )}

          {!!user.mutual_interests?.length && (
            <>
              <Text style={styles.sectionLabel}>YOU BOTH LIKE</Text>
              <View style={styles.chips} testID="mutual-interests">
                {user.mutual_interests.slice(0, 4).map((i) => (
                  <InterestChip key={i} label={i} selected />
                ))}
                {user.mutual_interests.length > 4 && (
                  <View style={styles.moreChip}>
                    <Text style={styles.moreChipText}>+{user.mutual_interests.length - 4}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {!!user.prompts?.length && (
            <>
              <Text style={styles.sectionLabel}>ABOUT ME</Text>
              {user.prompts.slice(0, 3).map((p, i) => (
                <View key={`${p.prompt}-${i}`} style={styles.promptCard} testID={`profile-prompt-${i}`}>
                  <Text style={styles.promptTitle}>{p.prompt}</Text>
                  <Text style={styles.promptAnswer}>“{p.answer}”</Text>
                </View>
              ))}
            </>
          )}

          {!!joinedLabel && (
            <View style={styles.metaRow}>
              <Ionicons name="planet-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.metaText}>Joined Orrbbit {joinedLabel}</Text>
            </View>
          )}

          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark" size={16} color={colors.teal} />
            <Text style={styles.safetyText}>
              Exact location is hidden until both users accept.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {showDismiss ? (
          <View testID="dismiss-reasons">
            <Text style={styles.dismissTitle}>Why not this one? (optional)</Text>
            <View style={styles.dismissChips}>
              {DISMISS_REASONS.map((r) => (
                <Pressable key={r} testID={`dismiss-${r.replace(/ /g, "-")}`} style={styles.dismissChip} onPress={() => dismissWith(r)}>
                  <Text style={styles.dismissChipText}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable testID="dismiss-skip" onPress={() => dismissWith()} style={{ alignSelf: "center", padding: spacing.sm }}>
              <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Skip</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <PrimaryButton
              testID="person-connect"
              title={requested ? "Request Sent ✓" : action}
              onPress={connect}
              loading={busy}
              disabled={requested}
            />
            <View style={styles.secondaryRow}>
              <Pressable testID="person-not-now" style={styles.smallBtn} onPress={() => setShowDismiss(true)}>
                <Text style={styles.smallBtnText}>Not Now</Text>
              </Pressable>
              <Pressable testID="person-save-later" style={styles.smallBtn} onPress={saveForLater} disabled={saved}>
                <Text style={[styles.smallBtnText, { color: saved ? colors.success : colors.teal }]}>
                  {saved ? "Saved ✓" : "Save for later"}
                </Text>
              </Pressable>
              <Pressable testID="person-hide" style={styles.smallBtn} onPress={hideFromPerson}>
                <Text style={styles.smallBtnText}>Hide</Text>
              </Pressable>
              <Pressable testID="person-block" style={styles.smallBtn} onPress={doBlock}>
                <Text style={[styles.smallBtnText, { color: colors.pink }]}>Block</Text>
              </Pressable>
              <Pressable
                testID="person-report"
                style={styles.smallBtn}
                onPress={() =>
                  router.push({ pathname: "/report", params: { userId: user.id, name: user.name } })
                }
              >
                <Text style={[styles.smallBtnText, { color: colors.pink }]}>Report</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.expandOverlay}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: photoIdx * width, y: 0 }}
            onMomentumScrollEnd={(e) => setPhotoIdx(Math.min(photos.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))))}
          >
            {photos.map((p, i) => (
              <View key={`x-${i}`} style={{ width, justifyContent: "center" }}>
                <Image
                  source={{ uri: resolvePhotoUri(p) || p }}
                  style={{ width, height: width * 1.25, backgroundColor: "#111" }}
                  contentFit="contain"
                  transition={150}
                />
              </View>
            ))}
          </ScrollView>
          <View style={[styles.expandCounter, { top: insets.top + spacing.md }]}>
            <Text style={styles.photoCounterText}>
              {photoIdx + 1}/{photos.length}
            </Text>
          </View>
          <Pressable
            testID="expand-close"
            onPress={() => setExpanded(false)}
            style={[styles.expandClose, { top: insets.top + spacing.md }]}
            accessibilityLabel="Close photo"
          >
            <Ionicons name="close" size={24} color="#FFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  photoWrap: { width: "100%", height: 360 },
  photo: { width: "100%", height: "100%" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  close: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFFEE",
    alignItems: "center",
    justifyContent: "center",
  },
  closeFloat: { alignSelf: "flex-end", marginRight: spacing.lg, padding: spacing.sm },
  distanceTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  photoCounter: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  photoCounterText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
  dotsRow: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: "#FFF", width: 14 },
  aboutCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  aboutRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.lg },
  aboutRowBorder: { borderTopWidth: 1, borderColor: colors.border },
  aboutLabel: { color: colors.textSecondary, fontSize: font.base, fontWeight: "700", width: 96 },
  aboutValue: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1 },
  moreChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    justifyContent: "center",
  },
  moreChipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  promptCard: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: 4,
  },
  promptTitle: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  promptAnswer: { color: colors.text, fontSize: font.lg, lineHeight: 23 },
  expandOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "center" },
  expandClose: {
    position: "absolute",
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandCounter: {
    position: "absolute",
    left: spacing.lg,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  outsideAgeNote: { color: colors.textTertiary, fontSize: font.sm, fontStyle: "italic", marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EBFBF1",
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  activeText: { color: colors.success, fontSize: font.sm, fontWeight: "700" },
  protectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
  },
  protectedText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  mutualVibe: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.orangeSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
    alignSelf: "flex-start",
  },
  mutualText: { color: colors.orange, fontSize: font.base, fontWeight: "700", flex: 1 },
  intentLine: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.md },
  secondaryRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginTop: spacing.sm, flexWrap: "wrap" },
  dismissTitle: { color: colors.text, fontSize: font.base, fontWeight: "800", marginBottom: spacing.sm, textAlign: "center" },
  dismissChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  dismissChip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  dismissChipText: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  smallBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, minHeight: 44, justifyContent: "center" },
  smallBtnText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "700" },
  bio: { color: colors.textSecondary, fontSize: font.lg, lineHeight: 24, marginTop: spacing.lg },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl },
  metaText: { color: colors.textSecondary, fontSize: font.base },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  safetyText: { color: colors.text, fontSize: font.sm, flex: 1 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
});

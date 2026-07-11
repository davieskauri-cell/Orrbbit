import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { createMatch } from "@/src/services/matchingService";
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
  const [showDismiss, setShowDismiss] = useState(false);
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
      await createMatch(user.id);
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
    } catch {
      setBusy(false);
    }
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
          {user.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Avatar name={user.name} size={140} />
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
              <Text style={styles.protectedText}>Intro safety protected</Text>
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
          {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          <VibeDetailsCard details={user.vibe_details || {}} />

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

          <View style={styles.metaRow}>
            <Ionicons name="home-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.metaText}>From Melbourne</Text>
          </View>

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
            <PrimaryButton testID="person-connect" title={action} onPress={connect} loading={busy} />
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
    gap: 5,
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBFBF1",
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  activeText: { color: colors.success, fontSize: font.sm, fontWeight: "700" },
  protectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
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
  dismissChip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7 },
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

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { updatePrivacySettings } from "@/src/services/privacyService";
import { track } from "@/src/services/analyticsService";
import ToggleRow from "@/src/components/ToggleRow";
import AgeRangeSlider from "@/src/components/AgeRangeSlider";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const RADII = [100, 250, 500, 750, 1000];
const DURATIONS = [15, 30, 60];
const AUDIENCES = [
  { key: "everyone", label: "Everyone" },
  { key: "same_vibe", label: "Same vibe only" },
  { key: "verified", label: "Verified only" },
];

const PRIVACY_POINTS = [
  "You control your location.",
  "Bigger radius. Same privacy. Exact locations stay hidden.",
  "Your exact location is hidden until both people accept.",
  "Meetup sharing ends after 15 minutes.",
  "No route history.",
  "You can turn off anytime.",
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [radiusM, setRadiusM] = useState(user?.radius || 250);
  const [visibleFor, setVisibleFor] = useState(user?.visible_for || 60);
  const [visible, setVisible] = useState(!!user?.visible);
  const [ghost, setGhost] = useState(!!user?.ghost_mode);
  const [quiet, setQuiet] = useState(!!user?.quiet_mode);
  const [paused, setPaused] = useState(!!user?.paused);
  const [sameVibe, setSameVibe] = useState(!!user?.only_same_vibe);
  const [verifiedOnly, setVerifiedOnly] = useState(!!user?.verified_only);
  const [showRecruiters, setShowRecruiters] = useState(user?.show_recruiters !== false);
  const [mutualOnly, setMutualOnly] = useState(!!user?.mutual_only);
  const [audience, setAudience] = useState(user?.who_can_see || "everyone");
  const [busy, setBusy] = useState(false);

  // People Mode age preference — free feature, never behind a subscription
  const { appMode } = useApp();
  const isPeople = appMode !== "professional";
  const [ageMin, setAgeMin] = useState(user?.people_min_age ?? 18);
  const [ageMax, setAgeMax] = useState(user?.people_max_age ?? 65);
  const [ageExpansion, setAgeExpansion] = useState(user?.people_allow_age_expansion !== false);

  useEffect(() => {
    if (isPeople) track("age_filter_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-sync from the account when it hydrates/refreshes after mount
  useEffect(() => {
    if (!user) return;
    setAgeMin(user.people_min_age ?? 18);
    setAgeMax(user.people_max_age ?? 65);
    setAgeExpansion(user.people_allow_age_expansion !== false);
    setRadiusM(user.radius || 250);
    setVisibleFor(user.visible_for || 60);
    setVisible(!!user.visible);
    setGhost(!!user.ghost_mode);
    setQuiet(!!user.quiet_mode);
    setPaused(!!user.paused);
    setSameVibe(!!user.only_same_vibe);
    setVerifiedOnly(!!user.verified_only);
    setShowRecruiters(user.show_recruiters !== false);
    setMutualOnly(!!user.mutual_only);
    setAudience(user.who_can_see || "everyone");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.people_min_age, user?.people_max_age, user?.people_allow_age_expansion, user?.radius]);

  const resetAgeFilters = () => {
    setAgeMin(18);
    setAgeMax(65);
    setAgeExpansion(true);
    track("age_filter_reset");
  };

  const maxR = user?.max_radius || 250;
  const planName = user?.plan === "pro" ? "Orrbbit Pro" : user?.plan === "plus" ? "Orrbbit Plus" : "Free";

  const onLockedRadius = (r: number) => {
    const needsPlus = r <= 500;
    showAlert(
      needsPlus ? "Unlock 500 m with Orrbbit Plus" : "Unlock up to 1 km with Orrbbit Pro",
      "Expand your orbit to discover more people and professionals nearby.",
      [
        { text: "Maybe later", style: "cancel" },
        { text: needsPlus ? "Upgrade to Plus" : "Upgrade to Pro", onPress: () => router.push(`/plans?plan=${needsPlus ? "plus" : "pro"}`) },
      ]
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updatePrivacySettings({
        ...(isPeople
          ? {
              people_min_age: ageMin,
              people_max_age: ageMax,
              people_allow_age_expansion: ageExpansion,
            }
          : {}),
        radius: radiusM,
        visible_for: visibleFor,
        visible,
        ghost_mode: ghost,
        quiet_mode: quiet,
        paused,
        only_same_vibe: sameVibe,
        verified_only: verifiedOnly,
        show_recruiters: showRecruiters,
        mutual_only: mutualOnly,
        who_can_see: audience,
      });
      setUser(updated as any);
      if (isPeople) {
        track("age_filter_applied", {
          min_age: ageMin,
          max_age: ageMax,
          expansion_enabled: ageExpansion,
          current_status: user?.vibe || null,
          current_plan: user?.plan || "free",
        });
      }
      router.back();
    } catch (e: any) {
      showAlert("Couldn't save your settings", e?.message || "Please check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable testID="privacy-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Adjust your visibility</Text>
        </View>

        {isPeople && (
          <>
            <Text style={styles.label}>Age</Text>
            <View style={styles.ageHeader}>
              <Text style={styles.ageTitle}>Age range</Text>
              <Text style={styles.ageValue} testID="age-range-value">
                {ageMin} – {ageMax >= 65 ? "65+" : ageMax}
              </Text>
            </View>
            <AgeRangeSlider
              testID="age-range-slider"
              valueMin={ageMin}
              valueMax={ageMax}
              onChange={(mn, mx) => {
                setAgeMin(mn);
                setAgeMax(mx);
              }}
              onChangeEnd={() => track("age_range_changed")}
            />
            <ToggleRow
              testID="toggle-age-expansion"
              title="Show people outside my preferred age range when nearby results are limited"
              description="A small number of people slightly outside your range may appear — always clearly marked."
              value={ageExpansion}
              onChange={(v) => {
                setAgeExpansion(v);
                track(v ? "age_expansion_enabled" : "age_expansion_disabled");
              }}
            />
          </>
        )}

        <Text style={styles.label}>Plan & radius</Text>
        <View style={styles.chipRow}>
          {RADII.map((r) => {
            const active = radiusM === r;
            const locked = r > maxR;
            return (
              <Pressable
                key={r}
                testID={`radius-option-${r}`}
                onPress={() => (locked ? onLockedRadius(r) : setRadiusM(r))}
                style={[styles.chip, active && styles.chipActive, locked && styles.chipLocked]}
              >
                {locked && <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />}
                <Text style={[styles.chipText, active && styles.chipTextActive, locked && styles.chipTextLocked]}>
                  {r >= 1000 ? "1 km" : `${r} m`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          {planName} plan · up to {maxR >= 1000 ? "1 km" : `${maxR} m`}. Your plan controls your maximum discovery radius. Higher
          radius still keeps exact locations hidden.
        </Text>
        {maxR < 500 && (
          <Pressable testID="privacy-see-plans" onPress={() => router.push("/plans")} style={styles.plansLink}>
            <Ionicons name="diamond-outline" size={13} color={colors.orange} />
            <Text style={styles.plansLinkText}>Unlock a bigger radius with Orrbbit Plus or Pro</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.orange} />
          </Pressable>
        )}

        <Text style={styles.label}>Visible for</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => {
            const active = visibleFor === d;
            return (
              <Pressable
                key={d}
                testID={`duration-option-${d}`}
                onPress={() => setVisibleFor(d)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d} min</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.section}>
          <ToggleRow
            testID="toggle-visibility"
            title="Visibility"
            description="Appear on nearby radars."
            value={visible}
            onChange={setVisible}
          />
          <ToggleRow
            testID="toggle-quiet"
            title="Quiet Mode"
            description="Quiet Mode lets you browse without receiving pings. You stay visible."
            value={quiet}
            onChange={setQuiet}
          />
          <ToggleRow
            testID="toggle-ghost"
            title="Ghost mode"
            description="Browse without being seen by anyone."
            value={ghost}
            onChange={setGhost}
          />
          <ToggleRow
            testID="toggle-pause"
            title="Pause visibility"
            description="Take a quick break from the radar."
            value={paused}
            onChange={setPaused}
          />
          <ToggleRow
            testID="toggle-same-vibe"
            title="Only show same vibe"
            description="Only see people with your current vibe."
            value={sameVibe}
            onChange={setSameVibe}
          />
          <ToggleRow
            testID="toggle-verified"
            title="Verified only"
            description="Only see verified profiles."
            value={verifiedOnly}
            onChange={setVerifiedOnly}
          />
          <ToggleRow
            testID="toggle-recruiters"
            title="Show me recruiter profiles"
            description="Hide recruiters from your radar and nearby list. Report recruiter spam anytime."
            value={showRecruiters}
            onChange={setShowRecruiters}
          />
          <ToggleRow
            testID="toggle-mutual-only"
            title="Mutual Only Mode"
            description="You'll only appear to people who match your current preferences."
            value={mutualOnly}
            onChange={setMutualOnly}
          />
        </View>

        <Text style={styles.label}>Who can see me</Text>
        <View style={styles.chipRow}>
          {AUDIENCES.map((a) => {
            const active = audience === a.key;
            return (
              <Pressable
                key={a.key}
                testID={`audience-${a.key}`}
                onPress={() => setAudience(a.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.privacyCard}>
          {PRIVACY_POINTS.map((p) => (
            <View key={p} style={styles.pointRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.footerRow}>
          {isPeople && (
            <Pressable
              testID="reset-filters"
              onPress={resetAgeFilters}
              style={styles.resetBtn}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <PrimaryButton testID="save-privacy" title="Apply Filters" onPress={save} loading={busy} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", flex: 1 },
  label: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    minWidth: 64,
    alignItems: "center",
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipLocked: { flexDirection: "row", gap: 4, opacity: 0.7, backgroundColor: colors.surface },
  chipText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
  chipTextActive: { color: "#FFF" },
  chipTextLocked: { color: colors.textTertiary },
  plansLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingVertical: spacing.sm },
  plansLinkText: { color: colors.orange, fontSize: font.sm, fontWeight: "700", flex: 1 },
  hint: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm, lineHeight: 18 },
  section: { marginTop: spacing.lg, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  privacyCard: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  pointRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pointText: { color: colors.text, fontSize: font.base, flex: 1 },
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
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resetBtn: {
    minHeight: 48,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
  },
  resetText: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  ageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  ageTitle: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  ageValue: { color: colors.teal, fontSize: font.lg, fontWeight: "800" },
});

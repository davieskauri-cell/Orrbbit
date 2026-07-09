import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { updatePrivacySettings } from "@/src/services/privacyService";
import ToggleRow from "@/src/components/ToggleRow";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const RADII = [10, 25, 50, 100];
const DURATIONS = [15, 30, 60];
const AUDIENCES = [
  { key: "everyone", label: "Everyone" },
  { key: "same_vibe", label: "Same vibe only" },
  { key: "verified", label: "Verified only" },
];

const PRIVACY_POINTS = [
  "You control your location.",
  "INTRO never shows users beyond 100m.",
  "Your exact location is hidden until both people accept.",
  "Meetup sharing ends after 15 minutes.",
  "No route history.",
  "You can turn off anytime.",
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [radiusM, setRadiusM] = useState(user?.radius || 50);
  const [visibleFor, setVisibleFor] = useState(user?.visible_for || 60);
  const [visible, setVisible] = useState(!!user?.visible);
  const [ghost, setGhost] = useState(!!user?.ghost_mode);
  const [quiet, setQuiet] = useState(!!user?.quiet_mode);
  const [paused, setPaused] = useState(!!user?.paused);
  const [sameVibe, setSameVibe] = useState(!!user?.only_same_vibe);
  const [verifiedOnly, setVerifiedOnly] = useState(!!user?.verified_only);
  const [showRecruiters, setShowRecruiters] = useState(user?.show_recruiters !== false);
  const [audience, setAudience] = useState(user?.who_can_see || "everyone");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updatePrivacySettings({
        radius: radiusM,
        visible_for: visibleFor,
        visible,
        ghost_mode: ghost,
        quiet_mode: quiet,
        paused,
        only_same_vibe: sameVibe,
        verified_only: verifiedOnly,
        show_recruiters: showRecruiters,
        who_can_see: audience,
      });
      setUser(updated as any);
      router.back();
    } catch {}
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

        <Text style={styles.label}>Visible radius</Text>
        <View style={styles.chipRow}>
          {RADII.map((r) => {
            const active = radiusM === r;
            return (
              <Pressable
                key={r}
                testID={`radius-option-${r}`}
                onPress={() => setRadiusM(r)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}m</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Maximum radius is 100 metres — Intro never shows anyone further away.</Text>

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
        <PrimaryButton testID="save-privacy" title="Save Settings" onPress={save} loading={busy} />
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
  chipText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
  chipTextActive: { color: "#FFF" },
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
});

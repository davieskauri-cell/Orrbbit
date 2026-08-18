import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { updateVibe } from "@/src/services/userService";
import { updatePrivacySettings } from "@/src/services/privacyService";
import { track } from "@/src/services/analyticsService";
import VibePicker from "@/src/components/VibePicker";
import AgeRangeSlider from "@/src/components/AgeRangeSlider";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function ChangeVibeModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const { vibes, refresh } = useApp();
  const [selected, setSelected] = useState<string | null>(user?.vibe || null);
  const [busy, setBusy] = useState(false);
  // One-time "Who would you like to meet?" prompt for Looking for a Relationship
  const [showRelPrompt, setShowRelPrompt] = useState(false);
  const [relMin, setRelMin] = useState(24);
  const [relMax, setRelMax] = useState(34);
  const [relBusy, setRelBusy] = useState(false);

  const saveRelPreference = async () => {
    setRelBusy(true);
    try {
      const updated = await updatePrivacySettings({
        people_min_age: relMin,
        people_max_age: relMax,
        relationship_age_prompt_seen: true,
      });
      setUser(updated as any);
      track("relationship_age_preference_saved", { min_age: relMin, max_age: relMax });
      setRelBusy(false);
      setShowRelPrompt(false);
      router.back();
      return;
    } catch (e: any) {
      showAlert("Couldn't save your preference", e?.message || "Please check your connection and try again.");
    }
    setRelBusy(false);
  };

  const skipRelPreference = async () => {
    try {
      const updated = await updatePrivacySettings({ relationship_age_prompt_seen: true });
      setUser(updated as any);
      track("relationship_age_prompt_skipped");
    } catch {}
    setShowRelPrompt(false);
    router.back();
  };

  const save = async () => {
    if (!selected) return;
    const changed = selected !== user?.vibe;
    setBusy(true);
    try {
      const updated = await updateVibe(selected);
      setUser(updated as any);
      await refresh();
      if (selected === "relationship" && changed && !user?.relationship_age_prompt_seen) {
        // optional one-time preference prompt — never forced, never repeated
        const broadDefault = (user?.people_min_age ?? 18) <= 18 && (user?.people_max_age ?? 65) >= 65;
        setRelMin(broadDefault ? 24 : user?.people_min_age ?? 24);
        setRelMax(broadDefault ? 34 : user?.people_max_age ?? 34);
        setShowRelPrompt(true);
        track("relationship_age_prompt_viewed");
      } else if (changed) {
        showAlert("You changed your vibe", "Do you want to update your vibe details?", [
          { text: "Keep for now", style: "cancel", onPress: () => router.back() },
          { text: "Update details", onPress: () => router.replace(selected === "opportunity" ? "/opportunity-details" : "/vibe-details") },
        ]);
      } else {
        router.back();
      }
    } catch (e: any) {
      showAlert("Couldn't update your vibe", e?.message || "Please check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <View style={[styles.container, { paddingTop: spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>What are you open to?</Text>
        <Pressable testID="vibe-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.sub}>Choose your vibe. You can change this anytime.</Text>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <VibePicker vibes={vibes} value={selected} onChange={setSelected} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="save-vibe-btn"
          title="Set My Vibe"
          onPress={save}
          disabled={!selected}
          loading={busy}
        />
      </View>

      <Modal visible={showRelPrompt} transparent animationType="fade" onRequestClose={skipRelPreference}>
        <View style={styles.relOverlay}>
          <View style={styles.relCard} testID="relationship-age-prompt">
            <Text style={styles.relHeading}>Who would you like to meet?</Text>
            <Text style={styles.relSub}>
              Set an age preference for People Mode. You can change it anytime in Filters.
            </Text>
            <View style={styles.relAgeHeader}>
              <Text style={styles.relAgeTitle}>Age preference</Text>
              <Text style={styles.relAgeValue} testID="relationship-age-value">
                {relMin} – {relMax >= 65 ? "65+" : relMax}
              </Text>
            </View>
            <AgeRangeSlider
              testID="relationship-age-slider"
              valueMin={relMin}
              valueMax={relMax}
              onChange={(mn, mx) => {
                setRelMin(mn);
                setRelMax(mx);
              }}
            />
            <PrimaryButton
              testID="relationship-age-save"
              title="Save preference"
              onPress={saveRelPreference}
              loading={relBusy}
              style={{ marginTop: spacing.lg }}
            />
            <Pressable
              testID="relationship-age-skip"
              onPress={skipRelPreference}
              style={styles.relSkipBtn}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.relSkipText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs },
  footer: { paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
  relOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  relCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  relHeading: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  relSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  relAgeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  relAgeTitle: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  relAgeValue: { color: colors.teal, fontSize: font.lg, fontWeight: "800" },
  relSkipBtn: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  relSkipText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "700" },
});

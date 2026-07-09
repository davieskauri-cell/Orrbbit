import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { VIBE_FORMS, VISIBILITY_LABELS, detailsHeadline, DetailField } from "@/src/lib/vibeDetailForms";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const SENSITIVE_VIBES = ["relationship", "need_advice"];

export default function VibeDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { user, setUser } = useAuth();
  const { vibeMap, refresh } = useApp();
  const vibeKey = user?.vibe || "open_to_chat";
  const vibe = vibeMap[vibeKey];
  const fields = VIBE_FORMS[vibeKey] || VIBE_FORMS.open_to_chat;
  const [details, setDetails] = useState<Record<string, any>>(user?.vibe_details || {});
  const [busy, setBusy] = useState(false);

  const done = () => {
    if (next === "tabs") router.replace("/(tabs)");
    else router.back();
  };

  const set = (key: string, value: any) => setDetails((d) => ({ ...d, [key]: value }));

  const toggleMulti = (key: string, option: string) =>
    setDetails((d) => {
      const cur: string[] = d[key] || [];
      return { ...d, [key]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option] };
    });

  const save = async () => {
    setBusy(true);
    try {
      const payload: Record<string, any> = { ...details };
      // normalise flags used by matching
      if (payload.recruiter_mode !== undefined) {
        payload.recruiter_mode = payload.recruiter_mode === "Yes, I'm hiring";
      }
      if (payload.professional_identity === "Job seeker") payload.job_seeker_mode = true;
      if (payload.open_to_recruiters !== undefined) {
        payload.open_to_recruiters = payload.open_to_recruiters === "Yes";
      }
      if (!payload.intent) {
        const headline = detailsHeadline(vibeKey, payload);
        if (headline) payload.intent = headline;
      }
      if (!payload.visibility) payload.visibility = "public";
      const updated = await api("/users/me/vibe-details", { method: "PUT", body: { details: payload } });
      setUser(updated as any);
      await refresh();
      done();
    } catch {}
    setBusy(false);
  };

  const renderField = (f: DetailField) => {
    if (f.showIf && !f.showIf(details)) return null;
    if (f.type === "text") {
      return (
        <View key={f.key}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            testID={`vd-${f.key}`}
            style={styles.input}
            value={details[f.key] || ""}
            onChangeText={(t) => set(f.key, t)}
            placeholder={f.placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline={f.key === "context" || f.key === "background"}
          />
        </View>
      );
    }
    const isVisibility = f.key === "visibility";
    return (
      <View key={f.key}>
        <Text style={styles.label}>{f.label}</Text>
        <View style={styles.chips}>
          {(f.options || []).map((o) => {
            const active = f.type === "single" ? details[f.key] === o : (details[f.key] || []).includes(o);
            return (
              <Pressable
                key={o}
                testID={`vd-${f.key}-${o.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => (f.type === "single" ? set(f.key, active ? undefined : o) : toggleMulti(f.key, o))}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {isVisibility ? VISIBILITY_LABELS[o] : o}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="vibe-details-screen"
      >
        <View style={styles.header}>
          <Pressable testID="vd-back" onPress={done} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Add more detail</Text>
        </View>
        <Text style={styles.sub}>Help the right people understand what you are open to.</Text>

        {vibe && (
          <View style={[styles.vibeBadge, { backgroundColor: (vibe.color || colors.teal) + "15" }]}>
            <Text style={[styles.vibeBadgeText, { color: vibe.color || colors.teal }]}>{vibe.label}</Text>
          </View>
        )}

        <View style={styles.encourage}>
          <Ionicons name="sparkles" size={14} color={colors.orange} />
          <Text style={styles.encourageText}>Add more detail so the right people know when to approach.</Text>
        </View>

        {fields.map(renderField)}

        {SENSITIVE_VIBES.includes(vibeKey) && (
          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
            <Text style={styles.safetyText}>Only share what you are comfortable with.</Text>
          </View>
        )}

        {renderField({ key: "visibility", label: "Who can see your Vibe Details?", type: "single", options: ["public", "after_view", "after_accept", "hidden"] })}

        <PrimaryButton testID="vd-save" title="Save Vibe Details" onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
        <SecondaryButton testID="vd-skip" title="Skip for now" onPress={done} style={{ marginTop: spacing.sm, borderWidth: 0 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, lineHeight: 21 },
  vibeBadge: { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, marginTop: spacing.md },
  vibeBadgeText: { fontSize: font.sm, fontWeight: "800" },
  encourage: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  encourageText: { color: colors.orange, fontSize: font.sm, fontWeight: "600", flex: 1 },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.base,
    color: colors.text,
    minHeight: 48,
    backgroundColor: colors.card,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  chipTextActive: { color: "#FFF", fontWeight: "700" },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  safetyText: { color: colors.text, fontSize: font.sm, flex: 1 },
});

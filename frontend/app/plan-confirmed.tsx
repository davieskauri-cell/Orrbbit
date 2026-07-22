import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import MapBackground from "@/src/components/MapBackground";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const PLAN_COPY: Record<string, { title: string; text: string }> = {
  free: {
    title: "You're on the Free plan up to 50m.",
    text: "Start exploring and meet new people nearby.",
  },
  plus: {
    title: "You're on IntroU Plus up to 100m.",
    text: "You can discover more people in bigger venues, events and city blocks.",
  },
  pro: {
    title: "You're on IntroU Pro up to 500m.",
    text: "You can use extended discovery for campuses, festivals, conferences and larger social spaces.",
  },
};

const PREVIEW_DOTS = [
  { top: 34, left: 68, color: colors.teal },
  { top: 88, left: 210, color: colors.orange },
  { top: 118, left: 96, color: colors.purple },
];

export default function PlanConfirmedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, next } = useLocalSearchParams<{ plan?: string; next?: string }>();
  const { user } = useAuth();
  const copy = PLAN_COPY[plan || user?.plan || "free"] || PLAN_COPY.free;

  const continueNext = () => {
    if (next === "setup") router.replace("/(auth)/intent");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="plan-confirmed-screen"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark" size={34} color="#FFF" />
      </View>
      <Text style={styles.title}>{"You're all set!"}</Text>
      <Text style={styles.planTitle}>{copy.title}</Text>
      <Text style={styles.planText}>{copy.text}</Text>

      {/* mini radar preview */}
      <View style={[styles.preview, shadow.card]} testID="plan-radar-preview">
        <View style={StyleSheet.absoluteFill}>
          <MapBackground size={340} />
        </View>
        <View style={[styles.ring, { width: 170, height: 170, borderRadius: 85 }]} />
        <View style={[styles.ring, styles.ringActive, { width: 110, height: 110, borderRadius: 55 }]} />
        <View style={styles.meDot}>
          <Avatar uri={user?.photo_url} name={user?.name} size={36} ringColor={colors.teal} />
        </View>
        {PREVIEW_DOTS.map((d, i) => (
          <View key={i} style={[styles.dot, { top: d.top, left: d.left, backgroundColor: d.color }]} />
        ))}
        <View style={styles.previewChip}>
          <Ionicons name="resize" size={11} color={colors.teal} />
          <Text style={styles.previewChipText}>Radius {user?.radius || 50}m</Text>
        </View>
        <View style={[styles.previewChip, { right: 10, left: undefined }]}>
          <Ionicons name="eye" size={11} color={colors.teal} />
          <Text style={styles.previewChipText}>Visible</Text>
        </View>
      </View>

      <View style={styles.safetyNote}>
        <Ionicons name="lock-closed" size={13} color={colors.teal} />
        <Text style={styles.safetyText}>Bigger radius. Same privacy. Exact locations stay hidden.</Text>
      </View>

      <PrimaryButton testID="plan-confirmed-continue" title="Continue" onPress={continueNext} style={{ marginTop: spacing.xl }} />
      <Pressable testID="edit-setup-link" onPress={() => router.push("/review-setup")} style={styles.editLink}>
        <Text style={styles.editLinkText}>Edit setup</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", textAlign: "center" },
  planTitle: { color: colors.teal, fontSize: font.lg, fontWeight: "800", textAlign: "center", marginTop: spacing.md },
  planText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", marginTop: spacing.xs, lineHeight: 21 },
  preview: {
    height: 180,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "#B9C4C7" },
  ringActive: { borderColor: colors.teal + "AA", backgroundColor: "rgba(32,178,170,0.08)" },
  meDot: { position: "absolute" },
  dot: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#FFF" },
  previewChip: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  previewChipText: { color: colors.text, fontSize: 10, fontWeight: "700" },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  safetyText: { color: colors.textSecondary, fontSize: font.sm },
  editLink: { alignItems: "center", paddingVertical: spacing.lg },
  editLinkText: { color: colors.orange, fontSize: font.base, fontWeight: "700" },
});

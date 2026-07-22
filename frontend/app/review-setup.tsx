import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function ReviewSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { vibeMap } = useApp();

  const planLabel = user?.plan === "pro" ? "IntroYu Pro" : user?.plan === "plus" ? "IntroYu Plus" : "Free";
  const vibeLabel = user?.vibe ? vibeMap[user.vibe]?.label || user.vibe : "Not set";
  const detailsDone = user?.vibe_details && Object.keys(user.vibe_details).length > 0;

  const ROWS = [
    { key: "plan", icon: "diamond-outline", label: "Plan", value: planLabel, route: "/plans", testID: "review-edit-plan" },
    { key: "radius", icon: "resize-outline", label: "Radius", value: `${user?.radius || 50}m`, route: "/privacy", testID: "review-edit-radius" },
    { key: "vibe", icon: "sparkles-outline", label: "Vibe", value: vibeLabel, route: "/vibe", testID: "review-edit-vibe" },
    { key: "details", icon: "id-card-outline", label: "Vibe details", value: detailsDone ? "Completed" : "Skipped", route: "/vibe-details", testID: "review-edit-details" },
    { key: "visibility", icon: "eye-outline", label: "Visibility", value: user?.visible ? "On" : "Off", route: "/privacy", testID: "review-edit-visibility" },
    { key: "availability", icon: "time-outline", label: "Availability", value: (user?.vibe_details?.availability as string) || "Not set", route: "/vibe-details", testID: "review-edit-availability" },
  ] as const;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
        testID="review-setup-screen"
      >
        <View style={styles.header}>
          {router.canGoBack() && (
            <Pressable testID="review-back" onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
          )}
          <Text style={styles.title}>Review your setup</Text>
        </View>
        <Text style={styles.sub}>Everything can be changed later from your profile.</Text>

        {ROWS.map((r) => (
          <View key={r.key} style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={r.icon as any} size={18} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
            <Pressable testID={r.testID} onPress={() => router.push(r.route as any)} hitSlop={8} style={styles.editBtn}>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton testID="start-using-intro" title="Start using IntroYu" onPress={() => router.replace("/(tabs)")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  rowValue: { color: colors.text, fontSize: font.lg, fontWeight: "700", marginTop: 1 },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editText: { color: colors.orange, fontSize: font.base, fontWeight: "700" },
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

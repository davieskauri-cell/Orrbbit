import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { STRINGS } from "@/src/lib/strings";
import { colors, spacing, radius, font } from "@/src/theme";

const INTENTS = [
  { key: "Meet new people", icon: "chatbubbles", color: colors.orange },
  { key: "Professional networking", icon: "briefcase", color: colors.teal },
  { key: "Dating", icon: "heart", color: colors.pink },
  { key: "Campus life", icon: "school", color: colors.purple },
  { key: "Events & meetups", icon: "calendar", color: colors.success },
  { key: "Just curious", icon: "sparkles", color: colors.warning },
] as const;

export default function IntentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (intent: string) => {
    setBusy(intent);
    try {
      const updated = await api("/users/me/state", { method: "PUT", body: { intent } });
      setUser(updated as any);
    } catch {}
    router.push("/(auth)/profile-setup");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="intent-screen"
    >
      {router.canGoBack() && (
        <Pressable testID="intent-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      )}
      <Text style={styles.title}>{STRINGS.intentQuestion}</Text>
      <Text style={styles.sub}>{STRINGS.intentSub}</Text>

      {INTENTS.map((i) => (
        <Pressable
          key={i.key}
          testID={`intent-${i.key.replace(/[^a-zA-Z]+/g, "-").toLowerCase()}`}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }, busy === i.key && { borderColor: i.color }]}
          onPress={() => choose(i.key)}
        >
          <View style={[styles.iconWrap, { backgroundColor: i.color + "18" }]}>
            <Ionicons name={i.icon as any} size={20} color={i.color} />
          </View>
          <Text style={styles.rowText}>{i.key}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      ))}

      <Pressable testID="intent-skip" onPress={() => router.push("/(auth)/profile-setup")} style={styles.skip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  backBtn: { marginBottom: spacing.md, marginLeft: -6, width: 44, height: 44, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 21 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: "700" },
  skip: { alignItems: "center", paddingVertical: spacing.lg, marginTop: spacing.sm },
  skipText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
});

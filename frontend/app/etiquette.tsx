import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const RULES = [
  "Keep it respectful",
  "Meet in public",
  "Accept no politely",
  "Do not follow anyone",
  "End the interaction if either person feels uncomfortable",
  "Report unsafe behaviour",
];

export default function EtiquetteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();

  const done = () => {
    if (next === "tabs") router.replace("/(tabs)");
    else router.back();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="etiquette-screen"
    >
      {router.canGoBack() && (
        <Pressable testID="etiquette-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      )}
      <View style={styles.iconWrap}>
        <Ionicons name="hand-left" size={34} color={colors.teal} />
      </View>
      <Text style={styles.title}>Respectful introductions</Text>
      <Text style={styles.sub}>
        A match means someone is open to saying hello, not obligated to continue.
      </Text>

      {RULES.map((r) => (
        <View key={r} style={styles.ruleRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
          <Text style={styles.ruleText}>{r}</Text>
        </View>
      ))}

      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.orange} />
        <Text style={styles.noteText}>
          IntroYu is designed for respectful real-life introductions, not tracking.
        </Text>
      </View>

      <PrimaryButton testID="etiquette-understand" title="I understand" onPress={done} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: { marginBottom: spacing.md, marginLeft: -6, width: 44, height: 44, justifyContent: "center" },
  container: { flex: 1, backgroundColor: colors.surface },
  iconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 23 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  ruleText: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1, lineHeight: 20 },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  noteText: { color: colors.orange, fontSize: font.sm, fontWeight: "600", flex: 1, lineHeight: 19 },
});

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useRadar } from "@/src/context/RadarContext";

export default function StatusPill() {
  const router = useRouter();
  const { user } = useAuth();
  const { statusMap } = useRadar();
  const st = user?.status ? statusMap[user.status] : undefined;
  const color = st?.color || colors.onSurfaceSecondary;

  return (
    <Pressable
      testID="status-pill"
      style={styles.pill}
      onPress={() => router.push("/status")}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label} numberOfLines={1}>
        {st?.label || "Set your vibe"}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.onSurfaceSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: "flex-start",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: colors.onSurface, fontSize: font.base, fontWeight: "500", maxWidth: 200 },
});

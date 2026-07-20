import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, font } from "@/src/theme";
import type { Vibe } from "@/src/context/AppContext";

export default function VibePill({ vibe, small }: { vibe?: Vibe | null; small?: boolean }) {
  const color = vibe?.color || colors.grey;
  return (
    <View style={[styles.pill, { backgroundColor: color + "18" }, small && styles.small]}>
      {vibe?.icon ? (
        <Ionicons name={vibe.icon as any} size={small ? 11 : 13} color={color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.label, { color }, small && { fontSize: 11 }]} numberOfLines={1}>
        {vibe?.label || "No vibe"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: font.sm, fontWeight: "600", maxWidth: 180 },
});

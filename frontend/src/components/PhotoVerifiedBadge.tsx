import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "@/src/theme";

/** Orange "Photo Verified" tick — live-selfie photo check, NEVER identity verification. */
export default function PhotoVerifiedBadge({
  size = 15,
  withLabel = false,
  testID = "photo-verified-badge",
}: {
  size?: number;
  withLabel?: boolean;
  testID?: string;
}) {
  if (!withLabel) {
    return <Ionicons testID={testID} name="checkmark-circle" size={size} color={colors.orange} />;
  }
  return (
    <View style={styles.pill} testID={testID}>
      <Ionicons name="checkmark-circle" size={size} color={colors.orange} />
      <Text style={styles.label}>Photo Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { color: colors.orange, fontSize: font.sm, fontWeight: "800" },
});

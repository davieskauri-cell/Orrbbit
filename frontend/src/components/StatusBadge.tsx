import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/src/theme";

type Props = {
  label: string;
  icon?: string;
  color?: string; // text/icon colour
  bg?: string; // background colour
  style?: ViewStyle;
  testID?: string;
};

/** Small status badge, e.g. "Verified by IntroYu". */
export default function StatusBadge({ label, icon, color = colors.teal, bg = colors.tealSoft, style, testID }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]} testID={testID}>
      {!!icon && <Ionicons name={icon as any} size={11} color={color} />}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: { fontSize: 10, fontWeight: "800" },
});

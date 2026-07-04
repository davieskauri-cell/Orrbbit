import React from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import { colors, spacing, font } from "@/src/theme";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function InterestChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={`interest-${label}`}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  text: { color: colors.textSecondary, fontSize: font.base, fontWeight: "500" },
  textSelected: { color: colors.teal, fontWeight: "600" },
});

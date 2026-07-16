import React from "react";
import { Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, iconSize, type } from "@/src/theme";

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
  activeColor?: string;
  style?: ViewStyle;
  testID?: string;
};

/** Standard selectable pill chip (category / filter chips). */
export default function PillChip({ label, active, onPress, icon, activeColor, style, testID }: Props) {
  const onColor = activeColor || colors.teal;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected: !!active } : undefined}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: onColor, borderColor: onColor },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {!!icon && (
        <Ionicons name={icon as any} size={iconSize.inline} color={active ? "#FFF" : colors.textSecondary} />
      )}
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: "center",
  },
  text: { ...type.chip, color: colors.textSecondary },
  textActive: { color: "#FFF" },
});

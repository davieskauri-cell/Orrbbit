import React from "react";
import { Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";

type Props = {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
};

export function PrimaryButton({ title, onPress, color, disabled, loading, testID, style }: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: color || colors.orange, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, color, testID, style }: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={[styles.secondaryText, color ? { color } : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryText: { color: "#FFFFFF", fontSize: font.lg, fontWeight: "700" },
  secondary: {
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 52,
    justifyContent: "center",
  },
  secondaryText: { color: colors.text, fontSize: font.lg, fontWeight: "600" },
});

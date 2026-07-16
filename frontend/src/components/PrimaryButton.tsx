import React from "react";
import { Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from "react-native";
import { colors, radius, type } from "@/src/theme";

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
        { backgroundColor: color || colors.orange, opacity: disabled ? 0.5 : 1 },
        pressed && styles.pressed,
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
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed, style]}
    >
      <Text style={[styles.secondaryText, color ? { color } : null]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryText: { ...type.button, color: "#FFFFFF" },
  secondary: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
  },
  secondaryText: { ...type.button, fontWeight: "600", color: colors.text },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
});

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, radius, shadow } from "@/src/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  flat?: boolean; // no shadow
  testID?: string;
};

/** Standard card: surface background, 1px border, card radius, 16px padding, card shadow. */
export default function AppCard({ children, style, flat, testID }: Props) {
  return (
    <View style={[styles.card, !flat && shadow.card, style]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});

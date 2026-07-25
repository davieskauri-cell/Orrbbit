import React from "react";
import { View, StyleSheet } from "react-native";
import Logo from "@/src/components/Logo";
import { spacing } from "@/src/theme";

/** Compact Orrbbit brand row shown at the top of every screen. */
export default function BrandHeader() {
  return (
    <View style={styles.row} testID="brand-header">
      <Logo size={30} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
});

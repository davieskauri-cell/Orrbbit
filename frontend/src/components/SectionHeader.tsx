import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { spacing, type } from "@/src/theme";

type Props = {
  title: string;
  right?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

/** Uppercase section label with optional right-side accessory (e.g. a filter chip). */
export default function SectionHeader({ title, right, style, testID }: Props) {
  return (
    <View style={[styles.row, style]} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  title: { ...type.sectionTitle },
});

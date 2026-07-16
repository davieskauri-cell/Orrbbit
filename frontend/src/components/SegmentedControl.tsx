import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, font, shadow } from "@/src/theme";

export type SegmentOption = {
  value: string;
  label: string;
  testID?: string;
  accessibilityLabel?: string;
};

type Props = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
  testID?: string;
};

/**
 * Shared two-(or more-)option segmented control.
 * Visual reference: Encounters "Crossed Paths | Mutual Vibes".
 * Used by AppModeSwitch (People | Professional) and Encounters tabs.
 */
export default function SegmentedControl({ options, value, onChange, style, testID }: Props) {
  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            testID={o.testID}
            accessibilityRole="tab"
            accessibilityLabel={o.accessibilityLabel || o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && !active && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    minHeight: 36,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: colors.surface, ...shadow.segment },
  tabText: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600", textAlign: "center" },
  tabTextActive: { color: colors.text, fontWeight: "700" },
});

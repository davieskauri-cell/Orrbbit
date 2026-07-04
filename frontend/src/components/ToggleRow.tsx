import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { colors, spacing, font } from "@/src/theme";

type Props = {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
};

export default function ToggleRow({ title, description, value, onChange, testID }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!description && <Text style={styles.desc}>{description}</Text>}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.tealSoft }}
        thumbColor={value ? colors.teal : colors.grey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  title: { color: colors.text, fontSize: font.lg, fontWeight: "600" },
  desc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 18 },
});

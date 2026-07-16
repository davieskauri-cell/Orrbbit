import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, font } from "@/src/theme";

type Props = {
  icon: string;
  title: string;
  text: string;
  actionTitle?: string;
  onAction?: () => void;
  testID?: string;
};

export default function EmptyState({ icon, title, text, actionTitle, onAction, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as any} size={34} color={colors.teal} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      {actionTitle && onAction && (
        <PrimaryButton title={actionTitle} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "700", lineHeight: 26, textAlign: "center" },
  text: {
    color: colors.textSecondary,
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
    maxWidth: 300,
  },
});

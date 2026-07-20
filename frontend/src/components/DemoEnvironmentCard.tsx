import React from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font, touchTarget } from "@/src/theme";

type Props = {
  resetting?: boolean;
  onReset: () => void;
  onSwitchPersona: () => void;
  onExit: () => void;
};

type Action = {
  key: string;
  testID: string;
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
};

/**
 * Compact Demo Environment settings card.
 * Phones: three identical full-width action rows (left-aligned, 48px tall).
 * Wide layouts (>= 700px): three equal columns — never an unbalanced partial grid.
 */
export default function DemoEnvironmentCard({ resetting, onReset, onSwitchPersona, onExit }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  const actions: Action[] = [
    { key: "reset", testID: "demo-reset-btn", icon: "refresh", label: resetting ? "Resetting…" : "Reset Demo Data", onPress: onReset },
    { key: "persona", testID: "demo-switch-persona", icon: "people", label: "Switch Persona", onPress: onSwitchPersona },
    { key: "exit", testID: "demo-exit-btn", icon: "exit-outline", label: "Exit Demo Mode", onPress: onExit, accent: true },
  ];

  return (
    <View style={styles.card} testID="demo-env-card">
      <View style={styles.headerRow}>
        <Text style={styles.badge}>DEMO ENVIRONMENT</Text>
        <Ionicons name="information-circle-outline" size={16} color={colors.teal} />
      </View>
      <Text style={styles.desc}>Seeded sample data — explore freely, nothing affects real users.</Text>
      <View style={[styles.actions, wide && styles.actionsWide]}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            testID={a.testID}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.actionRow,
              wide && styles.actionCol,
              a.accent && styles.actionAccent,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name={a.icon as any} size={16} color={a.accent ? colors.orange : colors.teal} />
            <Text style={[styles.actionText, a.accent && { color: colors.orange }]}>{a.label}</Text>
            {!wide && <Ionicons name="chevron-forward" size={14} color={a.accent ? colors.orange : colors.textTertiary} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: {
    backgroundColor: colors.teal,
    color: "#FFF",
    fontSize: font.micro,
    fontWeight: "800",
    letterSpacing: 1.2,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  desc: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  actionsWide: { flexDirection: "row" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: touchTarget + 4,
  },
  actionCol: { flex: 1, justifyContent: "center" },
  actionAccent: { borderWidth: 1, borderColor: colors.orange + "55" },
  actionText: { flex: 1, color: colors.teal, fontSize: font.sm, fontWeight: "800" },
});

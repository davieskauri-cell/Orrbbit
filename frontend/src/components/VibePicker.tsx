import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";
import type { Vibe } from "@/src/context/AppContext";

type Props = {
  vibes: Vibe[];
  value: string | null;
  onChange: (key: string) => void;
};

export default function VibePicker({ vibes, value, onChange }: Props) {
  const mains = vibes.filter((v) => !v.hidden && !v.extra);
  const extras = vibes.filter((v) => !v.hidden && v.extra);
  // auto-expand when the user's current vibe lives under More Options
  const [showMore, setShowMore] = useState(false);
  const expanded = showMore || (!!value && extras.some((e) => e.key === value));

  const card = (v: Vibe) => {
    const active = value === v.key;
    return (
      <Pressable
        key={v.key}
        testID={`vibe-option-${v.key}`}
        onPress={() => onChange(v.key)}
        style={[styles.card, active && { borderColor: v.color, backgroundColor: v.color + "0D" }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: v.color + "1A" }]}>
          <Ionicons name={v.icon as any} size={22} color={v.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{v.label}</Text>
          <Text style={styles.desc}>{v.description}</Text>
        </View>
        <Ionicons
          name={active ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={active ? v.color : colors.border}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.list}>
      {mains.map(card)}
      {extras.length > 0 && (
        <Pressable testID="vibe-more-options" onPress={() => setShowMore(!expanded)} style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: colors.tealSoft }]}>
            <Ionicons name="apps" size={22} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>More Options</Text>
            <Text style={styles.desc}>Explore other vibes</Text>
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textSecondary} />
        </Pressable>
      )}
      {expanded && extras.map(card)}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  desc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
});

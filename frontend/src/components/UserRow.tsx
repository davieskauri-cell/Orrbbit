import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import { distLabel } from "@/src/lib/format";
import { colors, spacing, font } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

type Props = {
  user: NearbyUser;
  vibeMap: Record<string, Vibe>;
  onPress: (u: NearbyUser) => void;
};

export default function UserRow({ user, vibeMap, onPress }: Props) {
  const vibe = user.vibe ? vibeMap[user.vibe] : undefined;
  const line = user.context || user.bio;
  return (
    <Pressable
      testID={`user-row-${user.id}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => onPress(user)}
    >
      <Avatar uri={user.photo_url} name={user.name} size={58} ringColor={vibe?.color} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {user.name}, {user.age}
            </Text>
            {user.verified && (
              <Ionicons
                testID={`verified-${user.id}`}
                name="checkmark-circle"
                size={15}
                color={colors.teal}
              />
            )}
          </View>
          <Text style={styles.distance}>{distLabel(user.distance)}</Text>
        </View>
        <View style={styles.pillRow}>
          <VibePill vibe={vibe} small />
          {!!user.intent && (
            <Text style={styles.intent} numberOfLines={1}>
              {user.intent}
            </Text>
          )}
        </View>
        {!!user.availability && (
          <View style={styles.availRow}>
            <View style={[styles.availDot, user.availability === "Just browsing" && { backgroundColor: colors.grey }]} />
            <Text style={[styles.availText, user.availability === "Just browsing" && { color: colors.textTertiary }]}>
              {user.availability}
            </Text>
          </View>
        )}
        {!!line && (
          <Text style={styles.bio} numberOfLines={1}>
            {user.context ? `“${line}”` : line}
          </Text>
        )}
        {!!user.tags?.length && (
          <Text style={styles.tags} numberOfLines={1}>
            {user.tags.slice(0, 4).join(" · ")}
          </Text>
        )}
        {!!user.mutual_reason && (
          <View style={styles.reasonRow}>
            <Ionicons name="sparkles" size={11} color={colors.orange} />
            <Text style={styles.reason} numberOfLines={1}>
              {user.mutual_reason}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  distance: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  bio: { color: colors.textSecondary, fontSize: font.sm },
  pillRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  intent: { color: colors.text, fontSize: font.sm, fontWeight: "700", flex: 1 },
  tags: { color: colors.textTertiary, fontSize: 11, fontWeight: "600" },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  reason: { color: colors.orange, fontSize: 11, fontWeight: "700", flex: 1 },
  availRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  availText: { color: colors.success, fontSize: 11, fontWeight: "700" },
});

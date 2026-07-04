import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import { colors, spacing, font } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

type Props = {
  user: NearbyUser;
  vibeMap: Record<string, Vibe>;
  onPress: (u: NearbyUser) => void;
};

export default function UserRow({ user, vibeMap, onPress }: Props) {
  const vibe = user.vibe ? vibeMap[user.vibe] : undefined;
  return (
    <Pressable
      testID={`user-row-${user.id}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => onPress(user)}
    >
      <Avatar uri={user.photo_url} name={user.name} size={58} ringColor={vibe?.color} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name}>
            {user.name}, {user.age}
          </Text>
          <Text style={styles.distance}>{user.distance}m away</Text>
        </View>
        <VibePill vibe={vibe} small />
        {!!user.bio && (
          <Text style={styles.bio} numberOfLines={1}>
            {user.bio}
          </Text>
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
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  distance: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  bio: { color: colors.textSecondary, fontSize: font.sm },
});

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

type Props = {
  user: NearbyUser;
  statusMap: Record<string, StatusOption>;
  onPress: (u: NearbyUser) => void;
};

export default function PersonRow({ user, statusMap, onPress }: Props) {
  const st = user.status ? statusMap[user.status] : undefined;
  const color = st?.color || colors.onSurfaceSecondary;
  return (
    <Pressable
      testID={`person-row-${user.id}`}
      onPress={() => onPress(user)}
      style={styles.row}
    >
      <View style={styles.avatarWrap}>
        <Image source={{ uri: user.avatar_url || undefined }} style={styles.avatar} />
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {user.display_name}
        </Text>
        <Text style={[styles.status, { color }]} numberOfLines={1}>
          {st?.label || "Unknown"}
        </Text>
      </View>
      <View style={styles.right}>
        {user.is_match && (
          <Ionicons name="sparkles" size={14} color={colors.brandPrimary} style={{ marginBottom: 2 }} />
        )}
        <Text style={styles.distance}>{user.distance}m</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceTertiary,
  },
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  center: { flex: 1, marginLeft: spacing.md },
  name: { color: colors.onSurface, fontSize: font.lg, fontWeight: "500" },
  status: { fontSize: font.sm, marginTop: 2 },
  right: { alignItems: "flex-end" },
  distance: { color: colors.onSurfaceSecondary, fontSize: font.base, fontWeight: "500" },
});

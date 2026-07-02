import React from "react";
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

type Props = {
  user: NearbyUser | null;
  statusMap: Record<string, StatusOption>;
  onClose: () => void;
};

export default function PersonDetail({ user, statusMap, onClose }: Props) {
  if (!user) return null;
  const st = user.status ? statusMap[user.status] : undefined;
  const color = st?.color || colors.onSurfaceSecondary;

  return (
    <Modal visible transparent animationType="slide" testID="person-detail-modal">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Image source={{ uri: user.avatar_url || undefined }} style={styles.avatar} />
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <Text style={styles.name}>{user.display_name}</Text>
              <View style={styles.statusRow}>
                {st && <Ionicons name={st.icon as any} size={14} color={color} />}
                <Text style={[styles.statusLabel, { color }]}>{st?.label || "No status"}</Text>
              </View>
              <Text style={styles.distance}>{user.distance}m away</Text>
            </View>
          </View>

          {user.is_match && (
            <View style={styles.matchBanner}>
              <Ionicons name="sparkles" size={16} color={colors.brandPrimary} />
              <Text style={styles.matchText}>Your vibes align — a great time to connect.</Text>
            </View>
          )}

          {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          <View style={styles.reminder}>
            <Ionicons name="lock-closed" size={13} color={colors.onSurfaceSecondary} />
            <Text style={styles.reminderText}>
              ProximityRadar has no chat — connections happen face to face, in the moment.
            </Text>
          </View>

          <Pressable testID="person-detail-close" style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: "70%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceTertiary,
  },
  name: { color: colors.onSurface, fontSize: font.xxl, fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  statusLabel: { fontSize: font.base },
  distance: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4 },
  matchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  matchText: { color: colors.onBrandTertiary, fontSize: font.base, flex: 1 },
  bio: { color: colors.onSurfaceTertiary, fontSize: font.base, lineHeight: 21, marginTop: spacing.lg },
  reminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  reminderText: { color: colors.onSurfaceSecondary, fontSize: font.sm, flex: 1 },
  closeBtn: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  closeText: { color: colors.onSurface, fontSize: font.lg, fontWeight: "500" },
});

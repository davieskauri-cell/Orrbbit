import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";
import { useRadar } from "@/src/context/RadarContext";
import { useAuth } from "@/src/context/AuthContext";

export default function MatchAlert() {
  const { activeMatch, dismissMatch, statusMap } = useRadar();
  const { user } = useAuth();
  if (!activeMatch) return null;
  const st = activeMatch.status ? statusMap[activeMatch.status] : undefined;

  return (
    <Modal visible transparent animationType="fade" testID="match-alert-modal">
      <BlurView intensity={40} tint="dark" style={styles.fill}>
        <View style={styles.overlayTint} />
        <View style={styles.content}>
          <Text style={styles.kicker}>ICEBREAKER</Text>
          <View style={styles.avatars}>
            <Image
              source={{ uri: user?.avatar_url || undefined }}
              style={[styles.avatar, { marginRight: -18, zIndex: 2 }]}
            />
            <View style={styles.glowRing} />
            <Image
              source={{ uri: activeMatch.avatar_url || undefined }}
              style={[styles.avatar, { marginLeft: -18 }]}
            />
          </View>
          <Text style={styles.title}>Paths Crossed</Text>
          <Text style={styles.sub}>
            {activeMatch.display_name} is {activeMatch.distance}m away and{" "}
            <Text style={{ color: st?.color || colors.brandPrimary }}>
              {st?.label?.toLowerCase() || "nearby"}
            </Text>
            . A perfect low-pressure moment to say hi.
          </Text>

          <Pressable
            testID="match-say-hi-btn"
            style={styles.primaryBtn}
            onPress={dismissMatch}
          >
            <Ionicons name="hand-left" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.primaryText}>Say Hi in Person</Text>
          </Pressable>
          <Pressable testID="match-dismiss-btn" onPress={dismissMatch} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlayTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,17,15,0.7)" },
  content: { alignItems: "center", paddingHorizontal: spacing.xl, width: "100%" },
  kicker: {
    color: colors.brandPrimary,
    fontSize: font.sm,
    letterSpacing: 3,
    fontWeight: "500",
    marginBottom: spacing.xl,
  },
  avatars: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surfaceTertiary,
  },
  glowRing: {
    position: "absolute",
    alignSelf: "center",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },
  title: { color: colors.onSurface, fontSize: font.display, fontWeight: "500", marginBottom: spacing.sm },
  sub: {
    color: colors.onSurfaceTertiary,
    fontSize: font.base,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.xxl,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    width: "100%",
  },
  primaryText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "500" },
  secondaryBtn: { paddingVertical: spacing.lg, marginTop: spacing.xs },
  secondaryText: { color: colors.onSurfaceSecondary, fontSize: font.base },
});

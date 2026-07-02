import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, font } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

type Props = {
  coords: { lat: number; lng: number } | null;
  radius: number;
  nearby: NearbyUser[];
  statusMap: Record<string, StatusOption>;
  onSelect: (u: NearbyUser) => void;
};

// react-native-maps is native-only; show a graceful fallback on web.
export default function NativeMap(_props: Props) {
  return (
    <View style={styles.fallback} testID="map-web-fallback">
      <Ionicons name="map-outline" size={44} color={colors.onSurfaceSecondary} />
      <Text style={styles.title}>Live map is device-only</Text>
      <Text style={styles.text}>
        Open Intro on your phone to see nearby people on a live map. The list below
        shows everyone in your radius.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: spacing.lg },
  text: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});

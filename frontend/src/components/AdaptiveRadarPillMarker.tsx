import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { font } from "@/src/theme";

const H = 30; // consistent marker height

/** Estimate the rendered width of an adaptive pill marker (used for map clamping). */
export function estimatePillWidth(count: number, label?: string | null): number {
  if (!label) return 40;
  const badge = H + String(count).length * 4;
  const text = Math.min(label.length, 18) * 6.2 + 20;
  return Math.min(160, badge + text);
}

/**
 * Adaptive radar marker: [count badge] [content-width label pill].
 * Content-based width, consistent height, white border + shadow, pressed feedback.
 */
export function AdaptiveRadarPillMarker({
  count, label, color, onPress, testID,
}: { count: number; label: string; color: string; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${count} people — ${label}`}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.badgeText}>+{count}</Text>
      </View>
      <View style={[styles.pill, { backgroundColor: color }]}>
        <Text style={styles.pillText} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Compact circular cluster marker (used when there is no dominant category label). */
export function RadarClusterMarker({
  count, color, onPress, testID,
}: { count: number; color: string; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`${count} people nearby`}
      style={({ pressed }) => [styles.circle, { backgroundColor: color }, pressed && styles.pressed]}
    >
      <Text style={styles.badgeText}>+{count}</Text>
    </Pressable>
  );
}

const shadow = {
  shadowColor: "#111827",
  shadowOpacity: 0.22,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  badge: {
    minWidth: H,
    height: H,
    borderRadius: H / 2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    zIndex: 2,
    ...shadow,
  },
  badgeText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  pill: {
    marginLeft: -8,
    minHeight: H - 4,
    maxWidth: 120,
    borderRadius: (H - 4) / 2,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    paddingLeft: 12,
    paddingRight: 10,
    justifyContent: "center",
    ...shadow,
  },
  pillText: { color: "#FFF", fontSize: font.micro, lineHeight: 12, fontWeight: "800" },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
});

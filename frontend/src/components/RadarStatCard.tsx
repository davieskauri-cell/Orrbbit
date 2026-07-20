import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font } from "@/src/theme";

export type RadarStat = {
  key: string;
  label: string;
  icon: string;
  count: number;
  testID?: string;
  onPress?: () => void;
};

const MIN_CARD_WIDTH = 74;
const GAP = spacing.sm; // 8
const SCREEN_PAD = spacing.lg; // 16

export function RadarStatCard({ stat, width }: { stat: RadarStat; width?: number }) {
  return (
    <Pressable
      testID={stat.testID}
      onPress={stat.onPress}
      style={({ pressed }) => [styles.card, width ? { width } : { minWidth: MIN_CARD_WIDTH }, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={stat.icon as any} size={18} color={colors.orange} />
      <Text style={styles.count}>{stat.count}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {stat.label}
      </Text>
    </Pressable>
  );
}

/**
 * One row of equal-width, equal-height statistic cards.
 * Fits all cards in a single row when the screen allows; falls back to
 * horizontal scrolling (never shrinks below MIN_CARD_WIDTH, never clips labels).
 */
export default function RadarStatCardList({ stats, testID }: { stats: RadarStat[]; testID?: string }) {
  const { width: screenW } = useWindowDimensions();
  if (!stats.length) return null;
  const available = screenW - SCREEN_PAD * 2 - GAP * (stats.length - 1);
  const fitWidth = Math.floor(available / stats.length);
  const fits = fitWidth >= MIN_CARD_WIDTH;

  if (fits) {
    return (
      <View style={styles.rowFixed} testID={testID}>
        {stats.map((s) => (
          <RadarStatCard key={s.key} stat={s} width={fitWidth} />
        ))}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.rowScroll} testID={testID}>
      {stats.map((s) => (
        <RadarStatCard key={s.key} stat={s} width={MIN_CARD_WIDTH + 12} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowFixed: {
    flexDirection: "row",
    gap: GAP,
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: spacing.md,
    flexShrink: 0,
  },
  rowScroll: { gap: GAP, paddingHorizontal: SCREEN_PAD, paddingBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 82,
  },
  count: { color: colors.orange, fontSize: font.xl, fontWeight: "800", marginTop: 2 },
  label: { color: colors.textSecondary, fontSize: font.micro, lineHeight: 13, fontWeight: "700", textAlign: "center", marginTop: 2 },
});

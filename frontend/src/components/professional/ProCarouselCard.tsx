import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/src/components/Avatar";
import { distLabel } from "@/src/lib/format";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export const CARD_WIDTH = 210;
export const CARD_GAP = 12;

const CATEGORY_ICONS: Record<string, string> = {
  HR: "people",
  Legal: "scale",
  Accounting: "calculator",
  Finance: "cash",
  Marketing: "megaphone",
  Technology: "laptop",
  "Business Consulting": "briefcase",
  Engineering: "construct",
  Plumbing: "water",
  Electrical: "flash",
  Automotive: "car",
  Property: "home",
  Photography: "camera",
  Fitness: "barbell",
  "Health and Wellbeing": "heart",
  Trades: "hammer",
  Education: "school",
};

export function categoryIcon(category?: string): string {
  return CATEGORY_ICONS[category || ""] || "briefcase";
}

export function availabilityOf(p: any): { color: string; label: string } {
  if (p.active_now && p.availability === "Available now") return { color: colors.success, label: "Online" };
  if (!p.active_now) return { color: colors.grey, label: "Offline" };
  return { color: colors.warning, label: "Busy" };
}

/** Spacious swipeable professional card for the nearby carousel. */
export default function ProCarouselCard({
  p,
  onPress,
  onConnect,
}: {
  p: any;
  onPress: () => void;
  onConnect: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 6, tension: 120 }).start();
  const avail = availabilityOf(p);

  return (
    <Animated.View style={{ transform: [{ scale }], width: CARD_WIDTH }}>
      <Pressable
        testID={`pro-card-${p.user_id}`}
        style={[styles.card, shadow.card]}
        onPress={onPress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
      >
        <View style={styles.avatarWrap}>
          <Avatar uri={p.photo_url} name={p.name} size={64} ringColor={colors.teal} />
          <View style={[styles.statusDot, { backgroundColor: avail.color }]} />
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
          </Text>
          {p.verified_by_intro && <Ionicons name="shield-checkmark" size={14} color={colors.teal} />}
        </View>

        <View style={styles.professionRow}>
          <Ionicons name={categoryIcon(p.primary_category) as any} size={12} color={colors.textSecondary} />
          <Text style={styles.profession} numberOfLines={1}>
            {p.profession}
          </Text>
        </View>

        {p.top_rated && (
          <View style={styles.topRated}>
            <Ionicons name="star" size={9} color="#FFF" />
            <Text style={styles.topRatedText}>Top Rated</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {p.rating != null ? (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.metaStrong}>{p.rating}</Text>
              <Text style={styles.metaText}>({p.review_count})</Text>
            </View>
          ) : (
            <Text style={styles.metaText}>No reviews</Text>
          )}
          {p.distance != null && (
            <View style={styles.metaItem}>
              <Ionicons name="navigate" size={11} color={colors.textTertiary} />
              <Text style={styles.metaText}>{distLabel(p.distance)}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.availText, { color: avail.color }]}>{avail.label}{p.response_time ? ` · ${p.response_time}` : ""}</Text>

        <Pressable testID={`pro-card-connect-${p.user_id}`} style={styles.connectBtn} onPress={onConnect}>
          <Text style={styles.connectText}>Connect</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    alignItems: "center",
    gap: 6,
  },
  avatarWrap: { marginBottom: 2 },
  statusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700", flexShrink: 1 },
  professionRow: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  profession: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "500", flexShrink: 1 },
  topRated: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.purple,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  topRatedText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaStrong: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  metaText: { color: colors.textTertiary, fontSize: font.sm },
  availText: { fontSize: font.sm, fontWeight: "600" },
  connectBtn: {
    alignSelf: "stretch",
    backgroundColor: colors.teal,
    borderRadius: 999,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  connectText: { color: "#FFF", fontSize: font.base, fontWeight: "600" },
});

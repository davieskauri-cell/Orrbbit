import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/src/components/Avatar";
import { timeAgo } from "@/src/lib/format";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: colors.success },
  follow_up: { label: "Follow-up needed", color: colors.warning },
  completed: { label: "Completed", color: colors.textTertiary },
  cancelled: { label: "Cancelled", color: colors.textTertiary },
};

export default function SessionCard({ s, onPress }: { s: any; onPress: () => void }) {
  const meta = STATUS_META[s.status] || STATUS_META.active;
  const needsReview = s.status === "completed" && !s.reviewed && s.i_am === "requester";
  return (
    <Pressable testID={`session-card-${s.id}`} style={[styles.card, shadow.card]} onPress={onPress}>
      <View style={styles.headRow}>
        <Avatar uri={s.other?.photo_url} name={s.other?.name} size={46} ringColor={s.professional?.verified_by_intro ? colors.teal : undefined} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.name}>{s.other?.name}</Text>
            {s.professional?.verified_by_intro && s.i_am === "requester" && (
              <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
            )}
          </View>
          <Text style={styles.meta}>
            {[s.i_am === "requester" ? s.professional?.profession : null, s.category].filter(Boolean).join(" · ")}
          </Text>
          {s.last_message ? (
            <Text style={[styles.preview, s.unread > 0 && { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
              {s.last_message.mine ? "You: " : ""}
              {s.last_message.text}
            </Text>
          ) : (
            <Text style={styles.preview}>No messages yet — say hello</Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
          {s.unread > 0 && (
            <View style={styles.unreadDot}>
              <Text style={styles.unreadText}>{s.unread}</Text>
            </View>
          )}
          <Text style={styles.time}>{timeAgo(s.last_message?.created_at || s.created_at)}</Text>
        </View>
      </View>
      {needsReview && (
        <View style={styles.reviewHint}>
          <Ionicons name="star" size={13} color={colors.warning} />
          <Text style={styles.reviewHintText}>Rate this session</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm },
  preview: { color: colors.textTertiary, fontSize: font.sm },
  status: { fontSize: 11, fontWeight: "800" },
  time: { color: colors.textTertiary, fontSize: 10 },
  unreadDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  reviewHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewHintText: { color: colors.warning, fontSize: font.sm, fontWeight: "800" },
});

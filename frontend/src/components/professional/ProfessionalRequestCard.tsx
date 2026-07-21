import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Avatar from "@/src/components/Avatar";
import { distLabel, timeAgo } from "@/src/lib/format";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

/** Received professional connection request — accept / decline / view profile. */
export default function ProfessionalRequestCard({
  r,
  onAccept,
  onDecline,
  onViewProfile,
}: {
  r: any;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile: () => void;
}) {
  return (
    <View style={[styles.card, shadow.card]} testID={`pro-request-${r.id}`}>
      <View style={styles.headRow}>
        <Avatar uri={r.user?.photo_url} name={r.user?.name} size={46} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{r.user?.name}</Text>
          <Text style={styles.meta}>
            {[r.user?.distance != null ? distLabel(r.user.distance) : null, timeAgo(r.created_at)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={styles.catChip}>
          <Text style={styles.catText}>{r.category}</Text>
        </View>
      </View>
      {!!r.message && (
        <Text style={styles.message} numberOfLines={3}>
          “{r.message}”
        </Text>
      )}
      {r.status === "pending" ? (
        <View style={styles.actions}>
          <Pressable testID={`pro-request-accept-${r.id}`} style={[styles.btn, styles.btnPrimary]} onPress={onAccept}>
            <Text style={styles.btnPrimaryText}>Accept</Text>
          </Pressable>
          <Pressable testID={`pro-request-decline-${r.id}`} style={styles.btn} onPress={onDecline}>
            <Text style={styles.btnText}>Decline</Text>
          </Pressable>
          <Pressable testID={`pro-request-view-${r.id}`} style={styles.btn} onPress={onViewProfile}>
            <Text style={styles.btnText}>View Profile</Text>
          </Pressable>
        </View>
      ) : (
        <Text
          style={[
            styles.statusText,
            { color: r.status === "accepted" ? colors.success : colors.textTertiary },
          ]}
        >
          {r.status === "accepted" ? "Accepted — conversation unlocked" : "Declined"}
        </Text>
      )}
    </View>
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
  catChip: {
    backgroundColor: colors.tealSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  catText: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  message: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  btn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.teal, borderColor: colors.teal },
  btnPrimaryText: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  btnText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  statusText: { fontSize: font.sm, fontWeight: "700" },
});

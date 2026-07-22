import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/src/components/Avatar";
import StatusBadge from "@/src/components/StatusBadge";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { distLabel } from "@/src/lib/format";
import { colors, spacing, font } from "@/src/theme";

function availState(p: any): { color: string; label: string } {
  if (p.active_now && p.availability === "Available now") return { color: colors.success, label: "Available now" };
  if (!p.active_now) return { color: colors.grey, label: "Offline" };
  return { color: colors.warning, label: p.availability || "Available later" };
}

/** Compact, premium professional preview — opened from map markers and list cards.
 *  Chat never opens from here: Connect starts a structured request. */
export default function ProfessionalPreviewSheet({
  p,
  onClose,
  onConnect,
  onViewProfile,
}: {
  p: any;
  onClose: () => void;
  onConnect: () => void;
  onViewProfile: () => void;
}) {
  const avail = availState(p);
  const facts = [
    p.distance != null ? distLabel(p.distance) : null,
    p.response_time || null,
    p.years_experience ? `${p.years_experience} yrs experience` : null,
    p.completed_sessions ? `${p.completed_sessions} completed session${p.completed_sessions === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}} testID="pro-preview-sheet">
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Avatar uri={p.photo_url} name={p.name} size={56} ringColor={colors.teal} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.name}>{p.name}</Text>
                {p.top_rated && (
                  <View style={styles.topRated}>
                    <Ionicons name="star" size={9} color="#FFF" />
                    <Text style={styles.topRatedText}>Top Rated</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profession}>{p.profession}</Text>
              {p.verified_by_intro && <StatusBadge icon="shield-checkmark" label="IntroU Verified" />}
            </View>
          </View>

          <View style={styles.metaRow}>
            {p.rating != null ? (
              <View style={styles.metaItem} testID="preview-rating">
                <Ionicons name="star" size={13} color={colors.warning} />
                <Text style={styles.metaStrong}>{p.rating}</Text>
                <Text style={styles.metaText}>({p.review_count})</Text>
              </View>
            ) : (
              <Text style={styles.metaText}>No reviews yet</Text>
            )}
            <View style={styles.metaItem}>
              <View style={[styles.availDot, { backgroundColor: avail.color }]} />
              <Text style={styles.metaText}>{avail.label}</Text>
            </View>
          </View>

          {facts.length > 0 && <Text style={styles.facts}>{facts.join(" · ")}</Text>}

          {!!p.specialties?.length && (
            <View style={styles.specWrap}>
              {p.specialties.slice(0, 5).map((s: string) => (
                <View key={s} style={styles.specChip}>
                  <Text style={styles.specText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {!!p.about && (
            <Text style={styles.about} numberOfLines={3}>
              {p.about}
            </Text>
          )}

          <Text style={styles.lockNote}>Messaging unlocks only after they accept your request.</Text>

          <View style={styles.actions}>
            <SecondaryButton
              testID="preview-view-profile"
              title="View Full Profile"
              onPress={onViewProfile}
              style={{ flex: 1, minHeight: 48 }}
            />
            <PrimaryButton
              testID="preview-connect"
              title="Connect"
              color={colors.teal}
              onPress={onConnect}
              style={{ flex: 1, minHeight: 48 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  profession: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  topRated: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.purple,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  topRatedText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaStrong: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  metaText: { color: colors.textSecondary, fontSize: font.sm },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  facts: { color: colors.textSecondary, fontSize: font.sm },
  specWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  specChip: {
    backgroundColor: colors.tealSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  specText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  about: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  lockNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});

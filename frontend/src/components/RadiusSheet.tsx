import React from "react";
import { Modal, Pressable, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { track } from "@/src/services/analyticsService";
import { colors, spacing, radius, font } from "@/src/theme";

const ALL_RADII = [100, 250, 500, 750, 1000];
const label = (r: number) => (r >= 1000 ? "1 km" : `${r} m`);
const planFor = (r: number) => (r <= 500 ? "plus" : "pro");

// Session-scoped: once the user dismisses the radius paywall, don't re-show it this session.
let paywallDismissedThisSession = false;

/** Shared discovery-radius bottom sheet — used by People Radar and Professional Radar. */
export default function RadiusSheet({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const maxR = user?.max_radius || 250;

  const pick = async (r: number) => {
    if (r > maxR) {
      track("locked_radius_tapped");
      onClose();
      if (paywallDismissedThisSession) return;
      const needed = planFor(r);
      showAlert(
        needed === "plus" ? "Unlock 500 m with Orrbbit Plus" : "Unlock up to 1 km with Orrbbit Pro",
        "Expand your orbit to discover more people and professionals nearby.",
        [
          {
            text: "Maybe later",
            style: "cancel",
            onPress: () => {
              paywallDismissedThisSession = true;
              track("radius_paywall_dismissed");
            },
          },
          {
            text: needed === "plus" ? "Upgrade to Plus" : "Upgrade to Pro",
            onPress: () => router.push(`/plans?plan=${needed}`),
          },
        ]
      );
      return;
    }
    try {
      const updated = await api("/users/me/state", { method: "PUT", body: { radius: r } });
      setUser(updated as any);
      track("radius_changed");
    } catch {}
    onClose();
    onChanged?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]} onPress={() => {}}>
          <Text style={styles.title}>Discovery radius</Text>
          <Text style={styles.sub}>Your radius depends on your plan.</Text>
          {ALL_RADII.map((r) => {
            const locked = r > maxR;
            const selected = (user?.radius || 250) === r;
            return (
              <Pressable
                key={r}
                testID={`radius-sheet-${r}`}
                accessibilityRole="button"
                accessibilityLabel={locked ? `${label(r)} — requires Orrbbit ${planFor(r) === "plus" ? "Plus" : "Pro"}` : `${label(r)}${selected ? ", selected" : ""}`}
                style={[styles.row, selected && styles.rowActive]}
                onPress={() => pick(r)}
              >
                <Text style={[styles.rowText, locked && { color: colors.textTertiary }]}>{label(r)}</Text>
                {locked ? (
                  <View style={styles.lockTag}>
                    <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
                    <Text style={styles.lockTagText}>{planFor(r) === "plus" ? "Plus" : "Pro"}</Text>
                  </View>
                ) : selected ? (
                  <Ionicons name="checkmark" size={18} color={colors.teal} />
                ) : null}
              </Pressable>
            );
          })}
          <Text style={styles.note}>Bigger radius. Same privacy. Exact locations stay hidden.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(17,24,39,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 48,
  },
  rowActive: { backgroundColor: colors.tealSoft },
  rowText: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  lockTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  lockTagText: { color: colors.textTertiary, fontSize: 11, fontWeight: "800" },
  note: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.md },
});

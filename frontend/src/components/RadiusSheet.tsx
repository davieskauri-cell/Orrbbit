import React from "react";
import { Modal, Pressable, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, font } from "@/src/theme";

const ALL_RADII = [10, 25, 50, 100, 250, 500];

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
  const maxR = user?.max_radius || 50;

  const pick = async (r: number) => {
    if (r > maxR) {
      onClose();
      const needsPlus = r <= 100;
      showAlert(
        needsPlus ? "Unlock 100m with Orrbbit Plus" : "Unlock extended discovery with Orrbbit Pro",
        needsPlus
          ? "Free gives you up to 50m. Plus unlocks 100m for bigger venues, events and city blocks."
          : "Orrbbit Pro unlocks 250m and 500m discovery for campuses, festivals, conferences and larger social spaces.",
        [
          { text: "Maybe later", style: "cancel" },
          { text: needsPlus ? "Upgrade to Plus" : "Upgrade to Pro", onPress: () => router.push("/plans") },
        ]
      );
      return;
    }
    try {
      const updated = await api("/users/me/state", { method: "PUT", body: { radius: r } });
      setUser(updated as any);
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
            const selected = (user?.radius || 50) === r;
            return (
              <Pressable
                key={r}
                testID={`radius-sheet-${r}`}
                style={[styles.row, selected && styles.rowActive]}
                onPress={() => pick(r)}
              >
                <Text style={[styles.rowText, locked && { color: colors.textTertiary }]}>{r}m</Text>
                {locked ? (
                  <View style={styles.lockTag}>
                    <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
                    <Text style={styles.lockTagText}>{r <= 100 ? "Plus" : "Pro"}</Text>
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

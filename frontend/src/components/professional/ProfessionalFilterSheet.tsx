import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { ProFilters, defaultProFilters } from "@/src/state/proFilters";
import { colors, spacing, radius, font } from "@/src/theme";

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
  { label: "4.5+", value: 4.5 },
];

const SORT_OPTIONS: { label: string; value: ProFilters["sort"]; icon: string }[] = [
  { label: "Nearest first", value: "nearest", icon: "navigate" },
  { label: "Highest rated", value: "rating", icon: "star" },
  { label: "Fastest response time", value: "response", icon: "flash" },
];

export default function ProfessionalFilterSheet({
  visible,
  categories,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  categories: string[];
  value: ProFilters;
  onClose: () => void;
  onApply: (f: ProFilters) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ProFilters>(value);

  // reset draft whenever the sheet opens with the latest applied filters
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  const toggleCategory = (c: string) =>
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(c) ? d.categories.filter((x) => x !== c) : [...d.categories, c],
    }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={() => {}} testID="pro-filter-sheet">
          <View style={styles.handle} />
          <Text style={styles.title}>Professional Filters</Text>
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>Availability</Text>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>Available now</Text>
              <Switch
                testID="pf-available-now"
                value={draft.availableNow}
                onValueChange={(v) => setDraft({ ...draft, availableNow: v })}
                trackColor={{ true: colors.teal, false: colors.border }}
                thumbColor="#FFF"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>Verified professionals only</Text>
              <Switch
                testID="pf-verified-only"
                value={draft.verifiedOnly}
                onValueChange={(v) => setDraft({ ...draft, verifiedOnly: v })}
                trackColor={{ true: colors.teal, false: colors.border }}
                thumbColor="#FFF"
              />
            </View>

            <Text style={styles.section}>Categories</Text>
            <View style={styles.chipsWrap}>
              {categories.map((c) => {
                const active = draft.categories.includes(c);
                return (
                  <Pressable
                    key={c}
                    testID={`pf-cat-${c.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleCategory(c)}
                  >
                    {active && <Ionicons name="checkmark" size={13} color="#FFF" />}
                    <Text style={[styles.chipText, active && { color: "#FFF" }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.section}>Minimum rating</Text>
            <View style={styles.chipsWrap}>
              {RATING_OPTIONS.map((o) => {
                const active = draft.minRating === o.value;
                return (
                  <Pressable
                    key={o.label}
                    testID={`pf-rating-${o.label.replace("+", "plus").replace(".", "-")}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft({ ...draft, minRating: o.value })}
                  >
                    {o.value !== null && <Ionicons name="star" size={12} color={active ? "#FFF" : colors.warning} />}
                    <Text style={[styles.chipText, active && { color: "#FFF" }]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.section}>Sort by</Text>
            {SORT_OPTIONS.map((o) => {
              const active = draft.sort === o.value;
              return (
                <Pressable
                  key={o.value}
                  testID={`pf-sort-${o.value}`}
                  style={[styles.sortRow, active && { backgroundColor: colors.tealSoft }]}
                  onPress={() => setDraft({ ...draft, sort: o.value })}
                >
                  <Ionicons name={o.icon as any} size={16} color={active ? colors.teal : colors.textTertiary} />
                  <Text style={[styles.rowLabel, { flex: 1 }, active && { color: colors.teal, fontWeight: "800" }]}>{o.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.teal} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <SecondaryButton
              testID="pf-clear"
              title="Clear All"
              onPress={() => setDraft({ ...defaultProFilters })}
              style={{ flex: 1, minHeight: 48 }}
            />
            <PrimaryButton
              testID="pf-apply"
              title="Apply Filters"
              color={colors.teal}
              onPress={() => onApply(draft)}
              style={{ flex: 1.4, minHeight: 48 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginBottom: spacing.sm },
  section: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  rowLabel: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  footer: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
});

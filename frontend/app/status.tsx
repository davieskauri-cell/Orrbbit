import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRadar } from "@/src/context/RadarContext";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font } from "@/src/theme";

const CUSTOM_COLORS = ["#10B981", "#E11D48", "#0D9488", "#F59E0B", "#8A9992"];

export default function StatusModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { statuses, setStatus, reloadStatuses } = useRadar();
  const [selected, setSelected] = useState<string | null>(user?.status || null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(CUSTOM_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const pick = (key: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelected(key);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    await setStatus(selected);
    setSaving(false);
    router.back();
  };

  const createStatus = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const created = await api<{ key: string }>("/statuses", {
        method: "POST",
        body: {
          label: newLabel.trim(),
          description: "Custom vibe",
          color: newColor,
          icon: "sparkles",
        },
        token,
      });
      await reloadStatuses();
      setSelected(created.key);
      setNewLabel("");
      setAdding(false);
    } catch {}
    setCreating(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>What's your vibe?</Text>
        <Pressable testID="status-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <Text style={styles.sub}>This shows only to people within your radius, in person.</Text>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {statuses.map((s) => {
          const active = selected === s.key;
          return (
            <Pressable
              key={s.key}
              testID={`status-option-${s.key}`}
              onPress={() => pick(s.key)}
              style={[
                styles.optionCard,
                active && { borderColor: colors.borderStrong, backgroundColor: colors.brandTertiary },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{s.label}</Text>
                <Text style={styles.optionDesc}>{s.description}</Text>
              </View>
              <Ionicons
                name={active ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={active ? colors.brandPrimary : colors.onSurfaceSecondary}
              />
            </Pressable>
          );
        })}

        {/* Add custom */}
        {adding ? (
          <View style={styles.addBox}>
            <TextInput
              testID="custom-status-label"
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Name your vibe"
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.addInput}
            />
            <View style={styles.colorRow}>
              {CUSTOM_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setNewColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    newColor === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.addActions}>
              <Pressable onPress={() => setAdding(false)} style={styles.addCancel}>
                <Text style={styles.addCancelText}>Cancel</Text>
              </Pressable>
              <Pressable testID="custom-status-create" onPress={createStatus} style={styles.addCreate}>
                {creating ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.addCreateText}>Add vibe</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable testID="add-custom-status" onPress={() => setAdding(true)} style={styles.addBtn}>
            <Ionicons name="add" size={20} color={colors.brandPrimary} />
            <Text style={styles.addBtnText}>Add a custom vibe</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable
          testID="status-save"
          style={[styles.saveBtn, !selected && { opacity: 0.5 }]}
          onPress={save}
          disabled={!selected || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.saveText}>Broadcast this vibe</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.onSurface, fontSize: font.xxl, fontWeight: "500" },
  sub: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.xs },
  list: { paddingTop: spacing.xl, paddingBottom: spacing.xl },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "500" },
  optionDesc: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 17 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },
  addBtnText: { color: colors.brandPrimary, fontSize: font.base, fontWeight: "500" },
  addBox: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  addInput: {
    color: colors.onSurface,
    fontSize: font.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  colorRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: colors.onSurface },
  addActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  addCancel: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  addCancelText: { color: colors.onSurfaceSecondary, fontSize: font.base },
  addCreate: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  addCreateText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "500" },
  footer: { paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.divider },
  saveBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  saveText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "500" },
});

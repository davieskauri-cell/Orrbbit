import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { updateVibe } from "@/src/services/userService";
import VibePicker from "@/src/components/VibePicker";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, font } from "@/src/theme";

export default function ChangeVibeModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const { vibes, refresh } = useApp();
  const [selected, setSelected] = useState<string | null>(user?.vibe || null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selected) return;
    const changed = selected !== user?.vibe;
    setBusy(true);
    try {
      const updated = await updateVibe(selected);
      setUser(updated as any);
      await refresh();
      if (changed) {
        showAlert("You changed your vibe", "Do you want to update your vibe details?", [
          { text: "Keep for now", style: "cancel", onPress: () => router.back() },
          { text: "Update details", onPress: () => router.replace("/vibe-details") },
        ]);
      } else {
        router.back();
      }
    } catch {}
    setBusy(false);
  };

  return (
    <View style={[styles.container, { paddingTop: spacing.xl }]}>
      <View style={styles.header}>
        <Text style={styles.title}>What are you open to?</Text>
        <Pressable testID="vibe-close" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.sub}>Choose your vibe. You can change this anytime.</Text>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <VibePicker vibes={vibes} value={selected} onChange={setSelected} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="save-vibe-btn"
          title="Set My Vibe"
          onPress={save}
          disabled={!selected}
          loading={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs },
  footer: { paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
});

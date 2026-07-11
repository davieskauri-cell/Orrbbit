import React, { useState } from "react";
import { Text, StyleSheet, ScrollView, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { updateVibe } from "@/src/services/userService";
import { trackVibeSelected } from "@/src/services/analyticsService";
import VibePicker from "@/src/components/VibePicker";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, font } from "@/src/theme";

export default function ChooseVibe() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const { vibes, requestLocation } = useApp();
  const [selected, setSelected] = useState<string | null>(user?.vibe || null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateVibe(selected);
      setUser(updated as any);
      trackVibeSelected();
      // contextual moment to ask for location — the radar needs it next
      requestLocation();
      router.push("/vibe-details?next=tabs");
    } catch {}
    setBusy(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {router.canGoBack() && (
        <Pressable testID="choose-vibe-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      )}
      <Text style={styles.title}>What are you open to?</Text>
      <Text style={styles.sub}>Choose your vibe. You can change this anytime.</Text>
      <ScrollView
        contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <VibePicker vibes={vibes} value={selected} onChange={setSelected} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          testID="set-vibe-btn"
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
  backBtn: { marginBottom: spacing.sm, marginLeft: -6, width: 44, height: 44, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.xs },
  footer: { paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.border },
});

import React from "react";
import { ScrollView, Pressable, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, font } from "@/src/theme";

const MODES: { key: string; icon: string; route?: string }[] = [
  { key: "Social", icon: "chatbubbles" },
  { key: "Networking", icon: "briefcase", route: "/networking" },
  { key: "Campus", icon: "school", route: "/campus" },
  { key: "Events", icon: "calendar", route: "/event-mode" },
  { key: "Communities", icon: "people", route: "/communities" },
  { key: "Dating", icon: "heart" },
  { key: "Fitness", icon: "barbell" },
];

export default function ModeSelector() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const active = user?.mode || "Social";

  const select = async (m: (typeof MODES)[number]) => {
    if (m.key !== active) {
      try {
        const updated = await api("/users/me/state", { method: "PUT", body: { mode: m.key } });
        setUser(updated as any);
      } catch {}
    }
    if (m.route) router.push(m.route as any);
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        testID="mode-selector"
      >
        {MODES.map((m) => {
          const isActive = m.key === active;
          return (
            <Pressable
              key={m.key}
              testID={`mode-${m.key.toLowerCase()}`}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => select(m)}
            >
              <Ionicons name={m.icon as any} size={14} color={isActive ? "#FFF" : colors.textSecondary} />
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{m.key}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 36,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  chipTextActive: { color: "#FFF" },
});

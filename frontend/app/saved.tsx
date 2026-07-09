import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useApp } from "@/src/context/AppContext";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import EmptyState from "@/src/components/EmptyState";
import { colors, spacing, font } from "@/src/theme";

type SavedProfile = {
  id: string;
  name: string;
  age: number;
  photo_url: string | null;
  vibe: string | null;
  intent: string | null;
  verified: boolean;
  distance_at_save: number | null;
  saved_at: string;
};

function savedAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vibeMap } = useApp();
  const [saved, setSaved] = useState<SavedProfile[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      api("/saved").then(setSaved).catch(() => {});
    }, [])
  );

  const remove = async (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    api(`/saved/${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]} testID="saved-screen">
      <View style={styles.header}>
        <Pressable testID="saved-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Saved</Text>
      </View>
      <Text style={styles.sub}>
        Profiles you saved for later. Saved profiles don’t track live location — only the
        distance when you saved them.
      </Text>

      <FlatList
        data={saved}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingBottom: spacing.xxl, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => {
          const vibe = item.vibe ? vibeMap[item.vibe] : undefined;
          return (
            <Pressable
              testID={`saved-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/person/${item.id}`)}
            >
              <Avatar uri={item.photo_url} name={item.name} size={54} ringColor={vibe?.color} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={styles.name}>{item.name}, {item.age}</Text>
                  {item.verified && <Ionicons name="checkmark-circle" size={15} color={colors.teal} />}
                </View>
                <VibePill vibe={vibe} small />
                {!!item.intent && <Text style={styles.intent}>{item.intent}</Text>}
                <Text style={styles.meta}>
                  {item.distance_at_save != null ? `About ${item.distance_at_save}m away when saved · ` : ""}
                  Saved {savedAgo(item.saved_at)}
                </Text>
              </View>
              <Pressable testID={`saved-remove-${item.id}`} onPress={() => remove(item.id)} hitSlop={10} style={styles.removeBtn}>
                <Ionicons name="bookmark" size={20} color={colors.orange} />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            testID="saved-empty"
            icon="bookmark-outline"
            title="Nothing saved yet"
            text="When you're not ready to connect, tap Save for later on a profile and come back to it here."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  intent: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  meta: { color: colors.textTertiary, fontSize: 11 },
  removeBtn: { padding: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border },
});

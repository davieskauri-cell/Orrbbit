import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/lib/api";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import EmptyState from "@/src/components/EmptyState";
import SegmentedControl from "@/src/components/SegmentedControl";
import SessionsScreen from "@/src/components/professional/SessionsScreen";
import { colors, spacing, font } from "@/src/theme";

type Encounter = {
  id: string;
  name: string;
  age: number;
  photo_url: string | null;
  vibe: string;
  distance: number;
  minutes_ago: number;
  compatible: boolean;
};

function timeLabel(mins: number) {
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

export default function EncountersTab() {
  const { appMode } = useApp();
  if (appMode === "professional") return <SessionsScreen />;
  return <PeopleEncountersScreen />;
}

function PeopleEncountersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vibeMap } = useApp();
  const [tab, setTab] = useState<"crossed" | "mutual">("crossed");
  const [items, setItems] = useState<Encounter[]>([]);

  useFocusEffect(
    useCallback(() => {
      api<Encounter[]>("/encounters").then(setItems).catch(() => {});
    }, [])
  );

  const data = tab === "mutual" ? items.filter((e) => e.compatible) : items;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>Encounters</Text>
      <SegmentedControl
        options={[
          { value: "crossed", label: "Crossed Paths", testID: "encounters-tab-crossed" },
          { value: "mutual", label: "Mutual Vibes", testID: "encounters-tab-mutual" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "crossed" | "mutual")}
      />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => {
          const vibe = vibeMap[item.vibe];
          return (
            <Pressable
              testID={`encounter-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/person/${item.id}`)}
            >
              <Avatar uri={item.photo_url} name={item.name} size={52} ringColor={vibe?.color} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>
                  {item.name}, {item.age}
                </Text>
                <View style={styles.metaRow}>
                  <VibePill vibe={vibe} small />
                  <Text style={styles.meta}>{item.distance}m</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.time}>{timeLabel(item.minutes_ago)}</Text>
                <Ionicons
                  name={item.compatible ? "sparkles" : "footsteps"}
                  size={16}
                  color={item.compatible ? colors.orange : colors.textTertiary}
                />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            testID="encounters-empty"
            icon="footsteps"
            title="No encounters yet."
            text="Keep Orrbbit open to discover who's nearby."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", paddingHorizontal: spacing.xl },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  meta: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  time: { color: colors.textTertiary, fontSize: font.sm },
});

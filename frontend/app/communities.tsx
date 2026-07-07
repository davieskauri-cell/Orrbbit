import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font } from "@/src/theme";

export default function CommunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [communities, setCommunities] = useState<any[]>([]);
  const [joined, setJoined] = useState<string[]>([]);

  useEffect(() => {
    api("/communities").then(setCommunities).catch(() => {});
  }, []);

  const join = (name: string) => {
    setJoined((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    if (!joined.includes(name)) Alert.alert("Joined!", `You'll see ${name} people nearby first.`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="communities-screen"
    >
      <View style={styles.header}>
        <Pressable testID="communities-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Intro Communities</Text>
      </View>
      <Text style={styles.sub}>Meet people nearby who share your interests.</Text>

      <View style={styles.grid}>
        {communities.map((c) => {
          const isJoined = joined.includes(c.name);
          return (
            <View key={c.name} style={styles.card} testID={`community-${c.name}`}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.nearby} nearby · {c.events} events</Text>
              <Pressable
                testID={`community-join-${c.name}`}
                style={[styles.joinBtn, isJoined && { backgroundColor: colors.teal }]}
                onPress={() => join(c.name)}
              >
                <Text style={[styles.joinText, isJoined && { color: "#FFF" }]}>
                  {isJoined ? "Joined" : "Join"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 3, marginBottom: spacing.md },
  joinBtn: {
    backgroundColor: colors.tealSoft,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
  },
  joinText: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
});

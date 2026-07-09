import React from "react";
import { ScrollView, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useApp, NearbyUser } from "@/src/context/AppContext";
import { colors, spacing, radius, font } from "@/src/theme";

type Card = { label: string; icon: string; test: (n: NearbyUser) => boolean };

const vd = (n: NearbyUser) => n.vibe_details || {};

const CARDS_BY_MODE: Record<string, Card[]> = {
  Networking: [
    { label: "Hiring nearby", icon: "briefcase", test: (n) => !!vd(n).recruiter_mode || !!(vd(n).hiring_roles || []).length },
    { label: "Founders nearby", icon: "rocket", test: (n) => ["Founder", "Business owner"].includes(vd(n).professional_identity) },
    { label: "Advice nearby", icon: "bulb", test: (n) => n.vibe === "need_advice" || !!(vd(n).can_help_with || vd(n).offer_categories || []).length },
    { label: "Coffee chats", icon: "cafe", test: (n) => n.vibe === "coffee_drinks" },
  ],
  Dating: [
    { label: "Same intention", icon: "heart", test: (n) => n.vibe === "relationship" },
    { label: "Long-term nearby", icon: "infinite", test: (n) => !!(vd(n).relationship_intention || "").includes("Long-term") },
    { label: "Open to chat", icon: "chatbubbles", test: (n) => n.vibe === "open_to_chat" },
  ],
  Campus: [
    { label: "Study buddy", icon: "book", test: (n) => (n.tags || []).some((t) => t.toLowerCase().includes("stud")) },
    { label: "Coffee nearby", icon: "cafe", test: (n) => n.vibe === "coffee_drinks" },
    { label: "Advice nearby", icon: "bulb", test: (n) => n.vibe === "need_advice" },
    { label: "Open to chat", icon: "chatbubbles", test: (n) => n.vibe === "open_to_chat" },
  ],
  Fitness: [
    { label: "Gym buddy", icon: "barbell", test: (n) => n.vibe === "gym_buddy" },
    { label: "Walking", icon: "walk", test: (n) => (vd(n).training_type || []).includes("Walking") },
    { label: "Running", icon: "speedometer", test: (n) => (vd(n).training_type || []).includes("Running") },
    { label: "Training now", icon: "flash", test: (n) => n.vibe === "gym_buddy" && n.availability === "Available now" },
  ],
};

export default function ModeCards() {
  const router = useRouter();
  const { user } = useAuth();
  const { nearby } = useApp();
  const cards = CARDS_BY_MODE[user?.mode || ""];
  if (!cards || nearby.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="mode-cards"
    >
      {cards.map((c) => {
        const count = nearby.filter(c.test).length;
        return (
          <Pressable
            key={c.label}
            testID={`mode-card-${c.label.replace(/ /g, "-")}`}
            style={styles.card}
            onPress={() => router.push("/(tabs)/nearby")}
          >
            <Ionicons name={c.icon as any} size={16} color={colors.orange} />
            <Text style={styles.count}>{count}</Text>
            <Text style={styles.label}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    minWidth: 92,
  },
  count: { color: colors.orange, fontSize: font.lg, fontWeight: "800", marginTop: 2 },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", textAlign: "center" },
});

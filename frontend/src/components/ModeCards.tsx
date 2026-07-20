import React from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useApp, NearbyUser } from "@/src/context/AppContext";
import RadarStatCardList from "@/src/components/RadarStatCard";

type Card = { label: string; icon: string; test: (n: NearbyUser) => boolean };

const vd = (n: NearbyUser) => n.vibe_details || {};

const CARDS_BY_MODE: Record<string, Card[]> = {
  Networking: [
    { label: "Jobs nearby", icon: "briefcase", test: (n) => !!vd(n).recruiter_mode || !!(vd(n).hiring_roles || []).length },
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
    <RadarStatCardList
      testID="mode-cards"
      stats={cards.map((c) => ({
        key: c.label,
        label: c.label,
        icon: c.icon,
        count: nearby.filter(c.test).length,
        testID: `mode-card-${c.label.replace(/ /g, "-")}`,
        onPress: () => router.push("/(tabs)/nearby"),
      }))}
    />
  );
}

import React from "react";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import HorizontalCategoryChipList from "@/src/components/HorizontalCategoryChipList";

const MODES: { key: string; icon: string; route?: string }[] = [
  { key: "Social", icon: "chatbubbles" },
  { key: "Networking", icon: "briefcase", route: "/networking" },
  { key: "Campus", icon: "school", route: "/campus" },
  { key: "Events", icon: "calendar", route: "/event-mode" },
  { key: "Fitness", icon: "barbell" },
];

export default function ModeSelector() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const active = user?.mode || "Social";

  const select = async (key: string) => {
    const m = MODES.find((x) => x.key === key);
    if (!m) return;
    if (m.key !== active) {
      try {
        const updated = await api("/users/me/state", { method: "PUT", body: { mode: m.key } });
        setUser(updated as any);
      } catch {}
    }
    if (m.route) router.push(m.route as any);
  };

  return (
    <HorizontalCategoryChipList
      items={MODES}
      activeKey={active}
      onSelect={select}
      testID="mode-selector"
      chipTestID={(item) => `mode-${item.key.toLowerCase()}`}
    />
  );
}

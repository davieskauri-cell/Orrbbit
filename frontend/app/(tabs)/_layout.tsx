import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import React, { useEffect, useState } from "react";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/lib/api";
import { colors, spacing } from "@/src/theme";

export default function TabsLayout() {
  const { appMode } = useApp();
  const pro = appMode === "professional";
  const [badges, setBadges] = useState({ requests: 0, sessions: 0 });

  // unread badges for professional Requests & Sessions
  useEffect(() => {
    if (!pro) {
      setBadges({ requests: 0, sessions: 0 });
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const [r, s] = await Promise.all([api<any>("/professional/connect/requests"), api<any>("/professional/sessions")]);
        if (!cancelled) setBadges({ requests: r.pending_received || 0, sessions: s.unread_total || 0 });
      } catch {}
    };
    poll();
    const t = setInterval(poll, 45000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pro]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textTertiary,
        sceneStyle: { backgroundColor: colors.surface },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 66,
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Radar",
          tabBarIcon: ({ color, size }) => <Ionicons name="radio" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nearby"
        options={{
          title: "Nearby",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pings"
        options={{
          title: pro ? "Requests" : "Pings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={pro ? "file-tray-full" : "notifications"} size={size} color={color} />
          ),
          tabBarBadge: pro && badges.requests ? badges.requests : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.orange, color: "#FFF", fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="encounters"
        options={{
          title: pro ? "Sessions" : "Encounters",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={pro ? "briefcase" : "footsteps"} size={size} color={color} />
          ),
          tabBarBadge: pro && badges.sessions ? badges.sessions : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.orange, color: "#FFF", fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

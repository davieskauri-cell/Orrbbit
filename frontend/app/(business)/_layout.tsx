import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { getMyBusiness } from "@/src/services/businessService";
import { colors } from "@/src/theme";

/** Business accounts operate from here — they never use the People Radar tabs. */
export default function BusinessTabs() {
  const { token, user, loading } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.account_type === "business") {
      getMyBusiness().then((r) => setHasProfile(!!r.business)).catch(() => setHasProfile(true));
    }
  }, [user?.account_type]);

  if (!loading) {
    if (!token) return <Redirect href="/(auth)/onboarding" />;
    if (user && user.account_type !== "business") return <Redirect href="/(tabs)" />;
    if (user && !user.email_verified && !user.is_demo) return <Redirect href="/(auth)/verify-email" />;
  }
  if (hasProfile === null) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={colors.cobalt} /></View>;
  }
  if (hasProfile === false) return <Redirect href="/(auth)/business-setup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cobalt,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="events" options={{ title: "Events", tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
    </Tabs>
  );
}

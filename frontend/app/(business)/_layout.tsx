import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable, StyleSheet } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { getMyBusiness, getBusinessOverview, Business } from "@/src/services/businessService";
import { colors, spacing, font } from "@/src/theme";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import PendingLock from "@/src/business/PendingLock";

/** Business accounts operate from here — they never use the People Radar tabs.
 * FULL PLATFORM LOCK: a Business that is not Verified never sees the Business
 * tabs/navigation. Every (business) route renders through this layout, so deep
 * links, saved links, back navigation and cached routes all land on the lock
 * screen. The backend enforces the same rule on every protected endpoint. */
export default function BusinessTabs() {
  const { token, user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [vStatus, setVStatus] = useState<string | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);

  const refresh = useCallback(() => {
    if (user?.account_type !== "business") return;
    getMyBusiness().then((r) => { setHasProfile(!!r.business); setBiz(r.business); }).catch(() => setHasProfile(true));
    // fail-closed: if status can't be read, the Business platform stays locked
    getBusinessOverview().then((o) => setVStatus(o.verification_status)).catch(() => setVStatus("Status Unavailable"));
  }, [user?.account_type]);
  useEffect(() => { refresh(); }, [refresh]);

  if (!loading) {
    if (!token) return <Redirect href="/(auth)/onboarding" />;
    if (user && user.account_type !== "business") return <Redirect href="/(tabs)" />;
    if (user && !user.email_verified && !user.is_demo) return <Redirect href="/(auth)/verify-email" />;
  }
  if (hasProfile === null || (hasProfile === true && vStatus === null)) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}><ActivityIndicator color={colors.cobalt} /></View>;
  }
  if (hasProfile === false) return <Redirect href="/(auth)/business-setup" />;

  if (vStatus !== "Verified") {
    return (
      <ScrollView
        style={lk.wrap}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}
        testID="biz-full-lock"
      >
        <View style={lk.brandRow}>
          <LogoMark size={26} />
          <Wordmark height={17} />
          <View style={{ flex: 1 }} />
          <Pressable testID="biz-lock-refresh" onPress={refresh} hitSlop={8} style={lk.refreshBtn}>
            <Ionicons name="refresh" size={15} color={colors.cobalt} />
            <Text style={lk.refreshTxt}>Refresh status</Text>
          </Pressable>
        </View>
        <PendingLock biz={biz} status={vStatus as string} />
      </ScrollView>
    );
  }

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
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
    </Tabs>
  );
}

const lk = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.cobalt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minHeight: 34 },
  refreshTxt: { color: colors.cobalt, fontSize: font.sm, fontWeight: "700" },
});

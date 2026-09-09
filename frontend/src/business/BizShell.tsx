import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from "react-native";
import { useRouter, usePathname, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

const NAV = [
  { label: "Overview", path: "/business/dashboard", icon: "grid-outline" },
  { label: "Events", path: "/business/events", icon: "calendar-outline" },
  { label: "Analytics", path: "/business/analytics", icon: "bar-chart-outline" },
  { label: "Reviews", path: "/business/reviews", icon: "star-outline" },
  { label: "Notifications", path: "/business/notifications", icon: "notifications-outline" },
  { label: "Business Profile", path: "/business/profile", icon: "storefront-outline" },
  { label: "Subscription", path: "/business/subscription", icon: "card-outline" },
  { label: "Settings", path: "/business/settings", icon: "settings-outline" },
];

/** Responsive shell for the authenticated Business platform at orrbbit.com/business.
 * Desktop/laptop: fixed sidebar. Tablet/mobile web: collapsible top navigation. */
export default function BizShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token, user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const wide = width >= 980;

  if (loading) return <View style={st.center}><ActivityIndicator color={colors.cobalt} /></View>;
  if (!token) return <Redirect href="/business/login" />;
  if (user && user.account_type !== "business") return <Redirect href="/business/login" />;

  const navItems = (
    <>
      {NAV.map((n) => {
        const active = pathname === n.path;
        return (
          <Pressable key={n.path} testID={`biznav-${n.label}`} onPress={() => { setMenuOpen(false); router.push(n.path as any); }}
            style={[st.navItem, active && st.navItemOn]}>
            <Ionicons name={n.icon as any} size={17} color={active ? colors.cobalt : colors.textSecondary} />
            <Text style={[st.navTxt, active && { color: colors.cobalt, fontWeight: "800" }]}>{n.label}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={signOut} style={st.navItem}>
        <Ionicons name="log-out-outline" size={17} color="#DC2626" />
        <Text style={[st.navTxt, { color: "#DC2626" }]}>Log out</Text>
      </Pressable>
    </>
  );

  return (
    <View style={[st.wrap, { paddingTop: insets.top }]}>
      <View style={st.topBar}>
        {!wide && (
          <Pressable testID="biz-menu" onPress={() => setMenuOpen((v) => !v)} hitSlop={8}>
            <Ionicons name={menuOpen ? "close" : "menu"} size={22} color={colors.text} />
          </Pressable>
        )}
        <Text style={st.brand}>orrbbit <Text style={{ color: colors.cobalt }}>business</Text></Text>
        <View style={{ flex: 1 }} />
        <Text style={st.topEmail} numberOfLines={1}>{user?.email}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {wide && <ScrollView style={st.sidebar} contentContainerStyle={{ paddingVertical: spacing.lg }}>{navItems}</ScrollView>}
        {!wide && menuOpen && (
          <View style={st.overlayNav}><ScrollView contentContainerStyle={{ paddingVertical: spacing.lg }}>{navItems}</ScrollView></View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
          <Text style={st.pageTitle}>{title}</Text>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

export function BizCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function BizStat({ label, value, icon }: { label: string; value: any; icon: string }) {
  return (
    <View style={st.statCard}>
      <Ionicons name={icon as any} size={18} color={colors.cobalt} />
      <Text style={st.statVal}>{value ?? "—"}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F6F8FB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.xl, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  brand: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  topEmail: { color: colors.textTertiary, fontSize: font.sm, maxWidth: 220 },
  sidebar: { width: 230, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
  overlayNav: { position: "absolute", top: 0, left: 0, bottom: 0, width: 250, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, zIndex: 50 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.xl, paddingVertical: 11 },
  navItemOn: { backgroundColor: colors.cobaltSoft, borderRightWidth: 3, borderRightColor: colors.cobalt },
  navTxt: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  content: { padding: spacing.xl, maxWidth: 1080, width: "100%", alignSelf: "center" },
  pageTitle: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.xl, marginBottom: spacing.lg },
  statCard: { flexGrow: 1, minWidth: 140, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, gap: 4 },
  statVal: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  statLbl: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
});

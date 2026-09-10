import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, ActivityIndicator } from "react-native";
import { useRouter, usePathname, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { useAuth } from "@/src/context/AuthContext";
import PendingLock from "@/src/business/PendingLock";
import { getBusinessOverview, getMyBusiness, Business } from "@/src/services/businessService";

// Orrbbit Business desktop — dark navy sidebar (brand spec, same in all themes)
const NAVY = "#0F1E38";
const NAVY_LIGHT = "#1B2C4F";
const NAVY_TEXT = "#A9B7CE";

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
 * Desktop/laptop: fixed dark navy sidebar. Tablet/mobile web: collapsible navigation. */
export default function BizShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token, user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [vStatus, setVStatus] = React.useState<string | null>(null);
  const [biz, setBiz] = React.useState<Business | null>(null);
  const wide = width >= 980;

  React.useEffect(() => {
    if (!token) return;
    getBusinessOverview().then((o) => setVStatus(o.verification_status)).catch(() => {});
    getMyBusiness().then((r) => setBiz(r.business)).catch(() => {});
  }, [token, pathname]);

  // While not Verified, only status/subscription/settings/support are available.
  const LOCK_EXEMPT = ["/business/subscription", "/business/settings", "/business/notifications", "/business/verify"];
  const locked = vStatus !== null && vStatus !== "Verified" && !LOCK_EXEMPT.includes(pathname);

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
            <Ionicons name={n.icon as any} size={17} color={active ? "#FFFFFF" : NAVY_TEXT} />
            <Text style={[st.navTxt, active && { color: "#FFFFFF", fontWeight: "800" }]}>{n.label}</Text>
          </Pressable>
        );
      })}
      <View style={st.navDivider} />
      <Pressable onPress={signOut} style={st.navItem}>
        <Ionicons name="log-out-outline" size={17} color="#F87171" />
        <Text style={[st.navTxt, { color: "#F87171" }]}>Log out</Text>
      </Pressable>
    </>
  );

  const initial = (user?.display_name || user?.email || "B").charAt(0).toUpperCase();

  return (
    <View style={[st.wrap, { paddingTop: insets.top }]}>
      <View style={st.topBar}>
        {!wide && (
          <Pressable testID="biz-menu" onPress={() => setMenuOpen((v) => !v)} hitSlop={8}>
            <Ionicons name={menuOpen ? "close" : "menu"} size={22} color={colors.text} />
          </Pressable>
        )}
        <View style={st.brandRow}>
          <LogoMark size={26} />
          <Wordmark height={17} />
          <View style={st.brandPill}><Text style={st.brandPillTxt}>BUSINESS</Text></View>
        </View>
        <View style={{ flex: 1 }} />
        <View style={st.userRow}>
          <View style={st.avatar}><Text style={st.avatarTxt}>{initial}</Text></View>
          <Text style={st.topEmail} numberOfLines={1}>{user?.display_name || user?.email}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {wide && <ScrollView style={st.sidebar} contentContainerStyle={{ paddingVertical: spacing.lg }}>{navItems}</ScrollView>}
        {!wide && menuOpen && (
          <View style={st.overlayNav}><ScrollView contentContainerStyle={{ paddingVertical: spacing.lg }}>{navItems}</ScrollView></View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
          <Text style={st.pageTitle}>{title}</Text>
          {locked ? <View style={{ maxWidth: 480, alignSelf: "center", width: "100%" }}><PendingLock biz={biz} status={vStatus as string} /></View> : children}
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
      <View style={st.statIcon}><Ionicons name={icon as any} size={16} color={colors.cobalt} /></View>
      <Text style={st.statVal}>{value ?? "—"}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F6F8FB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.xl, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandPill: { backgroundColor: colors.cobaltSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  brandPillTxt: { color: colors.cobalt, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cobalt, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  topEmail: { color: colors.text, fontSize: font.sm, fontWeight: "600", maxWidth: 200 },
  sidebar: { width: 232, maxWidth: 232, flexGrow: 0, backgroundColor: NAVY },
  overlayNav: { position: "absolute", top: 0, left: 0, bottom: 0, width: 252, backgroundColor: NAVY, zIndex: 50 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 11, borderRadius: 10, minHeight: 42 },
  navItemOn: { backgroundColor: NAVY_LIGHT },
  navTxt: { color: NAVY_TEXT, fontSize: font.sm, fontWeight: "600" },
  navDivider: { height: 1, backgroundColor: NAVY_LIGHT, marginVertical: spacing.md, marginHorizontal: spacing.lg },
  content: { padding: spacing.xl, maxWidth: 1120, width: "100%", alignSelf: "center" },
  pageTitle: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginBottom: spacing.lg, letterSpacing: -0.3 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: spacing.xl, marginBottom: spacing.lg },
  statCard: { flexGrow: 1, minWidth: 150, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal: { color: colors.text, fontSize: 24, fontWeight: "800" },
  statLbl: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
});

import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import InterestChip from "@/src/components/InterestChip";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const MENU = [
  { icon: "create-outline", label: "Edit Profile", route: "/edit-profile", testID: "menu-edit-profile" },
  { icon: "sparkles-outline", label: "Change Vibe", route: "/vibe", testID: "menu-change-vibe" },
  { icon: "lock-closed-outline", label: "Privacy Settings", route: "/privacy", testID: "menu-privacy" },
  { icon: "shield-checkmark-outline", label: "Safety", route: "/safety", testID: "menu-safety" },
  { icon: "flag-outline", label: "Trial Mode", route: "/trial", testID: "menu-trial" },
  { icon: "qr-code-outline", label: "Invite People", route: "/invite", testID: "menu-invite" },
  { icon: "people-circle-outline", label: "Demo Accounts", route: "/demo-accounts", testID: "menu-demo-accounts" },
] as const;

const GLOBAL_MENU = [
  { icon: "map-outline", label: "City Launch Mode", route: "/cities", testID: "menu-cities" },
  { icon: "calendar-outline", label: "Event Mode", route: "/event-mode", testID: "menu-event-mode" },
  { icon: "school-outline", label: "Intro Campus", route: "/campus", testID: "menu-campus" },
  { icon: "briefcase-outline", label: "Intro Networking", route: "/networking", testID: "menu-networking" },
  { icon: "people-outline", label: "Communities", route: "/communities", testID: "menu-communities" },
  { icon: "megaphone-outline", label: "Ambassador Hub", route: "/ambassador", testID: "menu-ambassador" },
  { icon: "hourglass-outline", label: "Join Waitlist", route: "/waitlist", testID: "menu-waitlist" },
] as const;

const DEMO_MENU = [
  { icon: "bar-chart-outline", label: "Test Metrics", route: "/metrics", testID: "menu-metrics" },
  { icon: "document-text-outline", label: "Trial Report", route: "/trial-report", testID: "menu-trial-report" },
  { icon: "checkbox-outline", label: "Launch Checklist", route: "/launch-checklist", testID: "menu-launch-checklist" },
] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { vibeMap } = useApp();
  const vibe = user?.vibe ? vibeMap[user.vibe] : undefined;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>

      <View style={[styles.card, shadow.card]}>
        <View style={styles.profileRow}>
          <Avatar uri={user?.photo_url} name={user?.name} size={76} ringColor={vibe?.color || colors.teal} />
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.name}>
                {user?.name}
                {user?.age ? `, ${user.age}` : ""}
              </Text>
              {user?.verified && (
                <Ionicons testID="my-verified-badge" name="checkmark-circle" size={18} color={colors.teal} />
              )}
            </View>
            <VibePill vibe={vibe} small />
            {user?.is_demo && (
              <Text style={styles.demoTag}>Demo account · {user.email}</Text>
            )}
          </View>
        </View>
        {!!user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
        {!!user?.interests?.length && (
          <View style={styles.chips}>
            {user.interests.map((i) => (
              <InterestChip key={i} label={i} />
            ))}
          </View>
        )}
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Ionicons name="resize" size={15} color={colors.teal} />
            <Text style={styles.statusText}>{user?.radius || 50}m radius</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons
              name={user?.visible && !user?.ghost_mode ? "eye" : "eye-off"}
              size={15}
              color={user?.visible && !user?.ghost_mode ? colors.success : colors.grey}
            />
            <Text style={styles.statusText}>
              {user?.ghost_mode ? "Ghost mode" : user?.visible ? "Visible" : "Hidden"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.menu}>
        {MENU.map((m) => (
          <Pressable
            key={m.label}
            testID={m.testID}
            style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.card }]}
            onPress={() => router.push(m.route as any)}
          >
            <Ionicons name={m.icon as any} size={20} color={colors.teal} />
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Intro Worldwide · {user?.city || "Melbourne"}</Text>
      <View style={styles.menu}>
        {GLOBAL_MENU.map((m) => (
          <Pressable
            key={m.label}
            testID={m.testID}
            style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.card }]}
            onPress={() => router.push(m.route as any)}
          >
            <Ionicons name={m.icon as any} size={20} color={colors.orange} />
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      {user?.is_demo && (
        <>
          <Text style={styles.sectionTitle}>Trial Tools</Text>
          <View style={styles.menu}>
            {DEMO_MENU.map((m) => (
              <Pressable
                key={m.label}
                testID={m.testID}
                style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.card }]}
                onPress={() => router.push(m.route as any)}
              >
                <Ionicons name={m.icon as any} size={20} color={colors.orange} />
                <Text style={styles.menuLabel}>{m.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable
        testID="logout-btn"
        style={styles.logout}
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/onboarding");
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.pink} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  demoTag: { color: colors.textTertiary, fontSize: 11 },
  bio: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.lg, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  statusRow: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  menu: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
    minHeight: 54,
  },
  menuLabel: { flex: 1, color: colors.text, fontSize: font.lg, fontWeight: "600" },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutText: { color: colors.pink, fontSize: font.lg, fontWeight: "700" },
});

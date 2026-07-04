import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { toggleVisibility } from "@/src/services/privacyService";
import RadarView from "@/src/components/RadarView";
import VibePill from "@/src/components/VibePill";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import Logo from "@/src/components/Logo";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser } = useAuth();
  const { coords, permission, nearby, vibeMap, requestLocation, refresh } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const flipVisibility = async () => {
    const updated = await toggleVisibility(!user?.visible);
    setUser(updated as any);
  };

  const myVibe = user?.vibe ? vibeMap[user.vibe] : undefined;
  const compatible = nearby.filter((n) => n.compatible);
  const best = compatible[0];
  const bestVibe = best?.vibe ? vibeMap[best.vibe] : undefined;
  const hidden = !user?.visible || user?.ghost_mode || user?.paused;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <Logo size={26} />
        <View style={styles.headerRight}>
          <Pressable testID="visibility-toggle" onPress={flipVisibility} style={styles.iconBtn}>
            <Ionicons
              name={hidden ? "eye-off" : "eye"}
              size={20}
              color={hidden ? colors.textTertiary : colors.teal}
            />
          </Pressable>
          <Pressable testID="settings-btn" onPress={() => router.push("/privacy")} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <Pressable testID="current-vibe-pill" onPress={() => router.push("/vibe")} style={styles.vibeRow}>
        <VibePill vibe={myVibe} />
        <Text style={styles.vibeChange}>Change</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
        }
      >
        {hidden ? (
          <EmptyState
            testID="invisible-empty"
            icon="eye-off"
            title="You are invisible."
            text="Turn visibility on to see who's nearby."
            actionTitle="Turn Visibility On"
            onAction={flipVisibility}
          />
        ) : (
          <>
            <RadarView
              users={nearby}
              vibeMap={vibeMap}
              onSelect={(u) => router.push(`/person/${u.id}`)}
              meUri={user?.photo_url}
              meName={user?.name}
              radiusSetting={user?.radius || 50}
            />

            <View style={[styles.stats, shadow.card]}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{nearby.length}</Text>
                <Text style={styles.statLabel}>People nearby</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.teal }]}>{compatible.length}</Text>
                <Text style={styles.statLabel}>Open to connect</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: colors.orange }]}>{user?.radius || 50}m</Text>
                <Text style={styles.statLabel}>Radius</Text>
              </View>
            </View>

            {permission === "denied" && (
              <View style={styles.banner} testID="location-banner">
                <Ionicons name="location-outline" size={16} color={colors.warning} />
                <Text style={styles.bannerText}>
                  Demo mode: using Melbourne CBD. Enable location for real nearby people.
                </Text>
              </View>
            )}

            {user?.vibe === "busy" ? (
              <View style={styles.busyCard} testID="busy-state">
                <Ionicons name="notifications-off" size={18} color={colors.grey} />
                <Text style={styles.busyText}>
                  {"You're marked as Busy. You won't receive pings until you change your vibe."}
                </Text>
              </View>
            ) : best ? (
              <View style={[styles.bestCard, shadow.card]} testID="nearby-now-card">
                <Text style={styles.bestKicker}>NEARBY NOW</Text>
                <View style={styles.bestRow}>
                  <Avatar uri={best.photo_url} name={best.name} size={62} ringColor={bestVibe?.color} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.bestName}>
                      {best.name}, {best.age}
                    </Text>
                    <VibePill vibe={bestVibe} small />
                    <Text style={styles.bestDist}>{best.distance}m away</Text>
                  </View>
                </View>
                {!!best.bio && (
                  <Text style={styles.bestBio} numberOfLines={2}>
                    {best.bio}
                  </Text>
                )}
                <PrimaryButton
                  testID="best-view-profile"
                  title="View Profile"
                  onPress={() => router.push(`/person/${best.id}`)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : nearby.length === 0 ? (
              <EmptyState
                testID="radar-empty"
                icon="compass"
                title="No one nearby right now."
                text="Try increasing your radius up to 100m or changing your vibe."
              />
            ) : null}

            <View style={styles.actionRow}>
              <SecondaryButton
                testID="change-vibe-btn"
                title="Change Vibe"
                onPress={() => router.push("/vibe")}
                style={{ flex: 1 }}
              />
              <SecondaryButton
                testID="privacy-btn"
                title="Privacy"
                onPress={() => router.push("/privacy")}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerRight: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  vibeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  vibeChange: { color: colors.orange, fontSize: font.sm, fontWeight: "700" },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
  },
  statBox: { alignItems: "center", flex: 1 },
  statNum: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: colors.border },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: "#FFF8EB",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  busyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  busyText: { color: colors.textSecondary, fontSize: font.base, flex: 1, lineHeight: 20 },
  bestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  bestKicker: { color: colors.orange, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: spacing.md },
  bestRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bestName: { color: colors.text, fontSize: font.xl, fontWeight: "700" },
  bestDist: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  bestBio: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.md, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
});

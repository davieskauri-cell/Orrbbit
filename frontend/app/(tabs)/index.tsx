import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRadar, NearbyUser } from "@/src/context/RadarContext";
import { useAuth } from "@/src/context/AuthContext";
import RadarView from "@/src/components/RadarView";
import PersonDetail from "@/src/components/PersonDetail";
import StatusPill from "@/src/components/StatusPill";
import { LogoMark } from "@/src/components/Logo";
import { colors, spacing, radius, font } from "@/src/theme";

export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { coords, permission, nearby, statusMap, requestLocation, refresh } = useRadar();
  const [selected, setSelected] = useState<NearbyUser | null>(null);
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

  const matches = nearby.filter((n) => n.is_match).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <LogoMark size={16} />
            <Text style={styles.kicker}>INTRO</Text>
          </View>
          <Text style={styles.title}>Radar</Text>
        </View>
        <StatusPill />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
      >
        <RadarView
          users={nearby}
          maxDistance={user?.radius || 50}
          statusMap={statusMap}
          onSelect={setSelected}
        />

        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{nearby.length}</Text>
            <Text style={styles.statLabel}>Nearby</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.brandPrimary }]}>{matches}</Text>
            <Text style={styles.statLabel}>Aligned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{user?.radius || 50}m</Text>
            <Text style={styles.statLabel}>Radius</Text>
          </View>
        </View>

        {permission === "denied" && (
          <View style={styles.banner} testID="location-banner">
            <Ionicons name="location-outline" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              Using a demo location. Enable location in Settings for real nearby people.
            </Text>
          </View>
        )}

        {!user?.status && (
          <Pressable style={styles.hint} testID="radar-set-status-hint" onPress={() => router.push("/status")}>
            <Text style={styles.hintText}>
              Tap here to broadcast your vibe and start matching.
            </Text>
          </Pressable>
        )}

        {nearby.length === 0 && user?.visible && (
          <Text style={styles.empty} testID="radar-empty">
            The sweep is quiet. No one in range yet — try a wider radius.
          </Text>
        )}
      </ScrollView>

      <PersonDetail user={selected} statusMap={statusMap} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  kicker: { color: colors.brandPrimary, fontSize: font.sm, letterSpacing: 2, fontWeight: "500" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.onSurface, fontSize: font.xxl, fontWeight: "500" },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  statBox: { alignItems: "center", flex: 1 },
  statNum: { color: colors.onSurface, fontSize: font.xxl, fontWeight: "500" },
  statLabel: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.divider },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { color: colors.onSurfaceTertiary, fontSize: font.sm, flex: 1 },
  hint: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  hintText: { color: colors.onBrandTertiary, fontSize: font.base, textAlign: "center" },
  empty: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});

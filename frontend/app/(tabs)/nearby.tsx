import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRadar, NearbyUser } from "@/src/context/RadarContext";
import PersonRow from "@/src/components/PersonRow";
import PersonDetail from "@/src/components/PersonDetail";
import StatusPill from "@/src/components/StatusPill";
import { colors, spacing, font } from "@/src/theme";

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { nearby, statusMap, refresh } = useRadar();
  const [selected, setSelected] = useState<NearbyUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>IN YOUR RADIUS</Text>
          <Text style={styles.title}>Nearby</Text>
        </View>
        <StatusPill />
      </View>

      <FlatList
        data={nearby}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => (
          <PersonRow user={item} statusMap={statusMap} onPress={setSelected} />
        )}
        ListEmptyComponent={
          <View style={styles.empty} testID="nearby-empty">
            <Ionicons name="compass-outline" size={40} color={colors.onSurfaceSecondary} />
            <Text style={styles.emptyTitle}>No one in range</Text>
            <Text style={styles.emptyText}>
              The sweep found no one nearby. Try widening your radius in the You tab.
            </Text>
          </View>
        }
      />

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
  title: { color: colors.onSurface, fontSize: font.xxl, fontWeight: "500" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing.xxxl * 2 },
  emptyTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "500", marginTop: spacing.lg },
  emptyText: {
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
});

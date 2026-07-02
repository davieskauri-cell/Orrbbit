import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRadar, NearbyUser } from "@/src/context/RadarContext";
import { useAuth } from "@/src/context/AuthContext";
import NativeMap from "@/src/components/NativeMap";
import PersonRow from "@/src/components/PersonRow";
import PersonDetail from "@/src/components/PersonDetail";
import StatusPill from "@/src/components/StatusPill";
import { colors, spacing, radius, font } from "@/src/theme";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { coords, nearby, statusMap } = useRadar();
  const [selected, setSelected] = useState<NearbyUser | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <NativeMap
          coords={coords}
          radius={user?.radius || 150}
          nearby={nearby}
          statusMap={statusMap}
          onSelect={setSelected}
        />
      </View>

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <StatusPill />
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Nearby</Text>
          <Text style={styles.sheetCount}>{nearby.length} in range</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
          {nearby.length === 0 ? (
            <Text style={styles.empty}>No one in your radius right now.</Text>
          ) : (
            nearby.map((u, i) => (
              <View key={u.id}>
                <PersonRow user={u} statusMap={statusMap} onPress={setSelected} />
                {i < nearby.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <PersonDetail user={selected} statusMap={statusMap} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  mapArea: { flex: 1, backgroundColor: colors.surface },
  topBar: { position: "absolute", left: spacing.xl, right: spacing.xl },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { color: colors.onSurface, fontSize: font.xl, fontWeight: "500" },
  sheetCount: { color: colors.onSurfaceSecondary, fontSize: font.sm },
  divider: { height: 1, backgroundColor: colors.divider },
  empty: { color: colors.onSurfaceSecondary, fontSize: font.base, paddingVertical: spacing.lg },
});

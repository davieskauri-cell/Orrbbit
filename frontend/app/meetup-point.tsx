import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { useApp } from "@/src/context/AppContext";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const POINTS = [
  { label: "Cafe", icon: "cafe" },
  { label: "Lobby", icon: "business" },
  { label: "Reception area", icon: "desktop" },
  { label: "Event entrance", icon: "enter" },
  { label: "Coworking lounge", icon: "laptop" },
  { label: "Gym front desk", icon: "barbell" },
  { label: "Campus common area", icon: "school" },
  { label: "Public seating", icon: "people" },
  { label: "Nearby landmark", icon: "flag" },
  { label: "Other public place", icon: "location" },
];

type MeetupSpot = {
  id: string;
  name: string;
  category: string;
  distance: number;
  logo_url?: string | null;
  cover_url?: string | null;
};

const spotDistLabel = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

export default function MeetupPointScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { coords, requestLocation } = useApp();
  const [point, setPoint] = useState<string | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [spots, setSpots] = useState<MeetupSpot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(true);

  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSpots = useCallback(async () => {
    if (!coords) return;
    setLoadingSpots(true);
    try {
      const r: any = await api(`/business/meetup-spots?lat=${coords.lat}&lng=${coords.lng}`);
      setSpots(r.spots || []);
    } catch {
      setSpots([]);
    }
    setLoadingSpots(false);
  }, [coords]);
  useEffect(() => { loadSpots(); }, [loadSpots]);

  const chooseSpot = (spot: MeetupSpot) => {
    setSelectedSpotId(spot.id);
    setPoint(`${spot.name} (${spot.category})`);
  };

  const choosePoint = (label: string) => {
    setSelectedSpotId(null);
    setPoint(label);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="meetup-point-screen"
    >
      <View style={styles.header}>
        <Pressable testID="meetup-point-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Choose a public meetup point</Text>
      </View>
      <Text style={styles.sub}>Meet somewhere public and comfortable.</Text>

      {/* Orrbbit Verified Meetup Spots — curated, admin-approved venues only */}
      {(loadingSpots || spots.length > 0) && (
        <View style={styles.verifiedSection} testID="verified-spots-section">
          <View style={styles.verifiedHeaderRow}>
            <Text style={styles.verifiedTitle}>Meet at an Orrbbit Verified Spot</Text>
            <Pressable
              testID="verified-spots-info"
              hitSlop={10}
              onPress={() =>
                showAlert(
                  "Orrbbit Verified Meetup Spots",
                  "These are public businesses and venues that have been specifically approved by Orrbbit for safe, comfortable meetups — not every verified business qualifies."
                )
              }
            >
              <Ionicons name="information-circle-outline" size={17} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.verifiedSub}>Popular, safe and welcoming public venues near you.</Text>

          {loadingSpots ? (
            <View style={styles.spotsLoading}>
              <ActivityIndicator color={colors.teal} />
            </View>
          ) : (
            spots.map((spot) => {
              const active = selectedSpotId === spot.id;
              return (
                <Pressable
                  key={spot.id}
                  testID={`meetup-spot-${spot.id}`}
                  style={[styles.spotCard, shadow.soft, active && styles.spotCardActive]}
                  onPress={() => chooseSpot(spot)}
                >
                  <Image
                    source={{ uri: spot.cover_url || spot.logo_url || undefined }}
                    style={styles.spotImage}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.spotTopRow}>
                      <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
                      <Text style={styles.spotDistance}>{spotDistLabel(spot.distance)}</Text>
                    </View>
                    <Text style={styles.spotCategory} numberOfLines={1}>{spot.category}</Text>
                    <View style={styles.spotBadgeRow}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                      <Text style={styles.spotBadgeText}>Orrbbit Verified Meetup Spot</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={active ? "checkmark-circle" : "chevron-forward"}
                    size={active ? 22 : 18}
                    color={active ? colors.teal : colors.textTertiary}
                  />
                </Pressable>
              );
            })
          )}
        </View>
      )}

      <Text style={styles.orLabel}>Or choose a public meetup type</Text>
      <View style={styles.grid}>
        {POINTS.map((p) => {
          const active = !selectedSpotId && point === p.label;
          return (
            <Pressable
              key={p.label}
              testID={`meetup-point-${p.label.replace(/ /g, "-")}`}
              style={[styles.tile, active && styles.tileActive]}
              onPress={() => choosePoint(p.label)}
            >
              <Ionicons name={p.icon as any} size={22} color={active ? "#FFF" : colors.teal} />
              <Text style={[styles.tileText, active && { color: "#FFF" }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
        <Text style={styles.noteText}>
          Private rooms, cars, dorms and isolated areas are never used as meetup points. Exact
          addresses are never shared.
        </Text>
      </View>

      <PrimaryButton
        testID="meetup-point-continue"
        title="Continue to Temporary Location Sharing"
        disabled={!point}
        onPress={() =>
          router.replace({ pathname: "/safety-confirm", params: { userId: userId!, point: point! } })
        }
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800", flex: 1 },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  verifiedSection: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  verifiedHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  verifiedTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", flex: 1 },
  verifiedSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, marginBottom: spacing.md, lineHeight: 18 },
  spotsLoading: { paddingVertical: spacing.lg, alignItems: "center" },
  spotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  spotCardActive: { borderColor: colors.teal, borderWidth: 1.5 },
  spotImage: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.card },
  spotTopRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  spotName: { color: colors.text, fontSize: font.base, fontWeight: "800", flexShrink: 1 },
  spotDistance: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  spotCategory: { color: colors.textSecondary, fontSize: font.sm, marginTop: 1 },
  spotBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  spotBadgeText: { color: colors.success, fontSize: font.micro, fontWeight: "700" },
  orLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: 6,
    minHeight: 76,
    justifyContent: "center",
  },
  tileActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  tileText: { color: colors.text, fontSize: font.sm, fontWeight: "700", textAlign: "center" },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  noteText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 19 },
});

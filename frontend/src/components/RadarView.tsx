import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import Avatar from "@/src/components/Avatar";
import MapTiles from "@/src/components/MapTiles";
import { getApproximateDisplayLocation, DEMO_LOCATION } from "@/src/services/locationService";
import { colors } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

const { width: SCREEN_W } = Dimensions.get("window");
const MAP_W = SCREEN_W; // edge to edge
const MAP_H = 340;
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const MAX_R = MAP_H / 2 - 26;
const MAX_SCALE = 3;
const MAX_MARKERS = 24; // markers cluster beyond this so dense areas stay readable

function ringSet(r: number): number[] {
  if (r <= 25) return [10, 25];
  if (r <= 50) return [10, 25, 50];
  if (r <= 100) return [25, 50, 75, 100];
  if (r <= 250) return [50, 100, 175, 250];
  return [125, 250, 375, 500];
}

type Props = {
  users: NearbyUser[];
  vibeMap: Record<string, Vibe>;
  onSelect: (u: NearbyUser) => void;
  meUri?: string | null;
  meName?: string | null;
  radiusSetting: number;
  coords?: { lat: number; lng: number } | null;
  onFilters?: () => void;
  onCluster?: (users: NearbyUser[]) => void;
  onRadiusPress?: () => void;
};

export default function RadarView({ users, vibeMap, onSelect, meUri, meName, radiusSetting, coords, onFilters, onCluster, onRadiusPress }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // map zoom / pan (own exact position stays centred; others remain approximate at any zoom)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [spin, pulse]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(12)
    .maxPointers(1)
    .onUpdate((e) => {
      const boundX = ((scale.value - 1) * MAP_W) / 2;
      const boundY = ((scale.value - 1) * MAP_H) / 2;
      tx.value = Math.min(Math.max(savedTx.value + e.translationX, -boundX), boundX);
      ty.value = Math.min(Math.max(savedTy.value + e.translationY, -boundY), boundY);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const target = scale.value > 1.2 ? 1 : 2;
      scale.value = withTiming(target);
      savedScale.value = target;
      if (target === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const gestures = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // markers shrink as the map zooms in (inverse scale keeps them a constant screen size feel)
  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / scale.value }],
  }));

  const recentre = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  const rings = ringSet(radiusSetting);
  const MAX_DIST = rings[rings.length - 1];
  const zoom = MAX_DIST <= 50 ? 18 : MAX_DIST <= 100 ? 17 : MAX_DIST <= 250 ? 16 : 15;
  const loc = coords || DEMO_LOCATION;

  // place nearby users (fuzzed positions only), clustering into max 24 markers
  const placed = users.map((u) => {
    const approx = getApproximateDisplayLocation(u, radiusSetting);
    const r = Math.min(approx.distance / MAX_DIST, 1) * MAX_R;
    const rad = (approx.bearing * Math.PI) / 180;
    return {
      u,
      x: CX + r * Math.sin(rad) - 19,
      y: CY - r * Math.cos(rad) - 19,
      color: (u.vibe && vibeMap[u.vibe]?.color) || colors.grey,
      bearing: approx.bearing,
      dist: approx.distance,
    };
  });
  let singles = placed;
  let clusters: { key: string; x: number; y: number; users: NearbyUser[] }[] = [];
  if (placed.length > MAX_MARKERS) {
    // 8 direction sectors x 3 distance bands = at most 24 markers
    const buckets = new Map<string, typeof placed>();
    placed.forEach((p) => {
      const sector = Math.floor((((p.bearing % 360) + 360) % 360) / 45);
      const band = Math.min(2, Math.floor((p.dist / MAX_DIST) * 3));
      const key = `${sector}-${band}`;
      buckets.set(key, [...(buckets.get(key) || []), p]);
    });
    singles = [];
    clusters = [];
    buckets.forEach((group, key) => {
      if (group.length === 1) singles.push(group[0]);
      else
        clusters.push({
          key,
          x: group.reduce((s, g) => s + g.x, 0) / group.length,
          y: group.reduce((s, g) => s + g.y, 0) / group.length,
          users: group.map((g) => g.u),
        });
    });
  }

  return (
    <View style={styles.mapArea} testID="radar-map">
      <GestureDetector gesture={gestures}>
        <Reanimated.View style={[styles.radar, zoomStyle]}>
          {/* real light map centred on YOUR actual location */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <MapTiles lat={loc.lat} lng={loc.lng} width={MAP_W} height={MAP_H} zoom={zoom} />
          </View>

          {rings.map((m) => {
            const f = m / MAX_DIST;
            const active = m <= radiusSetting;
            return (
              <View
                key={m}
                pointerEvents="none"
                style={[
                  styles.ring,
                  {
                    width: MAX_R * 2 * f,
                    height: MAX_R * 2 * f,
                    borderRadius: MAX_R * f,
                    borderColor: active ? colors.teal + "77" : "#B9C4C7",
                  },
                ]}
              />
            );
          })}
          {rings.map((m) => (
            <Text key={`label-${m}`} style={[styles.ringLabel, { top: CY - (m / MAX_DIST) * MAX_R - 14 }]}>
              {m}m
            </Text>
          ))}

          {/* selected radius fill */}
          <View
            pointerEvents="none"
            style={[
              styles.radiusFill,
              {
                width: MAX_R * 2 * (radiusSetting / MAX_DIST),
                height: MAX_R * 2 * (radiusSetting / MAX_DIST),
                borderRadius: MAX_R * (radiusSetting / MAX_DIST),
              },
            ]}
          />

          {/* rotating sweep */}
          <Animated.View pointerEvents="none" style={[styles.sweep, { transform: [{ rotate }] }]}>
            <LinearGradient
              colors={["rgba(32,178,170,0.28)", "rgba(255,90,31,0.05)", "rgba(32,178,170,0)"]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sweepGrad}
            />
          </Animated.View>

          {/* center pulse + me (exact position — visible only to you) */}
          <Animated.View
            pointerEvents="none"
            style={[styles.centerPulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
          />
          <Reanimated.View style={[styles.me, markerStyle]} pointerEvents="none">
            <Avatar uri={meUri} name={meName} size={44} ringColor={colors.teal} />
            <View style={styles.mePointer} />
            <View style={styles.youLabel}>
              <Text style={styles.youLabelText}>You</Text>
            </View>
          </Reanimated.View>

          {/* nearby blips — approximate/fuzzed positions only, never exact GPS */}
          {singles.map((p) => (
            <Reanimated.View key={p.u.id} style={[styles.blip, { left: p.x, top: p.y }, markerStyle]}>
              <Pressable testID={`radar-blip-${p.u.id}`} onPress={() => onSelect(p.u)}>
                <Avatar uri={p.u.photo_url} name={p.u.name} size={38} ringColor={p.color} />
                {p.u.compatible && <View style={[styles.compatDot, { backgroundColor: p.color }]} />}
              </Pressable>
            </Reanimated.View>
          ))}

          {/* clusters — dense groups collapse into count bubbles */}
          {clusters.map((c) => {
            // dominant vibe label when most of the cluster shares one vibe
            const counts: Record<string, number> = {};
            c.users.forEach((u) => {
              if (u.vibe) counts[u.vibe] = (counts[u.vibe] || 0) + 1;
            });
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            const vibeLabel = top && top[1] / c.users.length >= 0.6 ? vibeMap[top[0]]?.label : null;
            return (
              <Reanimated.View key={`cluster-${c.key}`} style={[styles.blip, { left: c.x, top: c.y }, markerStyle]}>
                <Pressable testID={`radar-cluster-${c.key}`} style={styles.cluster} onPress={() => onCluster?.(c.users)}>
                  <Text style={styles.clusterText}>+{c.users.length}</Text>
                  {vibeLabel && (
                    <Text style={styles.clusterVibe} numberOfLines={1}>
                      {vibeLabel}
                    </Text>
                  )}
                </Pressable>
              </Reanimated.View>
            );
          })}
        </Reanimated.View>
      </GestureDetector>

      {/* re-centre */}
      <Pressable testID="radar-recentre" style={styles.recentreBtn} onPress={recentre} hitSlop={8}>
        <Ionicons name="locate" size={16} color={colors.teal} />
      </Pressable>

      {/* filters */}
      {onFilters && (
        <Pressable testID="radar-filters" style={styles.filtersBtn} onPress={onFilters} hitSlop={8}>
          <Ionicons name="options-outline" size={14} color={colors.text} />
          <Text style={styles.filtersText}>Filters</Text>
        </Pressable>
      )}

      {/* radius selector chip */}
      {onRadiusPress && (
        <Pressable testID="radar-radius-chip" style={styles.radiusChip} onPress={onRadiusPress} hitSlop={8}>
          <Ionicons name="resize" size={13} color={colors.teal} />
          <Text style={styles.radiusChipText}>Radius: {radiusSetting}m</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapArea: {
    width: MAP_W,
    height: MAP_H,
    alignSelf: "center",
    overflow: "hidden",
    backgroundColor: "#F8FAF9",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  radar: { width: MAP_W, height: MAP_H, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5 },
  ringLabel: {
    position: "absolute",
    alignSelf: "center",
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  radiusFill: { position: "absolute", backgroundColor: "rgba(32,178,170,0.08)" },
  sweep: {
    position: "absolute",
    width: MAX_R,
    height: MAX_R,
    left: CX,
    top: CY - MAX_R,
    transformOrigin: "left bottom",
  },
  sweepGrad: { flex: 1, borderTopRightRadius: MAX_R },
  centerPulse: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.teal,
  },
  me: { position: "absolute", alignItems: "center" },
  youLabel: {
    marginTop: 2,
    backgroundColor: colors.teal,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  youLabelText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  mePointer: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.teal,
  },
  blip: { position: "absolute" },
  cluster: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  clusterVibe: { color: "#FFF", fontSize: 7, fontWeight: "700", maxWidth: 38, textAlign: "center" },
  radiusChip: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  radiusChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  compatDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  recentreBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filtersText: { color: colors.text, fontSize: 12, fontWeight: "700" },
});

import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import Avatar from "@/src/components/Avatar";
import MapTiles from "@/src/components/MapTiles";
import { getApproximateDisplayLocation, DEMO_LOCATION } from "@/src/services/locationService";
import { colors, anim } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAP_W = SCREEN_W; // edge to edge
const MAP_H = Math.min(Math.max(Math.round(SCREEN_H * 0.42), 320), 430); // ~42% of screen so stats stay above the fold
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const MAX_R = MAP_H / 2 - 26;
const MAX_SCALE = 3;
const MAX_MARKERS = 24; // absolute hard cap for individual avatars
const FOCUS_MARKERS = 12; // Focus Map: only the most relevant people get their own marker

const SHORT_VIBE: Record<string, string> = {
  open_to_chat: "Chat",
  coffee_drinks: "Coffee",
  need_advice: "Advice",
  networking: "Networking",
  relationship: "Dating",
  gym_buddy: "Gym",
  exploring: "Exploring",
  opportunity: "Opportunity",
};

const AMBER = "#F59E0B";

/** Cluster label for opportunity-dominant bubbles: "+6 Paid Tasks", "+4 Business", "+2 Help"… */
function opportunityClusterLabel(users: NearbyUser[]): string {
  const opp = users.filter((u) => u.vibe === "opportunity");
  const byType: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  opp.forEach((u) => {
    const t = u.vibe_details?.opportunity_type;
    const c = u.vibe_details?.category;
    if (t) byType[t] = (byType[t] || 0) + 1;
    if (c) byCat[c] = (byCat[c] || 0) + 1;
  });
  const topT = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  if (topT && topT[1] / opp.length >= 0.5) {
    const short: Record<string, string> = {
      "Paid task": "Paid Tasks",
      "Need help": "Requests",
      "Can help": "Can Help",
      "Selling something": "Selling",
      "Collaboration": "Collab",
      "Professional": "Pros",
    };
    if (short[topT[0]]) return short[topT[0]];
  }
  const topC = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  if (topC && topC[1] / opp.length >= 0.5) return topC[0];
  return "Opportunities";
}

const isStrong = (u: NearbyUser) => !!u.compatible && (u.score ?? 0) >= 6;

type ZoomSV = { scale: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number> };

/** Positions crisp overlay content at a map coordinate under the current zoom/pan.
 *  Content renders at scale 1, so avatars, borders and text never pixelate. */
function MapAnchor({
  cx,
  cy,
  w,
  h,
  z,
  style,
  children,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  z: ZoomSV;
  style?: any;
  children: React.ReactNode;
}) {
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: z.tx.value + CX + (cx - CX) * z.scale.value - w / 2 },
      { translateY: z.ty.value + CY + (cy - CY) * z.scale.value - h / 2 },
    ],
  }));
  return (
    <Reanimated.View style={[styles.anchor, { width: w, height: h }, style, a]}>
      {children}
    </Reanimated.View>
  );
}

/** Radius ring that grows geometrically with zoom while its border stays 1-1.5px crisp. */
function ZoomRing({
  m,
  maxDist,
  z,
  selected,
  active,
}: {
  m: number;
  maxDist: number;
  z: ZoomSV;
  selected: boolean;
  active: boolean;
}) {
  const a = useAnimatedStyle(() => {
    const r = (m / maxDist) * MAX_R * z.scale.value;
    return {
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      transform: [{ translateX: z.tx.value }, { translateY: z.ty.value }],
    };
  });
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          borderWidth: selected ? 1.5 : 1,
          borderColor: selected ? colors.teal + "99" : active ? colors.teal + "38" : "rgba(160,175,180,0.45)",
        },
        a,
      ]}
    />
  );
}

/** Ring distance label — crisp text that tracks its ring under zoom/pan. */
function RingLabelA({ m, maxDist, z }: { m: number; maxDist: number; z: ZoomSV }) {
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: z.tx.value },
      { translateY: z.ty.value + CY - (m / maxDist) * MAX_R * z.scale.value - 14 - CY },
    ],
  }));
  return (
    <Reanimated.View pointerEvents="none" style={[styles.ringLabelWrap, a]}>
      <Text style={styles.ringLabel}>{m}m</Text>
    </Reanimated.View>
  );
}

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
  onLearnMore?: () => void;
};

export default function RadarView({ users, vibeMap, onSelect, meUri, meName, radiusSetting, coords, onFilters, onCluster, onRadiusPress, onLearnMore }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // map zoom / pan (own exact position stays centred; others remain approximate at any zoom)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // sharper tiles: retina baseline, swap to higher-zoom tiles while zoomed in.
  // Boost updates DURING the pinch (not just on release) so detail loads immediately.
  const [tileBoost, setTileBoost] = useState(1);
  const boostSV = useSharedValue(1);
  const applyBoost = (s: number) => setTileBoost(s >= 1.5 ? 2 : 1);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: anim.pulse, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: anim.pulse, useNativeDriver: true }),
      ])
    ).start();
  }, [spin, pulse]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
      // load higher-detail tiles as soon as the zoom threshold is crossed
      const nb = scale.value >= 1.5 ? 2 : 1;
      if (nb !== boostSV.value) {
        boostSV.value = nb;
        runOnJS(applyBoost)(scale.value);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(applyBoost)(scale.value);
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
      boostSV.value = target >= 1.5 ? 2 : 1;
      runOnJS(applyBoost)(target);
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

  // crisp overlays: markers/rings are positioned mathematically instead of scaling pixels
  const z: ZoomSV = { scale, tx, ty };
  const meAnchor = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const recentre = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    boostSV.value = 1;
    applyBoost(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const zoomBy = (factor: number) => {
    const target = Math.min(Math.max(savedScale.value * factor, 1), MAX_SCALE);
    scale.value = withTiming(target);
    savedScale.value = target;
    boostSV.value = target >= 1.5 ? 2 : 1;
    applyBoost(target);
    if (target <= 1.01) {
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      savedTx.value = 0;
      savedTy.value = 0;
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  const rings = ringSet(radiusSetting);
  const MAX_DIST = rings[rings.length - 1];
  const zoom = MAX_DIST <= 50 ? 18 : MAX_DIST <= 100 ? 17 : MAX_DIST <= 250 ? 16 : 15;
  const loc = coords || DEMO_LOCATION;

  // place nearby users (fuzzed positions only) — centre coordinates in map space
  const placed = users.map((u) => {
    const approx = getApproximateDisplayLocation(u, radiusSetting);
    const r = Math.min(approx.distance / MAX_DIST, 1) * MAX_R;
    const rad = (approx.bearing * Math.PI) / 180;
    return {
      u,
      x: CX + r * Math.sin(rad),
      y: CY - r * Math.cos(rad),
      color: (u as any).pro ? colors.teal : (u.vibe && vibeMap[u.vibe]?.color) || colors.grey,
      bearing: approx.bearing,
      dist: approx.distance,
    };
  });
  // Focus Map: top 8-12 most relevant get individual markers, the rest collapse
  // into clusters (hard cap of 24 individual avatars always holds)
  const FOCUS = Math.min(FOCUS_MARKERS, MAX_MARKERS);
  let singles = placed;
  let clusters: { key: string; x: number; y: number; users: NearbyUser[] }[] = [];
  if (placed.length > FOCUS) {
    singles = placed.slice(0, FOCUS);
    const buckets = new Map<string, typeof placed>();
    placed.slice(FOCUS).forEach((p) => {
      const sector = Math.floor((((p.bearing % 360) + 360) % 360) / 45);
      const band = Math.min(2, Math.floor((p.dist / MAX_DIST) * 3));
      const key = `${sector}-${band}`;
      buckets.set(key, [...(buckets.get(key) || []), p]);
    });
    const singletons: typeof placed = [];
    buckets.forEach((group, key) => {
      if (group.length === 1) {
        singletons.push(group[0]);
        return;
      }
      clusters.push({
        key,
        x: group.reduce((s, g) => s + g.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.y, 0) / group.length,
        users: group.map((g) => g.u),
      });
    });
    // leftover singletons merge into their nearest cluster (max 24 avatars stays true)
    singletons.forEach((p) => {
      if (clusters.length === 0) {
        singles.push(p);
        return;
      }
      let best = clusters[0];
      let bestD = Infinity;
      clusters.forEach((c) => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      });
      best.users.push(p.u);
    });
  }
  // spacing pass — avatars never stack directly on top of each other
  const MIN_GAP = 40;
  for (let i = 0; i < singles.length; i++) {
    for (let j = 0; j < i; j++) {
      const dx = singles[i].x - singles[j].x;
      const dy = singles[i].y - singles[j].y;
      const d = Math.hypot(dx, dy);
      if (d < MIN_GAP) {
        const ang = d > 0.5 ? Math.atan2(dy, dx) : i * 0.9;
        singles[i] = {
          ...singles[i],
          x: Math.min(Math.max(singles[j].x + Math.cos(ang) * MIN_GAP, 26), MAP_W - 26),
          y: Math.min(Math.max(singles[j].y + Math.sin(ang) * MIN_GAP, 26), MAP_H - 26),
        };
      }
    }
  }
  // keep the centre clear — nothing may sit under the "You" marker (it would block taps)
  const clearCentre = (px: number, py: number, brg: number, min: number) => {
    const dx = px - CX;
    const dy = py - CY;
    const d = Math.hypot(dx, dy);
    if (d >= min) return { x: px, y: py };
    const ang = d > 0.5 ? Math.atan2(dy, dx) : ((brg - 90) * Math.PI) / 180;
    return { x: CX + Math.cos(ang) * min, y: CY + Math.sin(ang) * min };
  };
  singles = singles.map((p) => ({ ...p, ...clearCentre(p.x, p.y, p.bearing, 52) }));
  clusters = clusters.map((c) => ({ ...c, ...clearCentre(c.x, c.y, 0, 56) }));

  // dominant vibe per cluster (drives bubble colour, label and heat zones)
  const clusterInfo = clusters.map((c) => {
    const counts: Record<string, number> = {};
    c.users.forEach((u) => {
      if (u.vibe) counts[u.vibe] = (counts[u.vibe] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const dominant = top && top[1] / c.users.length >= 0.5 ? top[0] : null;
    return {
      ...c,
      color: (dominant && vibeMap[dominant]?.color) || colors.teal,
      label:
        dominant === "opportunity"
          ? opportunityClusterLabel(c.users)
          : dominant
          ? SHORT_VIBE[dominant] || null
          : null,
    };
  });

  return (
    <View style={styles.mapArea} testID="radar-map">
      <GestureDetector gesture={gestures}>
        <View style={styles.radar}>
          {/* WORLD LAYER — only this zooms/pans (tiles + soft visuals) */}
          <Reanimated.View style={[styles.worldLayer, zoomStyle]} pointerEvents="none">
            {/* bright bird's-eye map centred on YOUR actual location (subtle 3D tilt) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.tilt}>
                {/* BASE retina layer — always mounted so zooming never drops to a blank/blurry map */}
                <View
                  style={{
                    width: MAP_W * 2,
                    height: MAP_H * 2,
                    marginLeft: -MAP_W / 2,
                    marginTop: -MAP_H / 2,
                    transform: [{ scale: 0.5 }],
                  }}
                >
                  <MapTiles lat={loc.lat} lng={loc.lng} width={MAP_W * 2} height={MAP_H * 2} zoom={zoom + 1} />
                </View>
                {/* HIGH-DETAIL layer — sharper, higher-zoom tiles load on top while zoomed in */}
                {tileBoost >= 2 && (
                  <View
                    style={{
                      position: "absolute",
                      left: (-MAP_W * 3) / 2,
                      top: (-MAP_H * 3) / 2,
                      width: MAP_W * 4,
                      height: MAP_H * 4,
                      transform: [{ scale: 0.25 }],
                    }}
                  >
                    <MapTiles
                      lat={loc.lat}
                      lng={loc.lng}
                      width={MAP_W * 4}
                      height={MAP_H * 4}
                      zoom={zoom + 2}
                      showFallback={false}
                    />
                  </View>
                )}
              </View>
              <LinearGradient
                colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)", "rgba(255,255,255,0)", "rgba(255,255,255,0.12)"]}
                style={StyleSheet.absoluteFill}
              />
            </View>

            {/* social heat zones — soft, approximate density glow (privacy-safe) */}
            {clusterInfo
              .filter((c) => c.users.length >= 5)
              .map((c) => (
                <View
                  key={`heat-${c.key}`}
                  pointerEvents="none"
                  style={[styles.heatOuter, { left: c.x - 72, top: c.y - 72, backgroundColor: c.color + "12" }]}
                >
                  <View style={[styles.heatInner, { backgroundColor: c.color + "1A" }]} />
                </View>
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

            {/* center pulse */}
            <Animated.View
              pointerEvents="none"
              style={[styles.centerPulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
            />
          </Reanimated.View>

          {/* OVERLAY LAYER — crisp components positioned by coordinates, never scaled */}
          <View style={styles.overlayLayer}>
            {rings.map((m) => (
              <ZoomRing key={m} m={m} maxDist={MAX_DIST} z={z} selected={m === radiusSetting} active={m <= radiusSetting} />
            ))}
            {rings.map((m) => (
              <RingLabelA key={`label-${m}`} m={m} maxDist={MAX_DIST} z={z} />
            ))}

            {/* me (exact position — visible only to you) */}
            <Reanimated.View style={[styles.me, meAnchor]} pointerEvents="none">
              <Avatar uri={meUri} name={meName} size={44} ringColor={colors.teal} />
              <View style={styles.mePointer} />
              <View style={styles.youLabel}>
                <Text style={styles.youLabelText}>You</Text>
              </View>
            </Reanimated.View>

            {/* nearby blips — approximate/fuzzed positions only, never exact GPS.
                Strong matches glow, lower relevance fades. */}
            {singles.map((p) => {
              const strong = isStrong(p.u);
              const size = strong ? 42 : p.u.compatible ? 38 : 34;
              return (
                <MapAnchor
                  key={p.u.id}
                  cx={p.x}
                  cy={p.y}
                  w={size}
                  h={size}
                  z={z}
                  style={[styles.blip, !p.u.compatible && styles.blipFaded]}
                >
                  <Pressable testID={`radar-blip-${p.u.id}`} onPress={() => onSelect(p.u)}>
                    {strong && (
                      <View
                        style={[
                          styles.glow,
                          {
                            backgroundColor: p.color + "40",
                            shadowColor: p.color,
                            width: size + 14,
                            height: size + 14,
                            borderRadius: (size + 14) / 2,
                          },
                        ]}
                      />
                    )}
                    <Avatar uri={p.u.photo_url} name={p.u.name} size={size} ringColor={p.color} />
                    {p.u.compatible && !(p.u as any).pro && <View style={[styles.compatDot, { backgroundColor: p.color }]} />}
                    {(p.u as any).pro && (
                      <View style={styles.proCheckBadge}>
                        <Ionicons name="checkmark" size={8} color="#FFF" />
                      </View>
                    )}
                    {(p.u as any).pro && p.u.active_now && <View style={styles.availDot} />}
                    {p.u.vibe === "opportunity" && !(p.u as any).pro && (
                      <View style={styles.oppBadge}>
                        <Ionicons name="sparkles" size={8} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                </MapAnchor>
              );
            })}

            {/* clusters — vibe-coloured count bubbles */}
            {clusterInfo.map((c) => (
              <MapAnchor key={`cluster-${c.key}`} cx={c.x} cy={c.y} w={40} h={40} z={z} style={styles.blip}>
                <Pressable
                  testID={`radar-cluster-${c.key}`}
                  style={[styles.cluster, { backgroundColor: c.color }]}
                  onPress={() => onCluster?.(c.users)}
                >
                  <Text style={styles.clusterText}>+{c.users.length}</Text>
                  {c.label && (
                    <Text style={styles.clusterVibe} numberOfLines={1}>
                      {c.label}
                    </Text>
                  )}
                </Pressable>
              </MapAnchor>
            ))}
          </View>
        </View>
      </GestureDetector>

      {/* re-centre + zoom controls (right side) */}
      <View style={styles.rightControls}>
        <Pressable testID="radar-zoom-in" style={styles.ctrlBtn} onPress={() => zoomBy(1.5)} hitSlop={6}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
        <Pressable testID="radar-zoom-out" style={styles.ctrlBtn} onPress={() => zoomBy(1 / 1.5)} hitSlop={6}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Pressable testID="radar-recentre" style={styles.ctrlBtn} onPress={recentre} hitSlop={6}>
          <Ionicons name="locate" size={16} color={colors.teal} />
        </Pressable>
      </View>

      {/* filters */}
      {onFilters && (
        <Pressable testID="radar-filters" style={styles.filtersBtn} onPress={onFilters} hitSlop={8}>
          <Ionicons name="options-outline" size={14} color={colors.text} />
          <Text style={styles.filtersText}>Filters</Text>
        </Pressable>
      )}

      {/* radius selector chip — top-left */}
      {onRadiusPress && (
        <Pressable testID="radar-radius-chip" style={styles.radiusChip} onPress={onRadiusPress} hitSlop={8}>
          <Ionicons name="resize" size={13} color={colors.teal} />
          <Text style={styles.radiusChipText}>Radius: {radiusSetting}m</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
        </Pressable>
      )}

      {/* focus summary — curated view indicator */}
      {clusters.length > 0 && (
        <View style={styles.focusChip} testID="focus-summary">
          <Text style={styles.focusChipText}>
            {users.length}
            {users.length >= 100 ? "+" : ""} nearby · Showing your best {singles.length}
          </Text>
        </View>
      )}

      {/* privacy pill — bottom of map */}
      {onLearnMore && (
        <View style={styles.privacyPill}>
          <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
          <Text style={styles.privacyPillText} numberOfLines={1}>
            Exact locations hidden · You only see approximate nearby users
          </Text>
          <Pressable testID="privacy-learn-more" onPress={onLearnMore} hitSlop={8}>
            <Text style={styles.learnMore}>Learn more</Text>
          </Pressable>
        </View>
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
  radar: { width: MAP_W, height: MAP_H },
  worldLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  anchor: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tilt: {
    flex: 1,
    transform: [{ perspective: 500 }, { rotateX: "9deg" }, { scale: 1.22 }],
  },
  ring: { position: "absolute", borderWidth: 1.5 },
  ringLabelWrap: { position: "absolute", top: CY },
  ringLabel: {
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
  me: {
    position: "absolute",
    alignItems: "center",
    zIndex: 20,
    shadowColor: "#111827",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  youLabel: {
    marginTop: 2,
    backgroundColor: colors.teal,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
  },
  youLabelText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
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
  blip: {
    position: "absolute",
    shadowColor: "#111827",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  blipFaded: { opacity: 0.55 },
  glow: {
    position: "absolute",
    top: -7,
    left: -7,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  heatOuter: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  heatInner: { width: 92, height: 92, borderRadius: 46 },
  focusChip: {
    position: "absolute",
    top: 56,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  focusChipText: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  cluster: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  clusterText: { color: "#FFF", fontSize: 13, fontWeight: "800" },
  clusterVibe: { color: "#FFF", fontSize: 9, fontWeight: "700", maxWidth: 38, textAlign: "center" },
  radiusChip: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
  proCheckBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  availDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  oppBadge: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: AMBER,
    borderWidth: 1.5,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  rightControls: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -66,
    gap: 12,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  privacyPill: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    maxWidth: MAP_W - 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#111827",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  privacyPillText: { color: colors.textSecondary, fontSize: 10, flexShrink: 1 },
  learnMore: { color: colors.teal, fontSize: 10, fontWeight: "800" },
  filtersBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    shadowColor: "#111827",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filtersText: { color: colors.text, fontSize: 12, fontWeight: "700" },
});

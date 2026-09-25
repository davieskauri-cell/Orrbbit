import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import Avatar from "@/src/components/Avatar";
import MapTiles from "@/src/components/MapTiles";
import { AdaptiveRadarPillMarker, RadarClusterMarker, estimatePillWidth } from "@/src/components/AdaptiveRadarPillMarker";
import { getApproximateDisplayLocation, DEMO_LOCATION } from "@/src/services/locationService";
import { colors, anim } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";
import { EVENT_CATEGORY_ICONS } from "@/src/services/eventService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAP_W = SCREEN_W; // edge to edge
const MAP_H = Math.min(Math.max(Math.round(SCREEN_H * 0.48), 360), 500); // radar is the hero — takes ~half the screen
const CX = MAP_W / 2;
const CY = MAP_H / 2;
const MAX_R = MAP_H / 2 - 26;
const MAX_SCALE = 3;
const MAX_MARKERS = 24; // absolute hard cap for individual avatars
const EVENT_MARKER_CAP = 4; // cap event/business pins shown on the map so it never gets crowded

// Focus Map budget by zoom tier — zoomed out keeps the map scannable (~6-8
// markers), pinching in progressively reveals more individuals/clusters as
// there's more room to read them. Matching/privacy logic never changes —
// this only decides how many already-computed positions get their own marker.
const ZOOM_TIERS = [
  { focus: 4, maxClusters: 4 }, // tier 0 — default/zoomed out
  { focus: 9, maxClusters: 5 }, // tier 1 — mid pinch
  { focus: 16, maxClusters: 6 }, // tier 2 — zoomed in
];
const tierFor = (s: number) => (s >= 2.2 ? 2 : s >= 1.4 ? 1 : 0);

const MARKER_SPRING = { damping: 18, stiffness: 140, mass: 0.6 } as const;
const CAMERA_SPRING = { damping: 20, stiffness: 180 } as const;

const SHORT_VIBE: Record<string, string> = {
  open_to_chat: "Chat",
  coffee_drinks: "Coffee",
  need_advice: "Advice",
  networking: "Networking",
  relationship: "Dating",
  gym_buddy: "Activity",
  exploring: "Exploring",
  opportunity: "Opportunity",
  new_friends: "Friends",
  going_out: "Going Out",
  events: "Events",
  new_to_area: "New Here",
  travelling: "Travelling",
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
 *  Content renders at scale 1, so avatars, borders and text never pixelate.
 *  When its target coordinate changes (re-clustering, live nearby refresh),
 *  it glides there with a spring instead of snapping — markers never jump. */
function MapAnchor({
  cx,
  cy,
  oy = CY,
  w,
  h,
  z,
  style,
  children,
}: {
  cx: number;
  cy: number;
  oy?: number;
  w: number;
  h: number;
  z: ZoomSV;
  style?: any;
  children: React.ReactNode;
}) {
  const ax = useSharedValue(cx);
  const ay = useSharedValue(cy);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      ax.value = cx;
      ay.value = cy;
      return;
    }
    ax.value = withSpring(cx, MARKER_SPRING);
    ay.value = withSpring(cy, MARKER_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cx, cy]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: z.tx.value + CX + (ax.value - CX) * z.scale.value - w / 2 },
      { translateY: z.ty.value + oy + (ay.value - oy) * z.scale.value - h / 2 },
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
  maxR = MAX_R,
  z,
  selected,
  active,
}: {
  m: number;
  maxDist: number;
  maxR?: number;
  z: ZoomSV;
  selected: boolean;
  active: boolean;
}) {
  const a = useAnimatedStyle(() => {
    const r = (m / maxDist) * maxR * z.scale.value;
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
function RingLabelA({ m, maxDist, maxR = MAX_R, cy = CY, z }: { m: number; maxDist: number; maxR?: number; cy?: number; z: ZoomSV }) {
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: z.tx.value },
      { translateY: z.ty.value - (m / maxDist) * maxR * z.scale.value - 14 },
    ],
  }));
  return (
    <Reanimated.View pointerEvents="none" style={[styles.ringLabelWrap, { top: cy }, a]}>
      <Text style={styles.ringLabel}>{m >= 1000 ? "1 km" : `${m}m`}</Text>
    </Reanimated.View>
  );
}

function ringSet(r: number): number[] {
  if (r <= 25) return [10, 25];
  if (r <= 50) return [10, 25, 50];
  if (r <= 100) return [25, 50, 75, 100];
  if (r <= 250) return [50, 100, 175, 250];
  if (r <= 500) return [125, 250, 375, 500];
  if (r <= 750) return [250, 500, 750];
  return [250, 500, 750, 1000];
}

type Props = {
  users: NearbyUser[];
  vibeMap: Record<string, Vibe>;
  onSelect: (u: NearbyUser) => void;
  meUri?: string | null;
  meName?: string | null;
  /** Active-vibe colour for the current user's marker ring/pulse (single source of truth). */
  meColor?: string | null;
  radiusSetting: number;
  coords?: { lat: number; lng: number } | null;
  onFilters?: () => void;
  onCluster?: (users: NearbyUser[]) => void;
  onRadiusPress?: () => void;
  onLearnMore?: () => void;
  filterCount?: number;
  /** Optional dynamic height — when provided the radar fills that space
   *  (used by the Professional Radar to occupy all available screen height).
   *  Defaults to the classic MAP_H so the People radar is unchanged. */
  height?: number;
  /** People Mode event hotspots (already distance/bearing quantized server-side). */
  events?: { id: string; title: string; category: string; going: number; distance: number; bearing: number }[];
  onSelectEvent?: (e: any) => void;
  onEventsPress?: () => void;
  eventsActive?: boolean;
};

export default function RadarView({ users, vibeMap, onSelect, meUri, meName, meColor, radiusSetting, coords, onFilters, onCluster, onRadiusPress, onLearnMore, filterCount, height, events, onSelectEvent, onEventsPress, eventsActive }: Props) {
  // dynamic vertical geometry — centre and max ring radius derive from the real height
  const mapH = Math.max(300, Math.round(height || MAP_H));
  const cy = mapH / 2;
  const maxR = Math.min(mapH / 2 - 26, MAP_W / 2 - 10); // rings never crop off-screen horizontally
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // map zoom / pan (own exact position stays centred; others remain approximate at any zoom)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const tierSV = useSharedValue(0);
  const followSV = useSharedValue(1); // 1 = following, 0 = exploring — gates setFollowMode so it fires once

  // sharper tiles: retina baseline, swap to higher-zoom tiles while zoomed in.
  // Boost updates DURING the pinch (not just on release) so detail loads immediately.
  const [tileBoost, setTileBoost] = useState(1);
  const [zoomTier, setZoomTier] = useState(0); // drives the Focus Map marker budget (see ZOOM_TIERS)
  const applyZoomState = (s: number) => {
    setTileBoost(s >= 1.5 ? 2 : 1);
    setZoomTier(tierFor(s));
  };

  // Follow Mode — Radar opens centred on the user and following live location.
  // The moment they deliberately pan or pinch, following pauses (map stays put,
  // their live position keeps updating in the background) until they tap re-centre.
  const [followMode, setFollowMode] = useState(true);

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
    .onStart(() => {
      // only cross the JS thread once per explore — not on every gesture start
      if (followSV.value) {
        followSV.value = 0;
        runOnJS(setFollowMode)(false);
      }
    })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
      // load higher-detail tiles + adjust the Focus Map budget as soon as a
      // zoom threshold is crossed (gated so the JS thread isn't hit every frame)
      const t = tierFor(scale.value);
      if (t !== tierSV.value) {
        tierSV.value = t;
        runOnJS(applyZoomState)(scale.value);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(applyZoomState)(scale.value);
      if (scale.value <= 1.01) {
        tx.value = withSpring(0, CAMERA_SPRING);
        ty.value = withSpring(0, CAMERA_SPRING);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .minDistance(12)
    .maxPointers(1)
    .onStart(() => {
      if (followSV.value) {
        followSV.value = 0;
        runOnJS(setFollowMode)(false);
      }
    })
    .onUpdate((e) => {
      const boundX = ((scale.value - 1) * MAP_W) / 2;
      const boundY = ((scale.value - 1) * mapH) / 2;
      tx.value = Math.min(Math.max(savedTx.value + e.translationX, -boundX), boundX);
      ty.value = Math.min(Math.max(savedTy.value + e.translationY, -boundY), boundY);
    })
    .onEnd((e) => {
      // natural momentum/inertia on release — feels like a native maps app
      const boundX = ((scale.value - 1) * MAP_W) / 2;
      const boundY = ((scale.value - 1) * mapH) / 2;
      tx.value = withDecay(
        { velocity: e.velocityX, clamp: [-boundX, boundX], deceleration: 0.995 },
        () => {
          savedTx.value = tx.value;
        }
      );
      ty.value = withDecay(
        { velocity: e.velocityY, clamp: [-boundY, boundY], deceleration: 0.995 },
        () => {
          savedTy.value = ty.value;
        }
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const target = scale.value > 1.2 ? 1 : 2;
      scale.value = withSpring(target, CAMERA_SPRING);
      savedScale.value = target;
      tierSV.value = tierFor(target);
      runOnJS(applyZoomState)(target);
      if (target === 1) {
        tx.value = withSpring(0, CAMERA_SPRING);
        ty.value = withSpring(0, CAMERA_SPRING);
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
    scale.value = withSpring(1, CAMERA_SPRING);
    savedScale.value = 1;
    tierSV.value = 0;
    applyZoomState(1);
    tx.value = withSpring(0, CAMERA_SPRING);
    ty.value = withSpring(0, CAMERA_SPRING);
    savedTx.value = 0;
    savedTy.value = 0;
    followSV.value = 1;
    setFollowMode(true);
  };

  const zoomBy = (factor: number) => {
    const target = Math.min(Math.max(savedScale.value * factor, 1), MAX_SCALE);
    scale.value = withSpring(target, CAMERA_SPRING);
    savedScale.value = target;
    tierSV.value = tierFor(target);
    applyZoomState(target);
    if (target <= 1.01) {
      tx.value = withSpring(0, CAMERA_SPRING);
      ty.value = withSpring(0, CAMERA_SPRING);
      savedTx.value = 0;
      savedTy.value = 0;
    }
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  const rings = ringSet(radiusSetting);
  const MAX_DIST = rings[rings.length - 1];
  const zoom = MAX_DIST <= 50 ? 18 : MAX_DIST <= 100 ? 17 : MAX_DIST <= 250 ? 16 : MAX_DIST <= 500 ? 15 : 14;
  const loc = coords || DEMO_LOCATION;

  // memoised marker placement — recomputed only when data/geometry change,
  // not on every parent poll re-render (startup/scroll performance)
  const { singles, clusterInfo, clusters, placedEvents } = useMemo(() => {
    // place nearby users (fuzzed positions only) — centre coordinates in map space
    const placed = users.map((u) => {
      const approx = getApproximateDisplayLocation(u, radiusSetting);
      const r = Math.min(approx.distance / MAX_DIST, 1) * maxR;
      const rad = (approx.bearing * Math.PI) / 180;
      return {
        u,
        x: CX + r * Math.sin(rad),
        y: cy - r * Math.cos(rad),
        color: (u as any).pro ? colors.teal : (u.vibe && vibeMap[u.vibe]?.color) || colors.grey,
        bearing: approx.bearing,
        dist: approx.distance,
      };
    });
    // Focus Map: the most relevant get individual markers, the rest collapse
    // into clusters (hard cap of 24 individual avatars always holds). The
    // budget widens by zoom tier — pinching in progressively de-clusters.
    const tierCfg = ZOOM_TIERS[Math.min(zoomTier, ZOOM_TIERS.length - 1)];
    const FOCUS = Math.min(tierCfg.focus, MAX_MARKERS);
    const MAX_CLUSTERS = tierCfg.maxClusters;
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
      // keep the radar scannable — merge the smallest clusters into their
      // nearest neighbour until the total marker count stays ~6-8 (singles + clusters)
      while (clusters.length > MAX_CLUSTERS) {
        let si = 0;
        for (let i = 1; i < clusters.length; i++) {
          if (clusters[i].users.length < clusters[si].users.length) si = i;
        }
        const small = clusters[si];
        clusters.splice(si, 1);
        let best2 = 0;
        let bestD2 = Infinity;
        clusters.forEach((c, i) => {
          const d = Math.hypot(c.x - small.x, c.y - small.y);
          if (d < bestD2) {
            bestD2 = d;
            best2 = i;
          }
        });
        clusters[best2] = {
          ...clusters[best2],
          users: [...clusters[best2].users, ...small.users],
          x: (clusters[best2].x + small.x) / 2,
          y: (clusters[best2].y + small.y) / 2,
        };
      }
    }
    // spacing pass — avatars never stack directly on top of each other
    const MIN_GAP = 46;
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
            y: Math.min(Math.max(singles[j].y + Math.sin(ang) * MIN_GAP, 26), mapH - 26),
          };
        }
      }
    }
    // keep the centre clear — nothing may sit under the "You" marker (it would block taps)
    const clearCentre = (px: number, py: number, brg: number, min: number) => {
      const dx = px - CX;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      if (d >= min) return { x: px, y: py };
      const ang = d > 0.5 ? Math.atan2(dy, dx) : ((brg - 90) * Math.PI) / 180;
      return { x: CX + Math.cos(ang) * min, y: cy + Math.sin(ang) * min };
    };
    singles = singles.map((p) => ({ ...p, ...clearCentre(p.x, p.y, p.bearing, 52) }));
    clusters = clusters.map((c) => ({ ...c, ...clearCentre(c.x, c.y, 0, 56) }));

    // clusters carry wider pill labels — give them extra breathing room from
    // people markers and from each other so labels never collide (cleaner scan)
    const CLUSTER_GAP = 58;
    for (let i = 0; i < clusters.length; i++) {
      const others = [...singles, ...clusters.slice(0, i)];
      for (const o of others) {
        const dx = clusters[i].x - o.x;
        const dy = clusters[i].y - o.y;
        const d = Math.hypot(dx, dy);
        if (d < CLUSTER_GAP) {
          const ang = d > 0.5 ? Math.atan2(dy, dx) : (i + 1) * 0.9;
          clusters[i] = {
            ...clusters[i],
            x: Math.min(Math.max(o.x + Math.cos(ang) * CLUSTER_GAP, 30), MAP_W - 30),
            y: Math.min(Math.max(o.y + Math.sin(ang) * CLUSTER_GAP, 30), mapH - 30),
          };
        }
      }
    }

    // dominant vibe per cluster (drives bubble colour, label and heat zones)
    const clusterInfo = clusters.map((c) => {
      const counts: Record<string, number> = {};
      c.users.forEach((u) => {
        if (u.vibe) counts[u.vibe] = (counts[u.vibe] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      // lower plurality threshold (was strict majority) — after clusters merge to
      // hit the marker budget, the single most common vibe still earns a readable
      // label instead of falling back to a bare count
      const dominant = top && top[1] / c.users.length >= 0.34 ? top[0] : null;
      const label =
        dominant === "opportunity"
          ? opportunityClusterLabel(c.users)
          : dominant
          ? SHORT_VIBE[dominant] || null
          : null;
      // adaptive pills have content-based width — clamp inside the visible radar
      const w = estimatePillWidth(c.users.length, label);
      return {
        ...c,
        x: Math.min(Math.max(c.x, w / 2 + 10), MAP_W - w / 2 - 10),
        w,
        color: (dominant && vibeMap[dominant]?.color) || colors.teal,
        label,
      };
    });

    // Event/business pins — capped to the nearest few and spaced away from
    // people markers and each other so pins/labels never collide.
    const evSorted = [...(events || [])].sort((a, b) => a.distance - b.distance).slice(0, EVENT_MARKER_CAP);
    const EVENT_GAP = 64;
    const placedEvents: { ev: any; x: number; y: number; isBiz: boolean; size: number }[] = [];
    evSorted.forEach((ev, idx) => {
      const isBiz = (ev as any).host_type === "business";
      const rr = Math.min(ev.distance / MAX_DIST, 1) * maxR;
      const rad = (ev.bearing * Math.PI) / 180;
      const minR = Math.max(110, maxR * 0.55);
      let pos = clearCentre(CX + rr * Math.sin(rad), cy - rr * Math.cos(rad), ev.bearing, minR);
      [...singles, ...clusters, ...placedEvents].forEach((o) => {
        const dx = pos.x - o.x;
        const dy = pos.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d < EVENT_GAP) {
          const ang = d > 0.5 ? Math.atan2(dy, dx) : (idx + 1) * 1.1;
          pos = {
            x: Math.min(Math.max(o.x + Math.cos(ang) * EVENT_GAP, 34), MAP_W - 34),
            y: Math.min(Math.max(o.y + Math.sin(ang) * EVENT_GAP, 34), mapH - 34),
          };
        }
      });
      const size = Math.min(40 + Math.round(Math.min(ev.going, 24) * 0.6), 54);
      placedEvents.push({ ev, x: pos.x, y: pos.y, isBiz, size });
    });

    return { singles, clusterInfo, clusters, clearCentre, placedEvents };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, mapH, maxR, radiusSetting, vibeMap, events, zoomTier]);

  return (
    <View style={[styles.mapArea, { height: mapH }]} testID="radar-map">
      <GestureDetector gesture={gestures}>
        <View style={[styles.radar, { height: mapH }]}>
          {/* WORLD LAYER — only this zooms/pans (tiles + soft visuals) */}
          <Reanimated.View style={[styles.worldLayer, zoomStyle]} pointerEvents="none">
            {/* bright bird's-eye map centred on YOUR actual location (subtle 3D tilt) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.tilt}>
                {/* BASE retina layer — always mounted so zooming never drops to a blank/blurry map */}
                <View
                  style={{
                    width: MAP_W * 2,
                    height: mapH * 2,
                    marginLeft: -MAP_W / 2,
                    marginTop: -mapH / 2,
                    transform: [{ scale: 0.5 }],
                  }}
                >
                  <MapTiles lat={loc.lat} lng={loc.lng} width={MAP_W * 2} height={mapH * 2} zoom={zoom + 1} />
                </View>
                {/* HIGH-DETAIL layer — sharper, higher-zoom tiles load on top while zoomed in */}
                {tileBoost >= 2 && (
                  <View
                    style={{
                      position: "absolute",
                      left: (-MAP_W * 3) / 2,
                      top: (-mapH * 3) / 2,
                      width: MAP_W * 4,
                      height: mapH * 4,
                      transform: [{ scale: 0.25 }],
                    }}
                  >
                    <MapTiles
                      lat={loc.lat}
                      lng={loc.lng}
                      width={MAP_W * 4}
                      height={mapH * 4}
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
                  width: maxR * 2 * (radiusSetting / MAX_DIST),
                  height: maxR * 2 * (radiusSetting / MAX_DIST),
                  borderRadius: maxR * (radiusSetting / MAX_DIST),
                },
              ]}
            />

            {/* rotating sweep */}
            <Animated.View pointerEvents="none" style={[styles.sweep, { width: maxR, height: maxR, top: cy - maxR }, { transform: [{ rotate }] }]}>
              <LinearGradient
                colors={["rgba(32,178,170,0.28)", "rgba(255,90,31,0.05)", "rgba(32,178,170,0)"]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[styles.sweepGrad, { borderTopRightRadius: maxR }]}
              />
            </Animated.View>

            {/* center pulse */}
            <Animated.View
              pointerEvents="none"
              style={[styles.centerPulse, meColor ? { backgroundColor: meColor } : null, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
            />
          </Reanimated.View>

          {/* OVERLAY LAYER — crisp components positioned by coordinates, never scaled */}
          <View style={styles.overlayLayer}>
            {rings.map((m) => (
              <ZoomRing key={m} m={m} maxDist={MAX_DIST} maxR={maxR} z={z} selected={m === radiusSetting} active={m <= radiusSetting} />
            ))}
            {rings.map((m) => (
              <RingLabelA key={`label-${m}`} m={m} maxDist={MAX_DIST} maxR={maxR} cy={cy} z={z} />
            ))}

            {/* me (exact position — visible only to you) */}
            <Reanimated.View style={[styles.me, meAnchor]} pointerEvents="none">
              <Avatar uri={meUri} name={meName} size={44} ringColor={meColor || colors.teal} />
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
                  oy={cy}
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
                    {(p.u as any).pro && (
                      <View
                        style={[
                          styles.availDot,
                          {
                            backgroundColor:
                              (p.u as any).avail_state === "available"
                                ? colors.success
                                : (p.u as any).avail_state === "busy"
                                ? "#F59E0B"
                                : (p.u as any).avail_state === "appointment"
                                ? colors.teal
                                : (p.u as any).avail_state === "offline"
                                ? colors.grey
                                : p.u.active_now
                                ? colors.success
                                : colors.grey,
                          },
                        ]}
                      />
                    )}
                    {(p.u as any).top_rated && (
                      <View style={styles.topRatedBadge}>
                        <Ionicons name="star" size={7} color="#FFF" />
                      </View>
                    )}
                    {p.u.vibe === "opportunity" && !(p.u as any).pro && (
                      <View style={styles.oppBadge}>
                        <Ionicons name="sparkles" size={8} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                </MapAnchor>
              );
            })}

            {/* clusters — adaptive pill markers: [count badge][content-width label] */}
            {clusterInfo.map((c) => (
              <MapAnchor key={`cluster-${c.key}`} cx={c.x} cy={c.y} oy={cy} w={c.w} h={34} z={z} style={styles.blip}>
                {c.label ? (
                  <AdaptiveRadarPillMarker
                    testID={`radar-cluster-${c.key}`}
                    count={c.users.length}
                    label={c.label}
                    color={c.color}
                    onPress={() => onCluster?.(c.users)}
                  />
                ) : (
                  <RadarClusterMarker
                    testID={`radar-cluster-${c.key}`}
                    count={c.users.length}
                    color={c.color}
                    onPress={() => onCluster?.(c.users)}
                  />
                )}
              </MapAnchor>
            ))}

            {/* Event/business hotspots — capped + pre-spaced (see useMemo); rendered LAST
                so taps land. Business pins keep their label; other events stay icon-only
                to keep the map scannable, expanding into the full preview on tap. */}
            {placedEvents.map(({ ev, x, y, isBiz, size }) => {
              const live = (ev as any).start_datetime && new Date((ev as any).start_datetime) <= new Date() && new Date() <= new Date((ev as any).end_datetime);
              const w = isBiz ? 110 : size + 16;
              return (
                <MapAnchor key={`ev-${ev.id}`} cx={x} cy={y} oy={cy} w={w} h={size + (isBiz ? 44 : 16)} z={z} style={styles.blip}>
                  <Pressable
                    testID={`radar-event-${ev.id}`}
                    onPress={() => onSelectEvent && onSelectEvent(ev)}
                    hitSlop={8}
                    style={({ pressed }) => [{ alignItems: "center", width: w }, pressed && { transform: [{ scale: 0.93 }] }]}
                  >
                    <View style={[styles.eventGlow, isBiz && styles.eventGlowBiz, { width: size + 14, height: size + 14, borderRadius: (size + 14) / 2 }]} />
                    <View style={[styles.eventDot, isBiz && { backgroundColor: colors.cobalt }, { width: size, height: size, borderRadius: size / 2, marginTop: -(size + 14) + 7 }]}>
                      <Ionicons name={(isBiz ? "storefront" : EVENT_CATEGORY_ICONS[ev.category] || "flame") as any} size={Math.round(size * 0.42)} color="#FFF" />
                    </View>
                    {isBiz && (
                      <View style={[styles.eventPill, { backgroundColor: colors.cobalt }]}>
                        <Text style={styles.eventName} numberOfLines={1}>{ev.title}</Text>
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          BUSINESS · {(ev as any).status === "full" ? "FULL" : live ? "● Live now" : `${ev.going} going`}
                          {" · "}{ev.distance >= 1000 ? `${(ev.distance / 1000).toFixed(1)}km` : `${ev.distance}m`}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </MapAnchor>
              );
            })}

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
          <Ionicons name="locate" size={16} color={followMode ? colors.teal : colors.grey} />
        </Pressable>
      </View>

      {/* filters */}
      {onFilters && (
        <Pressable testID="radar-filters" style={styles.filtersBtn} onPress={onFilters} hitSlop={8}>
          <Ionicons name="options-outline" size={14} color={colors.text} />
          <Text style={styles.filtersText}>Filters</Text>
          {!!filterCount && (
            <View style={styles.filterCountBadge} testID="filter-count-badge">
              <Text style={styles.filterCountText}>{filterCount}</Text>
            </View>
          )}
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

      {/* events chip — between Radius and Filters */}
      {onEventsPress && (
        <Pressable testID="radar-events-chip" style={[styles.eventsChip, eventsActive && styles.eventsChipOn]} onPress={onEventsPress} hitSlop={8}>
          <Ionicons name="flame" size={13} color={eventsActive ? "#FFF" : colors.orange} />
          <Text style={[styles.radiusChipText, eventsActive && { color: "#FFF" }]}>Events</Text>
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
            Exact locations hidden · You only see approximate locations.
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
  eventsChip: {
    position: "absolute",
    top: 12,
    right: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.orange + "55",
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
  eventsChipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  eventGlow: { backgroundColor: "rgba(255,90,31,0.18)", borderWidth: 1, borderColor: "rgba(255,90,31,0.30)" },
  eventGlowBiz: { backgroundColor: "rgba(47,107,255,0.18)", borderColor: "rgba(47,107,255,0.30)" },
  eventDot: {
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
    shadowColor: "#FF5A1F",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  eventPill: { backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3, maxWidth: 110, alignItems: "center", shadowColor: "#111827", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  eventName: { color: "#FFF", fontSize: 11, fontWeight: "800", textAlign: "center" },
  eventMeta: { color: "rgba(255,255,255,0.92)", fontSize: 10, fontWeight: "700" },
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
  topRatedBadge: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.purple,
    borderWidth: 1.5,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
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
    top: 0,
    bottom: 0,
    justifyContent: "center",
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
  filterCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
});

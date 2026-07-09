import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import Avatar from "@/src/components/Avatar";
import MapBackground from "@/src/components/MapBackground";
import { getApproximateDisplayLocation } from "@/src/services/locationService";
import { colors } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 40, 330);
const CENTER = SIZE / 2;
const MAX_R = CENTER - 24;
const MAX_DIST = 100; // radar always spans the 100m hard cap
const MAX_SCALE = 3;

type Props = {
  users: NearbyUser[];
  vibeMap: Record<string, Vibe>;
  onSelect: (u: NearbyUser) => void;
  meUri?: string | null;
  meName?: string | null;
  radiusSetting: number;
};

export default function RadarView({ users, vibeMap, onSelect, meUri, meName, radiusSetting }: Props) {
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
      const bound = ((scale.value - 1) * SIZE) / 2;
      tx.value = Math.min(Math.max(savedTx.value + e.translationX, -bound), bound);
      ty.value = Math.min(Math.max(savedTy.value + e.translationY, -bound), bound);
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

  const rings = [25, 50, 75, 100];

  return (
    <View style={styles.wrap}>
      <View style={styles.mapCard} testID="radar-map">
        <GestureDetector gesture={gestures}>
          <Reanimated.View style={[styles.radar, zoomStyle]}>
            {/* soft light map behind everything */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <MapBackground size={SIZE} />
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
                      borderColor: active ? colors.teal + "66" : "#C9D2D4",
                    },
                  ]}
                />
              );
            })}
            {rings.map((m) => (
              <Text
                key={`label-${m}`}
                style={[styles.ringLabel, { top: CENTER - (m / MAX_DIST) * MAX_R - 14 }]}
              >
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
                colors={["rgba(32,178,170,0.30)", "rgba(255,90,31,0.05)", "rgba(32,178,170,0)"]}
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
            <View style={styles.me} pointerEvents="none">
              <Avatar uri={meUri} name={meName} size={44} ringColor={colors.teal} />
              <View style={styles.mePointer} />
            </View>

            {/* nearby blips — approximate/fuzzed positions only, never exact GPS */}
            {users.map((u) => {
              const approx = getApproximateDisplayLocation(u, radiusSetting);
              const r = Math.min(approx.distance / MAX_DIST, 1) * MAX_R;
              const rad = (approx.bearing * Math.PI) / 180;
              const x = CENTER + r * Math.sin(rad) - 19;
              const y = CENTER - r * Math.cos(rad) - 19;
              const color = (u.vibe && vibeMap[u.vibe]?.color) || colors.grey;
              return (
                <Pressable
                  key={u.id}
                  testID={`radar-blip-${u.id}`}
                  onPress={() => onSelect(u)}
                  style={[styles.blip, { left: x, top: y }]}
                >
                  <Avatar uri={u.photo_url} name={u.name} size={38} ringColor={color} />
                  {u.compatible && <View style={[styles.compatDot, { backgroundColor: color }]} />}
                </Pressable>
              );
            })}
          </Reanimated.View>
        </GestureDetector>

        {/* re-centre */}
        <Pressable testID="radar-recentre" style={styles.recentreBtn} onPress={recentre} hitSlop={8}>
          <Ionicons name="locate" size={16} color={colors.teal} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  mapCard: {
    width: SIZE,
    height: SIZE,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAF9",
  },
  radar: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
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
    left: CENTER,
    top: CENTER - MAX_R,
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
});

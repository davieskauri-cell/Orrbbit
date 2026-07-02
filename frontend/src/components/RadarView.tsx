import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius } from "@/src/theme";
import type { NearbyUser, StatusOption } from "@/src/context/RadarContext";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 48, 320);
const CENTER = SIZE / 2;
const MAX_R = CENTER - 22;

type Props = {
  users: NearbyUser[];
  maxDistance: number;
  statusMap: Record<string, StatusOption>;
  onSelect: (u: NearbyUser) => void;
};

export default function RadarView({ users, maxDistance, statusMap, onSelect }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] });

  return (
    <View style={styles.wrap}>
      <View style={styles.radar}>
        {/* concentric rings */}
        {[1, 0.66, 0.33].map((f, i) => (
          <View
            key={i}
            style={[
              styles.ring,
              {
                width: MAX_R * 2 * f,
                height: MAX_R * 2 * f,
                borderRadius: MAX_R * f,
              },
            ]}
          />
        ))}

        {/* rotating sweep beam */}
        <Animated.View style={[styles.sweep, { transform: [{ rotate }] }]}>
          <LinearGradient
            colors={["rgba(16,185,129,0.45)", "rgba(16,185,129,0.0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sweepGrad}
          />
        </Animated.View>

        {/* center pulse (you) */}
        <Animated.View
          style={[styles.centerPulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
        />
        <View style={styles.centerDot} />

        {/* blips */}
        {users.map((u) => {
          const r = Math.min(u.distance / maxDistance, 1) * MAX_R;
          const rad = (u.bearing * Math.PI) / 180;
          const x = CENTER + r * Math.sin(rad) - 16;
          const y = CENTER - r * Math.cos(rad) - 16;
          const color = (u.status && statusMap[u.status]?.color) || colors.onSurfaceSecondary;
          return (
            <Pressable
              key={u.id}
              testID={`radar-blip-${u.id}`}
              onPress={() => onSelect(u)}
              style={[styles.blip, { left: x, top: y, borderColor: color }]}
            >
              <Image source={{ uri: u.avatar_url || undefined }} style={styles.blipImg} />
              {u.is_match && <View style={[styles.matchRing, { borderColor: color }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  radar: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
  },
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandPrimary,
  },
  centerDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.brandPrimary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  blip: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
  blipImg: { width: "100%", height: "100%" },
  matchRing: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 20,
    borderWidth: 1.5,
  },
});

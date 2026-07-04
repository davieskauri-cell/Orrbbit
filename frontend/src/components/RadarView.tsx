import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Avatar from "@/src/components/Avatar";
import { colors } from "@/src/theme";
import type { NearbyUser, Vibe } from "@/src/context/AppContext";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 40, 330);
const CENTER = SIZE / 2;
const MAX_R = CENTER - 24;
const MAX_DIST = 100; // radar always spans the 100m hard cap

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

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.05] });

  const rings = [25, 50, 75, 100];

  return (
    <View style={styles.wrap}>
      <View style={styles.radar}>
        {rings.map((m) => {
          const f = m / MAX_DIST;
          const active = m <= radiusSetting;
          return (
            <View
              key={m}
              style={[
                styles.ring,
                {
                  width: MAX_R * 2 * f,
                  height: MAX_R * 2 * f,
                  borderRadius: MAX_R * f,
                  borderColor: active ? colors.teal + "55" : colors.border,
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
        <Animated.View style={[styles.sweep, { transform: [{ rotate }] }]}>
          <LinearGradient
            colors={["rgba(32,178,170,0.35)", "rgba(255,90,31,0.05)", "rgba(32,178,170,0)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sweepGrad}
          />
        </Animated.View>

        {/* center pulse + me */}
        <Animated.View
          style={[styles.centerPulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
        />
        <View style={styles.me}>
          <Avatar uri={meUri} name={meName} size={44} ringColor={colors.orange} />
        </View>

        {/* nearby blips */}
        {users.map((u) => {
          const r = Math.min(u.distance / MAX_DIST, 1) * MAX_R;
          const rad = (u.bearing * Math.PI) / 180;
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  radar: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 1.5 },
  ringLabel: {
    position: "absolute",
    alignSelf: "center",
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
  },
  radiusFill: { position: "absolute", backgroundColor: "rgba(32,178,170,0.06)" },
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
  me: { position: "absolute" },
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
});

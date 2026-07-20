import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";
import Avatar from "@/src/components/Avatar";
import { colors, font } from "@/src/theme";

const { width } = Dimensions.get("window");
const W = width - 40;
const H = 340;

type Props = {
  meUri?: string | null;
  meName?: string | null;
  otherUri?: string | null;
  otherName?: string | null;
  bearing: number;
};

// Clean stylised meetup map — approximate positions only, never exact GPS.
export default function MeetupMap({ meUri, meName, otherUri, otherName, bearing }: Props) {
  const mx = W * 0.32;
  const my = H * 0.68;
  const rad = (bearing * Math.PI) / 180;
  const ox = Math.min(Math.max(mx + Math.sin(rad) * W * 0.38, 50), W - 50);
  const oy = Math.min(Math.max(my - Math.cos(rad) * H * 0.42, 54), H - 54);

  return (
    <View style={styles.map}>
      {/* stylised streets */}
      <View style={[styles.street, { top: H * 0.28, transform: [{ rotate: "-8deg" }] }]} />
      <View style={[styles.street, { top: H * 0.58, transform: [{ rotate: "5deg" }] }]} />
      <View style={[styles.streetV, { left: W * 0.55, transform: [{ rotate: "10deg" }] }]} />
      <View style={[styles.block, { top: 26, left: 22 }]} />
      <View style={[styles.block, { top: H * 0.66, left: W * 0.66, width: 90 }]} />
      <View style={[styles.park, { top: H * 0.38, left: W * 0.08 }]} />

      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Line
          x1={mx}
          y1={my}
          x2={ox}
          y2={oy}
          stroke={colors.orange}
          strokeWidth={2.5}
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        <Circle cx={mx} cy={my} r={38} fill="rgba(32,178,170,0.12)" />
        <Circle cx={ox} cy={oy} r={38} fill="rgba(255,90,31,0.10)" />
      </Svg>

      <View style={[styles.bubble, { left: mx - 24, top: my - 24 }]}>
        <Avatar uri={meUri} name={meName} size={48} ringColor={colors.teal} />
        <Text style={styles.bubbleLabel}>You</Text>
      </View>
      <View style={[styles.bubble, { left: ox - 24, top: oy - 24 }]}>
        <Avatar uri={otherUri} name={otherName} size={48} ringColor={colors.orange} />
        <Text style={styles.bubbleLabel}>{otherName}</Text>
      </View>

      <View style={styles.approxTag}>
        <Text style={styles.approxText}>Approximate locations only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: W,
    height: H,
    borderRadius: 22,
    backgroundColor: "#EDF6F4",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  street: {
    position: "absolute",
    left: -30,
    right: -30,
    height: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
  },
  streetV: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
  },
  block: {
    position: "absolute",
    width: 70,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E2EEEA",
  },
  park: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#DCF2E4",
  },
  bubble: { position: "absolute", alignItems: "center" },
  bubbleLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: "hidden",
  },
  approxTag: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "#FFFFFFDD",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  approxText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "500" },
});

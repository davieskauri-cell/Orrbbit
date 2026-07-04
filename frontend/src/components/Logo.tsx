import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/src/theme";

// INTRO radar mark — a "you" dot sending waves to the top-right.
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path d="M 12 11 A 25 25 0 0 1 37 36" stroke={colors.orange} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M 12 18.5 A 17.5 17.5 0 0 1 29.5 36" stroke={colors.teal} strokeWidth={4.5} strokeLinecap="round" />
      <Path d="M 12 26 A 10 10 0 0 1 22 36" stroke={colors.orange} strokeWidth={4.5} strokeLinecap="round" />
      <Circle cx={12} cy={36} r={5.5} fill={colors.teal} />
    </Svg>
  );
}

export default function Logo({ size = 34, wordColor }: { size?: number; wordColor?: string }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize: size * 0.64, color: wordColor || colors.text }]}>
        INTRO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontWeight: "800", letterSpacing: 1.5 },
});

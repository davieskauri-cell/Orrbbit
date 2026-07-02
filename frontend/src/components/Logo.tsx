import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/src/theme";

// Playful radar/wave mark: a "you" dot sending friendly waves to the top-right,
// with the outermost wave in a warm accent.
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Path
        d="M 12 11 A 25 25 0 0 1 37 36"
        stroke={colors.accent}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <Path
        d="M 12 18.5 A 17.5 17.5 0 0 1 29.5 36"
        stroke={colors.brandPrimary}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <Path
        d="M 12 26 A 10 10 0 0 1 22 36"
        stroke={colors.brand}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={36} r={5.5} fill={colors.brandSecondary} />
    </Svg>
  );
}

type LogoProps = {
  size?: number;
  wordColor?: string;
};

export default function Logo({ size = 36, wordColor }: LogoProps) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text
        style={[
          styles.word,
          { fontSize: size * 0.66, color: wordColor || colors.onSurface },
        ]}
      >
        Intro
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  word: { fontWeight: "600", letterSpacing: 0.3 },
});

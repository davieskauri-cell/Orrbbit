import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

// Orrbbit brand colours (brand spec)
export const BRAND_NAVY = "#081A35";
export const BRAND_TEAL = "#16B6B0";
export const BRAND_ORANGE = "#FF6A30";

const WORDMARK_RATIO = 490 / 110; // trimmed wordmark asset dimensions

// Orrbbit orbit icon — approved logo mark (assets/images/logo.png).
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/images/logo.png")}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

// Orrbbit wordmark — navy rounded lettering with teal dot on the i (used exactly as provided).
export function Wordmark({ height = 24 }: { height?: number }) {
  return (
    <Image
      source={require("../../assets/images/wordmark.png")}
      style={{ height, width: height * WORDMARK_RATIO }}
      contentFit="contain"
    />
  );
}

export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <Wordmark height={size * 0.72} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});

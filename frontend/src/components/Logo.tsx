import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

// Orrbbit brand colours (brand spec)
export const BRAND_NAVY = "#081A35";
export const BRAND_TEAL = "#16B6B0";
export const BRAND_ORANGE = "#FF6A30";

// Approved Orrbbit orbit logo — used exactly as provided (assets/images/logo.png).
export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require("../../assets/images/logo.png")}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize: size * 0.66 }]}>Orrbbit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontWeight: "800", letterSpacing: 0.2, color: BRAND_NAVY },
});

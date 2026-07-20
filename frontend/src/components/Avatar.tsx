import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors, avatarSize, anim } from "@/src/theme";

const GRADS = ["#FF5A1F", "#20B2AA", "#8B5CF6", "#FF2D55", "#F59E0B", "#22C55E"];

type Props = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  ringColor?: string | null;
};

export default function Avatar({ uri, name, size = avatarSize.md, ringColor }: Props) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = GRADS[(name || "?").charCodeAt(0) % GRADS.length];
  const inner = ringColor ? size - 6 : size;

  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: inner, height: inner, borderRadius: inner / 2 }}
      transition={anim.fast}
    />
  ) : (
    <View
      style={[
        styles.initials,
        { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize: inner * 0.38 }]}>{initials}</Text>
    </View>
  );

  if (!ringColor) return content;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: ringColor,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
      }}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { color: "#FFFFFF", fontWeight: "700" },
});

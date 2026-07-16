import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "@/src/context/AppContext";
import { colors, spacing, font } from "@/src/theme";

export default function AppModeSwitch() {
  const { appMode, setAppMode } = useApp();
  return (
    <View style={styles.wrap} testID="app-mode-switch">
      {(["people", "professional"] as const).map((m) => {
        const active = appMode === m;
        return (
          <Pressable
            key={m}
            testID={`mode-${m}`}
            style={[styles.seg, active && styles.segActive]}
            onPress={() => setAppMode(m)}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>
              {m === "people" ? "People" : "Professional"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 999,
    padding: 3,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  seg: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: "center", minHeight: 36, justifyContent: "center" },
  segActive: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  segTextActive: { color: colors.text, fontWeight: "800" },
});

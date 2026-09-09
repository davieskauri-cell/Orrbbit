import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { colors, spacing, font } from "@/src/theme";

/** Shown once when a business's verification is approved. */
export default function BusinessVerified() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.wrap, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={st.logoRow}>
        <LogoMark size={34} />
        <Wordmark height={22} />
      </View>
      <View style={st.centre}>
        <View style={st.badgeOuter}>
          <View style={st.badgeInner}>
            <Ionicons name="checkmark" size={44} color="#FFF" />
          </View>
        </View>
        <Text style={st.title} testID="biz-verified-title">Your business is verified!</Text>
        <Text style={st.txt}>
          Welcome to Orrbbit Business. You can now start hosting events and connecting with your local community.
        </Text>
      </View>
      <Pressable testID="biz-verified-cta" onPress={() => router.replace("/(business)")} style={st.cta}>
        <Text style={st.ctaTxt}>Go to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  badgeOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.cobaltSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  badgeInner: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.cobalt, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: -0.3 },
  txt: { color: colors.textSecondary, fontSize: font.lg, lineHeight: 24, textAlign: "center", marginTop: spacing.md, maxWidth: 320 },
  cta: { backgroundColor: colors.teal, borderRadius: 16, minHeight: 54, alignItems: "center", justifyContent: "center" },
  ctaTxt: { color: "#FFF", fontSize: font.lg, fontWeight: "800" },
});

import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { colors, spacing, font, shadow } from "@/src/theme";

const OPTIONS = [
  {
    key: "personal",
    icon: "person",
    title: "Personal",
    desc: "Meet people, discover events and connect with professionals nearby.",
  },
  {
    key: "business",
    icon: "storefront",
    title: "Business",
    desc: "Build your business presence and host events for your local community.",
  },
] as const;

export default function AccountType() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const choose = (key: "personal" | "business") => {
    if (key === "personal") router.push("/(auth)/how-location-works");
    else router.push({ pathname: "/(auth)/register", params: { type: "business" } });
  };

  return (
    <ScrollView
      style={st.wrap}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}
      testID="account-type-screen"
    >
      <Pressable testID="account-type-back" onPress={() => router.back()} style={st.back} hitSlop={10}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <View style={st.logoRow}>
        <LogoMark size={34} />
        <Wordmark height={22} />
      </View>
      <Text style={st.title}>How are you joining Orrbbit?</Text>
      <Text style={st.sub}>Choose the account type that best describes you.</Text>

      {OPTIONS.map((o) => (
        <Pressable key={o.key} testID={`account-type-${o.key}`} onPress={() => choose(o.key)} style={[st.card, shadow.soft]}>
          <View style={st.iconCircle}>
            <Ionicons name={o.icon as any} size={24} color={colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>{o.title}</Text>
            <Text style={st.cardDesc}>{o.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  back: { marginBottom: spacing.md, marginLeft: -6, minHeight: 44, justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 22 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    minHeight: 110,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  cardDesc: { color: colors.textSecondary, fontSize: font.base, marginTop: 4, lineHeight: 20 },
});

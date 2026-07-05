import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const CARDS = [
  { icon: "eye", title: "Visibility is optional", text: "You choose when you are visible." },
  { icon: "resize", title: "Maximum 100 metres", text: "INTRO only works nearby. Nobody beyond 100m can see you." },
  { icon: "lock-closed", title: "No exact location first", text: "Your exact location is hidden until both people accept." },
  { icon: "time", title: "Temporary sharing", text: "Meetup location sharing ends after 15 minutes." },
  { icon: "moon", title: "Ghost Mode", text: "Go invisible anytime." },
];

export default function HowLocationWorks() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
        testID="how-location-screen"
      >
        <Text style={styles.kicker}>HOW LOCATION WORKS</Text>
        <Text style={styles.title}>You control your location</Text>
        {CARDS.map((c) => (
          <View key={c.title} style={[styles.card, shadow.card]}>
            <View style={styles.iconWrap}>
              <Ionicons name={c.icon as any} size={20} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardText}>{c.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="location-understand"
          title="I understand"
          onPress={() => router.push("/(auth)/register")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  kicker: { color: colors.orange, fontSize: font.sm, fontWeight: "800", letterSpacing: 2 },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800", marginTop: spacing.xs, marginBottom: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  cardText: { color: colors.textSecondary, fontSize: font.base, marginTop: 2, lineHeight: 20 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
});

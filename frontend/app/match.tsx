import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { getIcebreakers } from "@/src/lib/icebreakers";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function MatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userId, name, photo, vibe } = useLocalSearchParams<{
    userId: string;
    name: string;
    photo: string;
    vibe: string;
  }>();
  // demo: simulate mutual acceptance after 1 second
  const [phase, setPhase] = useState<"waiting" | "matched">("waiting");

  useEffect(() => {
    const t = setTimeout(() => setPhase("matched"), 1000);
    return () => clearTimeout(t);
  }, []);

  const openers = getIcebreakers(vibe, name || "them");

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      {phase === "waiting" ? (
        <View style={styles.center} testID="match-waiting">
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={styles.waitingText}>Letting {name} know…</Text>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }} testID="match-content">
            <View style={{ alignItems: "center" }}>
              <Text style={styles.title}>{"You both accepted"}</Text>
              <Text style={styles.sub}>You both want to connect.</Text>

              <View style={styles.avatars}>
                <Avatar uri={user?.photo_url} name={user?.name} size={96} ringColor={colors.teal} />
                <View style={styles.linkIcon}>
                  <Ionicons name="link" size={20} color="#FFF" />
                </View>
                <Avatar uri={photo || null} name={name} size={96} ringColor={colors.orange} />
              </View>

              <Text style={styles.message}>
                This means you are both open to saying hello. Keep it respectful and low pressure.
              </Text>
            </View>

            <View style={styles.iceCard} testID="icebreaker-card">
              <View style={styles.iceHeader}>
                <Ionicons name="chatbubbles" size={18} color={colors.orange} />
                <Text style={styles.iceTitle}>Need a first line?</Text>
              </View>
              {openers.map((o) => (
                <View key={o} style={styles.iceRow}>
                  <Text style={styles.iceQuote}>{"“"}</Text>
                  <Text style={styles.iceText}>{o}</Text>
                </View>
              ))}
              <Text style={styles.iceNote}>
                You already both accepted. Keep it simple and respectful.
              </Text>
            </View>
          </ScrollView>

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton
              testID="match-share-location"
              title="Continue"
              onPress={() => router.replace({ pathname: "/meetup-point", params: { userId } })}
            />
            <SecondaryButton
              testID="match-maybe-later"
              title="Maybe Later"
              onPress={() => router.replace("/(tabs)")}
              style={{ borderWidth: 0 }}
            />
            <View style={styles.privacyRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={styles.privacyText}>
                Your approximate meetup location will only be shared for 15 minutes.
              </Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  waitingText: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.lg },
  title: { color: colors.text, fontSize: 32, fontWeight: "800", marginTop: spacing.lg },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm },
  avatars: { flexDirection: "row", alignItems: "center", marginVertical: spacing.xl },
  iceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  iceHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  iceTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  iceRow: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  iceQuote: { color: colors.orange, fontSize: font.lg, fontWeight: "800" },
  iceText: { color: colors.text, fontSize: font.base, flex: 1, lineHeight: 20 },
  iceNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.md, fontStyle: "italic" },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -14,
    zIndex: 2,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  message: {
    color: colors.textSecondary,
    fontSize: font.lg,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  privacyText: { color: colors.textTertiary, fontSize: font.sm, flexShrink: 1 },
});

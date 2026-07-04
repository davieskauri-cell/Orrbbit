import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { startTemporaryLocationSharing } from "@/src/services/meetupService";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function MatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userId, name, photo } = useLocalSearchParams<{
    userId: string;
    name: string;
    photo: string;
  }>();
  // demo: simulate mutual acceptance after 1 second
  const [phase, setPhase] = useState<"waiting" | "matched">("waiting");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPhase("matched"), 1000);
    return () => clearTimeout(t);
  }, []);

  const share = async () => {
    setBusy(true);
    try {
      await startTemporaryLocationSharing(userId!);
      router.replace("/meetup");
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      {phase === "waiting" ? (
        <View style={styles.center} testID="match-waiting">
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={styles.waitingText}>Letting {name} know…</Text>
        </View>
      ) : (
        <>
          <View style={styles.center} testID="match-content">
            <Text style={styles.title}>{"It's a match! 🎉"}</Text>
            <Text style={styles.sub}>You both want to connect.</Text>

            <View style={styles.avatars}>
              <Avatar uri={user?.photo_url} name={user?.name} size={104} ringColor={colors.teal} />
              <View style={styles.linkIcon}>
                <Ionicons name="link" size={20} color="#FFF" />
              </View>
              <Avatar uri={photo || null} name={name} size={104} ringColor={colors.orange} />
            </View>

            <Text style={styles.message}>
              Great! You can now share temporary locations and meet in person.
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <PrimaryButton testID="match-share-location" title="Share Location" onPress={share} loading={busy} />
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
  title: { color: colors.text, fontSize: 36, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm },
  avatars: { flexDirection: "row", alignItems: "center", marginVertical: spacing.xxl },
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

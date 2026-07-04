import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/src/context/AppContext";
import { createMatch } from "@/src/services/matchingService";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import InterestChip from "@/src/components/InterestChip";
import EmptyState from "@/src/components/EmptyState";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function PersonPreview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findUser, vibeMap } = useApp();
  const [busy, setBusy] = useState(false);
  const user = findUser(id!);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <Pressable testID="person-close" onPress={() => router.back()} style={styles.closeFloat}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <EmptyState
          testID="person-out-of-range"
          icon="location"
          title="Out of range"
          text="They're outside your visible radius right now. Try increasing your radius up to 100m."
        />
      </View>
    );
  }

  const vibe = user.vibe ? vibeMap[user.vibe] : undefined;
  const action = vibe?.action || "Let's Connect";

  const connect = async () => {
    setBusy(true);
    try {
      await createMatch(user.id);
      router.replace({
        pathname: "/match",
        params: {
          userId: user.id,
          name: user.name,
          photo: user.photo_url || "",
          vibe: user.vibe || "",
        },
      });
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.photoWrap}>
          {user.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Avatar name={user.name} size={140} />
            </View>
          )}
          <Pressable
            testID="person-close"
            onPress={() => router.back()}
            style={[styles.close, { top: insets.top + spacing.sm }]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.distanceTag}>
            <Ionicons name="location" size={13} color={colors.orange} />
            <Text style={styles.distanceText}>{user.distance}m away</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>
            {user.name}, {user.age}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <VibePill vibe={vibe} />
          </View>
          {!!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          {!!user.interests?.length && (
            <>
              <Text style={styles.sectionLabel}>INTERESTS</Text>
              <View style={styles.chips}>
                {user.interests.map((i) => (
                  <InterestChip key={i} label={i} />
                ))}
              </View>
            </>
          )}

          <View style={styles.metaRow}>
            <Ionicons name="home-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.metaText}>From Melbourne</Text>
          </View>

          <View style={styles.safetyNote}>
            <Ionicons name="shield-checkmark" size={16} color={colors.teal} />
            <Text style={styles.safetyText}>
              Exact location is hidden until both users accept.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton testID="person-connect" title={action} onPress={connect} loading={busy} />
        <SecondaryButton
          testID="person-not-now"
          title="Not Now"
          onPress={() => router.back()}
          style={{ marginTop: spacing.sm, borderWidth: 0, minHeight: 44 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  photoWrap: { width: "100%", height: 360 },
  photo: { width: "100%", height: "100%" },
  photoFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  close: {
    position: "absolute",
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFFEE",
    alignItems: "center",
    justifyContent: "center",
  },
  closeFloat: { alignSelf: "flex-end", marginRight: spacing.lg, padding: spacing.sm },
  distanceTag: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFFEE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  name: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  bio: { color: colors.textSecondary, fontSize: font.lg, lineHeight: 24, marginTop: spacing.lg },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl },
  metaText: { color: colors.textSecondary, fontSize: font.base },
  safetyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  safetyText: { color: colors.text, fontSize: font.sm, flex: 1 },
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

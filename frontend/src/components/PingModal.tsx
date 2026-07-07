import React from "react";
import { View, Text, StyleSheet, Modal } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { useApp } from "@/src/context/AppContext";
import { distLabel } from "@/src/lib/format";
import { colors, spacing, radius, font } from "@/src/theme";

export default function PingModal() {
  const router = useRouter();
  const pathname = usePathname();
  const { activePing, dismissActivePing, vibeMap } = useApp();
  const shownAtPath = React.useRef<string | null>(null);

  // auto-dismiss when the user navigates away — the ping stays in the Pings tab
  React.useEffect(() => {
    if (!activePing) {
      shownAtPath.current = null;
      return;
    }
    if (shownAtPath.current === null) {
      shownAtPath.current = pathname;
    } else if (shownAtPath.current !== pathname) {
      shownAtPath.current = null;
      dismissActivePing(false);
    }
  }, [pathname, activePing, dismissActivePing]);

  if (!activePing) return null;
  // don't interrupt match/meetup/profile-preview moments — the ping stays in the Pings tab
  if (
    pathname.startsWith("/match") ||
    pathname.startsWith("/meetup") ||
    pathname.startsWith("/person") ||
    pathname.startsWith("/safety-confirm") ||
    pathname.startsWith("/feedback") ||
    pathname.startsWith("/report")
  )
    return null;
  const vibe = vibeMap[activePing.vibe];

  return (
    <Modal visible transparent animationType="slide" testID="ping-modal">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{activePing.title}</Text>
          <View style={styles.userRow}>
            <Avatar
              uri={activePing.user.photo_url}
              name={activePing.user.name}
              size={64}
              ringColor={vibe?.color}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>
                {activePing.user.name}, {activePing.user.age}
              </Text>
              <VibePill vibe={vibe} small />
              <Text style={styles.distance}>{distLabel(activePing.distance)}</Text>
            </View>
          </View>
          {!!activePing.user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {activePing.user.bio}
            </Text>
          )}
          <PrimaryButton
            testID="ping-view-profile"
            title="View Profile"
            onPress={() => {
              const id = activePing.user.id;
              dismissActivePing(false);
              router.push(`/person/${id}`);
            }}
          />
          <SecondaryButton
            testID="ping-dismiss"
            title="Dismiss"
            onPress={() => dismissActivePing(true)}
            style={{ marginTop: spacing.sm, borderWidth: 0 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginBottom: spacing.lg },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  distance: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  bio: {
    color: colors.textSecondary,
    fontSize: font.base,
    lineHeight: 20,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});

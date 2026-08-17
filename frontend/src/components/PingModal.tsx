import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
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
  const { activePing, dismissActivePing, vibeMap, appMode } = useApp();
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
  if (appMode === "professional") return null; // People recommendations never surface in Professional Mode
  // only interrupt on the main discovery tabs — never block menus, profile,
  // match/meetup or safety flows. The ping always remains in the Pings tab.
  const ALLOWED = ["/", "/nearby", "/pings", "/encounters"];
  if (!ALLOWED.includes(pathname)) return null;
  const vibe = vibeMap[activePing.vibe];

  return (
    <Modal visible transparent animationType="slide" testID="ping-modal" onRequestClose={() => dismissActivePing(false)}>
      <Pressable style={styles.backdrop} onPress={() => dismissActivePing(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{activePing.title}</Text>
          {!!(activePing as any).reason && (
            <View style={pmStyles.reasonRow} testID="ping-reason">
              <Text style={pmStyles.reasonText}>{(activePing as any).reason}</Text>
            </View>
          )}
          {!!(activePing as any).context && (
            <Text style={pmStyles.contextText} testID="ping-context">
              “{(activePing as any).context}”
            </Text>
          )}
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
        </Pressable>
      </Pressable>
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
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
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

const pmStyles = StyleSheet.create({
  reasonRow: {
    backgroundColor: colors.orangeSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: "flex-start",
  },
  reasonText: { color: colors.orange, fontSize: font.sm, fontWeight: "700" },
  contextText: {
    color: colors.textSecondary,
    fontSize: font.base,
    fontStyle: "italic",
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});

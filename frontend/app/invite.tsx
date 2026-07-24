import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const LINK = "orrbbit.app/southbank-trial";

export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const copy = () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(LINK).catch(() => {});
    }
    showAlert("Link copied", LINK);
  };

  const share = () => showAlert("Share trial invite", `Share this link with people nearby:\n${LINK}`);

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
      testID="invite-screen"
    >
      <View style={styles.header}>
        <Pressable testID="invite-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Invite people nearby</Text>
      </View>
      <Text style={styles.sub}>
        Orrbbit works best when more people are nearby at the same time.
      </Text>

      <View style={styles.qrWrap}>
        <View style={styles.qrBox}>
          {/* stylised QR placeholder */}
          {Array.from({ length: 25 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.qrCell,
                { backgroundColor: (i * 7) % 3 === 0 ? colors.text : "transparent" },
              ]}
            />
          ))}
          <View style={[styles.qrCorner, { top: 8, left: 8 }]} />
          <View style={[styles.qrCorner, { top: 8, right: 8 }]} />
          <View style={[styles.qrCorner, { bottom: 8, left: 8 }]} />
        </View>
        <Text style={styles.link}>{LINK}</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton testID="invite-copy" title="Copy invite link" onPress={copy} />
        <SecondaryButton testID="invite-share" title="Share trial invite" onPress={share} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm, lineHeight: 23 },
  qrWrap: { alignItems: "center" },
  qrBox: {
    width: 210,
    height: 210,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 24,
    justifyContent: "center",
    alignContent: "center",
    gap: 6,
  },
  qrCell: { width: 22, height: 22, borderRadius: 3 },
  qrCorner: {
    position: "absolute",
    width: 26,
    height: 26,
    borderWidth: 5,
    borderColor: colors.orange,
    borderRadius: 6,
  },
  link: { color: colors.teal, fontSize: font.lg, fontWeight: "700", marginTop: spacing.lg },
});

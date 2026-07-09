import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { blockUser, reportUser, REPORT_REASONS } from "@/src/services/safetyService";
import { toggleVisibility } from "@/src/services/privacyService";
import { getActiveMeetup, stopTemporaryLocationSharing } from "@/src/services/meetupService";
import { DEMO_LOCATION } from "@/src/services/locationService";
import Avatar from "@/src/components/Avatar";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

type Mode = null | "block" | "report";

export default function SafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const { nearby, coords, refresh } = useApp();
  const [mode, setMode] = useState<Mode>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [showTips, setShowTips] = useState(false);

  // make sure the block/report picker always has fresh nearby people
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideProfile = async () => {
    const updated = await toggleVisibility(false);
    setUser(updated as any);
    Alert.alert("Profile hidden", "You are now invisible on the radar.");
  };

  const endMeetup = async () => {
    const res = await getActiveMeetup(coords || DEMO_LOCATION);
    if (res.meetup) {
      await stopTemporaryLocationSharing(res.meetup.id);
      Alert.alert("Meetup ended", "Location sharing stopped.");
    } else {
      Alert.alert("No active meetup", "You have no location sharing in progress.");
    }
  };

  const emergency = () =>
    Alert.alert(
      "Emergency help",
      "If you feel unsafe, move to a public place and contact local emergency services (000 in Australia).",
      [{ text: "OK" }]
    );

  const doBlock = (id: string, name: string) => {
    Alert.alert("Block user", `Block ${name}? They won't see you and you won't see them.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockUser(id);
          await refresh();
          setMode(null);
          Alert.alert("Blocked", `${name} has been blocked.`);
        },
      },
    ]);
  };

  const doReport = async (reason: string) => {
    if (!reportTarget) return;
    await reportUser(reportTarget.id, reason);
    setReportTarget(null);
    setMode(null);
    Alert.alert("Report sent", "Thanks for keeping Intro safe. Our team will review it.");
  };

  const CARDS = [
    { icon: "hand-left", label: "Respectful introductions", desc: "Our approach etiquette in 30 seconds.", onPress: () => router.push("/etiquette"), testID: "safety-etiquette" },
    { icon: "hand-left", label: "Block a user", desc: "They can't see or ping you.", onPress: () => setMode(mode === "block" ? null : "block"), testID: "safety-block" },
    { icon: "flag", label: "Report a user", desc: "Tell us about unsafe behaviour.", onPress: () => setMode(mode === "report" ? null : "report"), testID: "safety-report" },
    { icon: "eye-off", label: "Hide my profile", desc: "Go invisible instantly.", onPress: hideProfile, testID: "safety-hide" },
    { icon: "close-circle", label: "End active meetup", desc: "Stop location sharing now.", onPress: endMeetup, testID: "safety-end-meetup" },
    { icon: "bulb", label: "Safety tips", desc: "Simple habits for safe meetups.", onPress: () => setShowTips(!showTips), testID: "safety-tips" },
    { icon: "alert-circle", label: "Emergency help", desc: "Quick access to emergency info.", onPress: emergency, testID: "safety-emergency" },
  ];

  const pickerVisible = mode === "block" || (mode === "report" && !reportTarget);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable testID="safety-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Safety first</Text>
      </View>
      <Text style={styles.sub}>
        Intro is designed for real-world connection, but you are always in control.
      </Text>

      {CARDS.map((c) => (
        <Pressable key={c.label} testID={c.testID} style={[styles.card, shadow.card]} onPress={c.onPress}>
          <View style={[styles.cardIcon, c.label === "Emergency help" && { backgroundColor: "#FFE9EC" }]}>
            <Ionicons
              name={c.icon as any}
              size={20}
              color={c.label === "Emergency help" ? colors.pink : colors.teal}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>{c.label}</Text>
            <Text style={styles.cardDesc}>{c.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      ))}

      {pickerVisible && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>
            {mode === "block" ? "Choose someone to block" : "Choose someone to report"}
          </Text>
          {nearby.length === 0 && (
            <Text style={styles.cardDesc}>No one nearby right now.</Text>
          )}
          {nearby.map((n) => (
            <Pressable
              key={n.id}
              testID={`safety-pick-${n.id}`}
              style={styles.pickRow}
              onPress={() =>
                mode === "block" ? doBlock(n.id, n.name) : setReportTarget({ id: n.id, name: n.name })
              }
            >
              <Avatar uri={n.photo_url} name={n.name} size={40} />
              <Text style={styles.pickName}>
                {n.name}, {n.age}
              </Text>
              <Text style={styles.pickDist}>{n.distance}m</Text>
            </Pressable>
          ))}
        </View>
      )}

      {mode === "report" && reportTarget && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Why are you reporting {reportTarget.name}?</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r} testID={`report-reason-${r}`} style={styles.pickRow} onPress={() => doReport(r)}>
              <Ionicons name="flag-outline" size={18} color={colors.pink} />
              <Text style={styles.pickName}>{r}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.note}>
        <Ionicons name="shield-checkmark" size={16} color={colors.teal} />
        <Text style={styles.noteText}>
          No exact location is ever shown before mutual acceptance, and meetup sharing always
          expires after 15 minutes.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 21 },
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
    minHeight: 64,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  cardDesc: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  picker: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  pickerTitle: { color: colors.text, fontSize: font.base, fontWeight: "700", marginBottom: spacing.sm },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pickName: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1 },
  pickDist: { color: colors.teal, fontSize: font.sm, fontWeight: "600" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  noteText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 19 },
});

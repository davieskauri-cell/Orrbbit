import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { STRINGS } from "@/src/lib/strings";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const STATUS_COLOR: Record<string, string> = {
  "Trial Active": colors.success,
  Live: colors.orange,
  "Coming Soon": colors.grey,
};

export default function CitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cities, setCities] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    api("/cities").then((r: any) => {
      setCities(r.cities);
      setZones(r.zones);
    }).catch(() => {});
  }, []);

  const mel = cities.find((c) => c.name === "Melbourne");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="cities-screen"
    >
      <View style={styles.header}>
        <Pressable testID="cities-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>City Launch Mode</Text>
      </View>
      <Text style={styles.bigTitle}>Launch Intro in your city</Text>
      <Text style={styles.sub}>
        Intro works best when people nearby use it at the same time. Join or start a local
        Intro launch.
      </Text>

      {mel && (
        <View style={styles.statsRow}>
          {[
            [mel.active_today, "Active today"],
            [mel.pings, "Pings"],
            [mel.matches, "Matches"],
            [mel.conversations, "Conversations"],
          ].map(([v, l]) => (
            <View key={l as string} style={styles.statBox}>
              <Text style={styles.statNum}>{v}</Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
      )}

      {cities.map((c) => {
        const current = user?.city === c.name;
        return (
          <Pressable
            key={c.name}
            testID={`city-${c.name.replace(" ", "-")}`}
            style={[styles.cityRow, current && { borderColor: colors.teal, backgroundColor: colors.tealSoft }]}
            onPress={() => router.push(`/city/${c.name}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cityName}>{c.name}</Text>
              <Text style={styles.cityCountry}>{c.country}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: (STATUS_COLOR[c.status] || colors.grey) + "18" }]}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[c.status] || colors.grey }]}>{c.status}</Text>
            </View>
            {current ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            )}
          </Pressable>
        );
      })}

      <Text style={styles.sectionTitle}>Launch Zones — Melbourne</Text>
      <Text style={styles.zoneNote}>{STRINGS.cityLaunchNote}</Text>
      {zones.map((z) => (
        <View key={z.name} style={styles.zoneRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cityName}>{z.name}</Text>
            <Text style={styles.cityCountry}>
              {z.active_users} active · {z.scheduled_trials} scheduled trials
            </Text>
          </View>
          <Pressable
            testID={`zone-join-${z.name.replace(/ /g, "-")}`}
            style={styles.joinChip}
            onPress={() => showAlert("Zone joined", `You'll be prioritised in ${z.name}.`)}
          >
            <Text style={styles.joinText}>Join zone</Text>
          </Pressable>
        </View>
      ))}

      <PrimaryButton
        testID="join-city-launch"
        title="Join City Launch"
        onPress={() => showAlert("You're in!", "You joined the Melbourne city launch.")}
        style={{ marginTop: spacing.xl }}
      />
      <SecondaryButton
        testID="request-city"
        title="Request Intro in my city"
        onPress={() => router.push("/waitlist")}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  bigTitle: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginTop: spacing.md },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21, marginBottom: spacing.lg },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  cityName: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  cityCountry: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: font.sm, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl },
  zoneNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: 4, marginBottom: spacing.md },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  joinChip: { backgroundColor: colors.tealSoft, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999 },
  joinText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { STRINGS } from "@/src/lib/strings";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function CityLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { user, setUser } = useAuth();
  const { refresh } = useApp();
  const [city, setCity] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);

  useEffect(() => {
    api("/cities").then((r: any) => {
      setCity(r.cities.find((c: any) => c.name === name) || null);
      setZones(name === "Melbourne" ? r.zones : []);
    }).catch(() => {});
  }, [name]);

  const isLive = city && (city.status === "Trial Active" || city.status === "Live");
  const isMyCity = user?.city === name;

  const makeMyCity = async () => {
    const updated = await api("/users/me/state", { method: "PUT", body: { city: name } });
    setUser(updated as any);
    await refresh();
    showAlert(`Welcome to IntroU ${name}`, "Your radar now shows people in this city.");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="city-landing-screen"
    >
      <View style={styles.header}>
        <Pressable testID="city-landing-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.brand}>IntroU <Text style={{ color: colors.orange }}>{String(name).toUpperCase()}</Text></Text>
      <Text style={styles.tagline}>{STRINGS.mainMessage}</Text>

      {city && (
        <View style={[styles.statusCard, shadow.card]}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isLive ? colors.success : colors.grey }]} />
            <Text style={[styles.statusText, { color: isLive ? colors.success : colors.textSecondary }]}>{city.status}</Text>
            <Text style={styles.country}>{city.country}</Text>
          </View>
          {isLive ? (
            <View style={styles.grid}>
              {[
                [city.active_today, "Active today"],
                [city.pings, "Pings"],
                [city.matches, "Matches"],
                [city.conversations, "Conversations"],
              ].map(([v, l]) => (
                <View key={l as string} style={styles.statBox}>
                  <Text style={styles.statNum}>{v}</Text>
                  <Text style={styles.statLabel}>{l}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.comingText}>
              {"IntroU hasn't launched in "}{name}{" yet. Join the waitlist and help bring real-life connections to your city."}
            </Text>
          )}
        </View>
      )}

      {zones.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Launch zones</Text>
          <Text style={styles.zoneNote}>{STRINGS.cityLaunchNote}</Text>
          {zones.map((z) => (
            <View key={z.name} style={styles.zoneRow}>
              <Ionicons name="location" size={16} color={colors.teal} />
              <Text style={styles.zoneName}>{z.name}</Text>
              <Text style={styles.zoneMeta}>{z.active_users} active</Text>
            </View>
          ))}
        </>
      )}

      {isLive ? (
        <PrimaryButton
          testID="city-make-mine"
          title={isMyCity ? `You're in IntroU ${name}` : `Make ${name} my city`}
          disabled={isMyCity}
          onPress={makeMyCity}
          style={{ marginTop: spacing.xl }}
        />
      ) : (
        <PrimaryButton
          testID="city-join-waitlist"
          title={`Join the ${name} waitlist`}
          onPress={() => router.push(`/waitlist?city=${name}`)}
          style={{ marginTop: spacing.xl }}
        />
      )}
      <SecondaryButton
        testID="city-become-ambassador"
        title={`Become a ${name} ambassador`}
        onPress={() => router.push(`/waitlist?city=${name}&ambassador=1`)}
        style={{ marginTop: spacing.sm }}
      />

      <View style={styles.note}>
        <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
        <Text style={styles.noteText}>{STRINGS.maxRadiusNote} {STRINGS.approxNote}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center" },
  brand: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: 2, marginTop: spacing.md },
  tagline: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.sm, lineHeight: 23 },
  statusCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.xl },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: font.base, fontWeight: "800" },
  country: { color: colors.textTertiary, fontSize: font.sm, marginLeft: "auto" },
  grid: { flexDirection: "row", gap: spacing.sm },
  statBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  comingText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21 },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl },
  zoneNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: 4, marginBottom: spacing.sm },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  zoneName: { color: colors.text, fontSize: font.base, fontWeight: "700", flex: 1 },
  zoneMeta: { color: colors.textSecondary, fontSize: font.sm },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, justifyContent: "center" },
  noteText: { color: colors.textTertiary, fontSize: font.sm, flex: 1, lineHeight: 18 },
});

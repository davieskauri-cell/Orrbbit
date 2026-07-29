import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font } from "@/src/theme";

const PREF_META: { key: string; icon: string; desc: string }[] = [
  { key: "connections", icon: "people-outline", desc: "New requests, accepted connections and unread reminders" },
  { key: "session_reminders", icon: "alarm-outline", desc: "Reminders before your scheduled sessions" },
  { key: "professional_activity", icon: "briefcase-outline", desc: "Reviews, credentials and professional updates" },
  { key: "weekly_summaries", icon: "stats-chart-outline", desc: "A weekly recap of your Orrbbit activity" },
  { key: "product_updates", icon: "sparkles-outline", desc: "New features and product announcements" },
  { key: "marketing", icon: "megaphone-outline", desc: "Occasional tips and promotional emails" },
];

export default function EmailPreferences() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    api("/users/me/email-preferences")
      .then((d) => {
        setPrefs(d.preferences);
        setLabels(d.labels || {});
      })
      .catch((e) => setError(e.message));
  }, []);

  const toggle = async (key: string, value: boolean) => {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      await api("/users/me/email-preferences", { method: "PUT", body: { [key]: value } });
    } catch (e: any) {
      setPrefs(prev);
      setError(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120, paddingHorizontal: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable testID="email-prefs-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Email Preferences</Text>
        </View>

        <Text style={styles.intro}>
          Choose which emails you&apos;d like from Orrbbit. Security and account emails
          (password changes, booking confirmations, safety notices) are always delivered.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!prefs ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
        ) : (
          PREF_META.map((m) => (
            <View key={m.key} style={styles.row} testID={`email-pref-${m.key}`}>
              <View style={styles.iconWrap}>
                <Ionicons name={m.icon as any} size={19} color={colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{labels[m.key] || m.key}</Text>
                <Text style={styles.rowDesc}>{m.desc}</Text>
              </View>
              <Switch
                testID={`email-pref-switch-${m.key}`}
                value={!!prefs[m.key]}
                onValueChange={(v) => toggle(m.key, v)}
                trackColor={{ false: colors.border, true: colors.teal }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))
        )}

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.textTertiary} />
          <Text style={styles.noteText}>
            You can&apos;t disable emails about password resets, security alerts, account
            restrictions or important booking changes — they keep your account safe.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  intro: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 20, marginBottom: spacing.xl },
  error: { color: colors.pink, fontSize: font.sm, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 64,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  rowDesc: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2, lineHeight: 16 },
  note: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  noteText: { flex: 1, color: colors.textTertiary, fontSize: font.sm, lineHeight: 17 },
});

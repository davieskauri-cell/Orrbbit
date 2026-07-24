import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function AmbassadorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [amb, setAmb] = useState<any>(null);
  const [doneTasks, setDoneTasks] = useState<string[]>([]);

  useEffect(() => {
    api("/ambassador").then(setAmb).catch(() => {});
  }, []);

  const toggleTask = (t: string) =>
    setDoneTasks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="ambassador-screen"
    >
      <View style={styles.header}>
        <Pressable testID="ambassador-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Ambassador Hub</Text>
      </View>
      <Text style={styles.sub}>
        Ambassadors launch Orrbbit city by city — inviting people, hosting 100m social
        experiments and confirming real conversations.
      </Text>

      {amb && (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.ambRow}>
            <View style={styles.badge}>
              <Ionicons name="megaphone" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ambName}>{amb.name} · {amb.city}</Text>
              <Text style={styles.ambMeta}>
                {user?.ambassador ? "You are an active ambassador" : "Demo ambassador dashboard"}
              </Text>
            </View>
          </View>
          <View style={styles.grid}>
            {[
              [amb.invites, "Invites sent"],
              [amb.signups, "Signups"],
              [amb.active_users, "Active users"],
              [amb.mutual_accepts, "Mutual accepts"],
              [amb.conversations_confirmed, "Conversations"],
              [amb.events_hosted, "Events hosted"],
            ].map(([v, l]) => (
              <View key={l as string} style={styles.statBox}>
                <Text style={styles.statNum}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Launch tasks</Text>
      {(amb?.tasks || []).map((t: string) => {
        const done = doneTasks.includes(t);
        return (
          <Pressable key={t} testID={`ambassador-task-${t.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={styles.taskRow} onPress={() => toggleTask(t)}>
            <Ionicons
              name={done ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={done ? colors.success : colors.textTertiary}
            />
            <Text style={[styles.taskText, done && { color: colors.textTertiary, textDecorationLine: "line-through" }]}>{t}</Text>
          </Pressable>
        );
      })}

      <PrimaryButton
        testID="ambassador-invite"
        title="Invite People"
        onPress={() => router.push("/invite")}
        style={{ marginTop: spacing.xl }}
      />
      {!user?.ambassador && (
        <SecondaryButton
          testID="ambassador-apply"
          title="Apply to be an ambassador"
          onPress={() => router.push("/waitlist?ambassador=1")}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  ambRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  ambName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  ambMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: { width: "31%", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  taskRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 48 },
  taskText: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1 },
});

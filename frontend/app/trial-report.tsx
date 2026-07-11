import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { showAlert } from "@/src/lib/alert";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { STRINGS } from "@/src/lib/strings";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

export default function TrialReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    api("/trial-report").then(setReport).catch(() => {});
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="trial-report-screen"
    >
      <View style={styles.header}>
        <Pressable testID="trial-report-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Post-Trial Report</Text>
      </View>
      <Text style={styles.sub}>{STRINGS.exportNote}</Text>

      {!report && <ActivityIndicator color={colors.teal} style={{ marginTop: spacing.xl }} />}

      {report && (
        <>
          <View style={[styles.card, shadow.card]}>
            <Text style={styles.kicker}>TRIAL SUMMARY</Text>
            <Text style={styles.eventName}>{report.event}</Text>
            <Text style={styles.meta}>{report.city} · {report.date}</Text>
            <View style={styles.grid}>
              {[
                [report.active_users, "Active users"],
                [report.pings_sent, "Pings sent"],
                [report.profile_views, "Profile views"],
                [report.mutual_accepts, "Mutual accepts"],
                [report.meetups_started, "Meetups started"],
                [report.conversations_confirmed, "Conversations"],
              ].map(([v, l]) => (
                <View key={l as string} style={styles.statBox}>
                  <Text style={styles.statNum}>{v}</Text>
                  <Text style={styles.statLabel}>{l}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>Feedback</Text>
          {Object.entries(report.feedback_summary || {}).map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={styles.rowLabel}>{k}</Text>
              <Text style={styles.rowValue}>{String(v)}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Safety</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Reports submitted</Text>
            <Text style={styles.rowValue}>{report.safety_reports}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Blocks</Text>
            <Text style={styles.rowValue}>{report.blocks}</Text>
          </View>

          <Text style={styles.sectionTitle}>Key learnings</Text>
          {(report.key_learnings || []).map((k: string) => (
            <View key={k} style={styles.learnRow}>
              <Ionicons name="bulb" size={15} color={colors.orange} />
              <Text style={styles.learnText}>{k}</Text>
            </View>
          ))}

          <PrimaryButton
            testID="trial-report-export"
            title="Export report (PDF)"
            onPress={() =>
              showAlert("Export coming soon", "PDF export for venues, campuses and city partners will be available in the next release.")
            }
            style={{ marginTop: spacing.xl }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  kicker: { color: colors.teal, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  eventName: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginTop: 4 },
  meta: { color: colors.textSecondary, fontSize: font.base, marginTop: 2, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: { width: "31%", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, fontSize: font.base },
  rowValue: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  learnRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  learnText: { color: colors.text, fontSize: font.base, flex: 1, lineHeight: 20 },
});

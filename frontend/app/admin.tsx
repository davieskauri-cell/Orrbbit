import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const RISK_COLOR: Record<string, string> = { high: colors.pink, medium: colors.warning, low: colors.grey };

const ACTIONS = [
  { key: "hide", label: "Hide user" },
  { key: "warn", label: "Warn" },
  { key: "ban", label: "Ban" },
  { key: "dismiss", label: "Dismiss" },
];

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);

  const load = () => api("/admin/dashboard").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  const act = async (reportId: string, action: string) => {
    await api(`/admin/reports/${reportId}/action`, { method: "POST", body: { action } }).catch(() => {});
    load();
  };

  const o = data?.overview;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
      testID="admin-screen"
    >
      <View style={styles.header}>
        <Pressable testID="admin-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Admin Dashboard</Text>
      </View>
      <Text style={styles.sub}>Internal safety, moderation and trial monitoring.</Text>

      {!data && <ActivityIndicator color={colors.teal} style={{ marginTop: spacing.xl }} />}

      {o && (
        <>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.grid}>
            {[
              [o.total_users, "Total users"],
              [o.active_today, "Active today"],
              [o.pings_sent, "Pings sent"],
              [o.profiles_viewed, "Profiles viewed"],
              [o.mutual_accepts, "Mutual accepts"],
              [o.meetups_started, "Meetups started"],
              [o.meetups_completed, "Meetups completed"],
              [o.conversations_confirmed, "Conversations"],
              [o.reports_submitted, "Reports"],
              [o.blocks_created, "Blocks"],
              [o.users_hidden_for_review, "Hidden for review"],
              [o.no_shows, "No-shows"],
            ].map(([v, l]) => (
              <View key={l as string} style={styles.statBox}>
                <Text style={styles.statNum}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Active by city</Text>
          {Object.entries(o.active_by_city || {}).map(([city, n]) => (
            <View key={city} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{city}</Text>
              <Text style={styles.lineValue}>{String(n)}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Safety incidents</Text>
          <View style={styles.grid}>
            {(["high", "medium", "low"] as const).map((r) => (
              <View key={r} style={[styles.statBox, { borderTopWidth: 3, borderTopColor: RISK_COLOR[r] }]}>
                <Text style={[styles.statNum, { color: RISK_COLOR[r] }]}>{data.safety_incidents?.[r] ?? 0}</Text>
                <Text style={styles.statLabel}>{r.toUpperCase()} risk</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Reports queue</Text>
          {data.reports_queue.length === 0 && <Text style={styles.empty}>No reports.</Text>}
          {data.reports_queue.map((r: any) => (
            <View key={r.id} style={[styles.reportCard, shadow.card]} testID={`admin-report-${r.id}`}>
              <View style={styles.reportTop}>
                <Text style={styles.reportName}>{r.reported_name}</Text>
                <View style={[styles.riskChip, { backgroundColor: RISK_COLOR[r.risk] + "22" }]}>
                  <Text style={[styles.riskText, { color: RISK_COLOR[r.risk] }]}>{r.risk.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.reportMeta}>Reported by {r.reporter_name} · {r.reason}</Text>
              {!!r.details && <Text style={styles.reportDetails}>“{r.details}”</Text>}
              <Text style={styles.reportStatus}>Status: {r.status}</Text>
              <View style={styles.actionsRow}>
                {ACTIONS.map((a) => (
                  <Pressable key={a.key} testID={`admin-action-${a.key}-${r.id}`} style={styles.actionBtn} onPress={() => act(r.id, a.key)}>
                    <Text style={[styles.actionText, a.key === "ban" && { color: colors.pink }]}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Blocked users</Text>
          {data.blocked_users.length === 0 && <Text style={styles.empty}>No blocks recorded.</Text>}
          {data.blocked_users.map((b: any, i: number) => (
            <View key={i} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{b.blocker} blocked {b.blocked}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Trial metrics</Text>
          <View style={[styles.reportCard, shadow.card]}>
            <Text style={styles.reportName}>{data.trial_metrics.event} · {data.trial_metrics.city}</Text>
            <View style={[styles.grid, { marginTop: spacing.md }]}>
              {[
                [data.trial_metrics.active_users, "Active"],
                [data.trial_metrics.pings, "Pings"],
                [data.trial_metrics.mutual_accepts, "Accepts"],
                [data.trial_metrics.conversations_confirmed, "Conversations"],
                [data.trial_metrics.reports, "Reports"],
                [data.trial_metrics.feedback_count, "Feedback"],
              ].map(([v, l]) => (
                <View key={l as string} style={styles.statBox}>
                  <Text style={styles.statNum}>{v}</Text>
                  <Text style={styles.statLabel}>{l}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.eventSummary}>
              “{data.trial_metrics.conversations_confirmed} conversations started through IntroU tonight.”
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Recruiter activity</Text>
          {Object.entries(data.recruiter_activity).map(([k, v]) => (
            <View key={k} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{k.replace(/_/g, " ")}</Text>
              <Text style={styles.lineValue}>{String(v)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs },
  sectionTitle: { color: colors.orange, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statBox: { width: "31%", backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  statNum: { color: colors.orange, fontSize: font.xl, fontWeight: "800" },
  statLabel: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textAlign: "center" },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border },
  lineLabel: { color: colors.text, fontSize: font.sm, fontWeight: "600", textTransform: "capitalize" },
  lineValue: { color: colors.orange, fontSize: font.sm, fontWeight: "800" },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  reportCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  reportTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reportName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  riskChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
  riskText: { fontSize: 10, fontWeight: "800" },
  reportMeta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  reportDetails: { color: colors.textSecondary, fontSize: font.sm, fontStyle: "italic", marginTop: 4 },
  reportStatus: { color: colors.teal, fontSize: font.sm, fontWeight: "700", marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  actionBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  actionText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  eventSummary: { color: colors.teal, fontSize: font.base, fontWeight: "700", marginTop: spacing.md, fontStyle: "italic" },
});

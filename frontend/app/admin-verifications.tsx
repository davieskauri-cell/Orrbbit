import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import { timeAgo } from "@/src/lib/format";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const FILTERS = ["Pending Review", "More Information Required", "Approved", "Rejected"];

export default function AdminVerificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<any[]>([]);
  const [filter, setFilter] = useState("Pending Review");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api<any[]>(`/admin/verifications?status_filter=${encodeURIComponent(filter)}`).then(setSubs).catch(() => setSubs([]));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, action: string) => {
    try {
      await api(`/admin/verifications/${id}/decision`, { method: "POST", body: { action, note: notes[id] || "" } });
      showAlert("Done", `Submission ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "updated"}.`);
      load();
    } catch (e: any) {
      showAlert("Failed", e.message || "Try again.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }} testID="admin-verifications-screen">
      <View style={styles.header}>
        <Pressable testID="av-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Verification Queue</Text>
      </View>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} testID={`av-filter-${f.replace(/\s+/g, "-")}`} style={[styles.chip, filter === f && styles.chipOn]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipText, filter === f && { color: "#FFF" }]}>{f}</Text>
          </Pressable>
        ))}
      </View>
      {subs.length === 0 && <Text style={styles.empty}>No submissions with this status.</Text>}
      {subs.map((s) => (
        <View key={s.id} style={[styles.card, shadow.card]} testID={`av-sub-${s.id}`}>
          <View style={styles.row}>
            <Avatar uri={s.user?.photo_url} name={s.user?.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.user?.name} · {s.category}</Text>
              <Text style={styles.meta}>{s.user?.email} · submitted {timeAgo(s.submitted_at)}</Text>
            </View>
            <Text style={styles.status}>{s.status}</Text>
          </View>
          <Text style={styles.meta}>Identity: {s.identity?.full_name} ({s.identity?.id_type})</Text>
          {s.evidence?.map((e: any, i: number) => (
            <Text key={i} style={styles.evidence}>📄 {e.type}: {e.description}</Text>
          ))}
          {s.history?.length > 0 && (
            <Text style={styles.meta}>History: {s.history.map((h: any) => `${h.action} (${timeAgo(h.at)})`).join(" → ")}</Text>
          )}
          <TextInput
            testID={`av-note-${s.id}`}
            style={styles.noteInput}
            value={notes[s.id] || ""}
            onChangeText={(t) => setNotes({ ...notes, [s.id]: t })}
            placeholder="Internal / applicant note (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.actions}>
            {s.status !== "Approved" && (
              <Pressable testID={`av-approve-${s.id}`} style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => decide(s.id, "approve")}>
                <Text style={styles.btnText}>Approve</Text>
              </Pressable>
            )}
            {s.status !== "Rejected" && (
              <Pressable testID={`av-reject-${s.id}`} style={[styles.btn, { backgroundColor: colors.pink }]} onPress={() => decide(s.id, "reject")}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            )}
            <Pressable testID={`av-more-${s.id}`} style={[styles.btn, { backgroundColor: colors.orange }]} onPress={() => decide(s.id, "more_info")}>
              <Text style={styles.btnText}>More Info</Text>
            </Pressable>
            {s.status === "Approved" && (
              <Pressable testID={`av-revoke-${s.id}`} style={[styles.btn, { backgroundColor: colors.textTertiary }]} onPress={() => decide(s.id, "revoke")}>
                <Text style={styles.btnText}>Remove Badge</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md },
  chip: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  empty: { color: colors.textTertiary, fontSize: font.base, marginTop: spacing.xl, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm },
  status: { color: colors.orange, fontSize: font.sm, fontWeight: "800" },
  evidence: { color: colors.text, fontSize: font.sm },
  noteInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: font.sm, color: colors.text, backgroundColor: colors.card, minHeight: 40 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  btn: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, minHeight: 34, justifyContent: "center" },
  btnText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
});

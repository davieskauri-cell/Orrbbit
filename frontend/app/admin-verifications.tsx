import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import { timeAgo } from "@/src/lib/format";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const FILTERS = ["Pending Review", "More Information Required", "Approved", "Suspended", "Expired", "Rejected"];

function fmtD(d?: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
}

export default function AdminVerificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<any[]>([]);
  const [filter, setFilter] = useState("Pending Review");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);

  const openDoc = async (subId: string, doc: any) => {
    if (!doc.has_file) { showAlert("No file attached", "This document has details only — no uploaded file."); return; }
    try {
      const f = await api<any>(`/admin/verifications/${subId}/documents/${doc.id}`);
      if (f.file_type?.startsWith("image/")) setPreview(f);
      else showAlert("PDF document", `${f.file_name || doc.doc_name} — PDF preview isn't supported in-app yet. File is stored securely.`);
    } catch (e: any) {
      showAlert("Couldn't load document", e.message || "Try again.");
    }
  };

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
              <Text style={styles.name}>{s.user?.name} · {s.profession || s.category}</Text>
              <Text style={styles.meta}>{s.user?.email} · submitted {timeAgo(s.submitted_at)}</Text>
            </View>
            <Text style={styles.status}>{s.status}</Text>
          </View>
          {!!s.categories?.length && <Text style={styles.meta}>Categories: {s.categories.join(", ")}</Text>}
          {!!s.valid_until && (
            <Text style={[styles.meta, s.credential_status === "Expiring Soon" && { color: colors.warning, fontWeight: "700" }, s.credential_status === "Expired" && { color: colors.pink, fontWeight: "700" }]}>
              Valid until {fmtD(s.valid_until)}{s.credential_status && s.credential_status !== "Verified" ? ` · ${s.credential_status}` : ""}
            </Text>
          )}
          <Text style={styles.meta}>Identity: {s.identity?.full_name} ({s.identity?.id_type})</Text>
          {s.documents?.map((d: any, i: number) => (
            <Pressable key={i} testID={`av-doc-${s.id}-${i}`} style={styles.docRow} onPress={() => openDoc(s.id, d)}>
              <Ionicons name={d.has_file ? "document-attach" : "document-text"} size={14} color={colors.teal} />
              <View style={{ flex: 1 }}>
                <Text style={styles.evidence}>{d.doc_name}{d.doc_number ? ` (#${d.doc_number})` : ""}</Text>
                <Text style={styles.docMeta}>{[d.issuer, d.issue_date ? `Issued ${fmtD(d.issue_date)}` : null, d.expiry_date ? `Expires ${fmtD(d.expiry_date)}` : "No expiry"].filter(Boolean).join(" · ")}</Text>
              </View>
              {d.has_file && <Text style={styles.previewLink}>Preview</Text>}
            </Pressable>
          ))}
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
              <>
                <Pressable testID={`av-suspend-${s.id}`} style={[styles.btn, { backgroundColor: colors.warning }]} onPress={() => decide(s.id, "suspend")}>
                  <Text style={styles.btnText}>Suspend</Text>
                </Pressable>
                <Pressable testID={`av-expire-${s.id}`} style={[styles.btn, { backgroundColor: colors.textTertiary }]} onPress={() => decide(s.id, "mark_expired")}>
                  <Text style={styles.btnText}>Mark Expired</Text>
                </Pressable>
              </>
            )}
            {["Suspended", "Expired"].includes(s.status) && (
              <Pressable testID={`av-renew-${s.id}`} style={[styles.btn, { backgroundColor: colors.teal }]} onPress={() => decide(s.id, "renew")}>
                <Text style={styles.btnText}>Renew</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {preview && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setPreview(null)}>
          <Pressable style={styles.previewOverlay} onPress={() => setPreview(null)}>
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>{preview.file_name}</Text>
              <Image source={{ uri: `data:${preview.file_type};base64,${preview.file_b64}` }} style={styles.previewImg} resizeMode="contain" />
              <Text style={styles.previewClose}>Tap anywhere to close</Text>
            </View>
          </Pressable>
        </Modal>
      )}
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
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md },
  docMeta: { color: colors.textSecondary, fontSize: 11 },
  previewLink: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  previewOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.7)", justifyContent: "center", padding: spacing.xl },
  previewBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  previewTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  previewImg: { width: "100%", height: 380, borderRadius: radius.md, backgroundColor: colors.card },
  previewClose: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center" },
  noteInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8, fontSize: font.sm, color: colors.text, backgroundColor: colors.card, minHeight: 40 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  btn: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8, minHeight: 34, justifyContent: "center" },
  btnText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
});

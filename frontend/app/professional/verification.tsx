import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const ID_TYPES = ["Passport", "Driver Licence", "Birth Certificate", "Other"];

type Doc = {
  doc_name: string; issuer: string; issue_date: string; expiry_date: string;
  doc_number: string; notes: string; file_b64?: string; file_type?: string; file_name?: string;
};

const emptyDoc = (): Doc => ({ doc_name: "", issuer: "", issue_date: "", expiry_date: "", doc_number: "", notes: "" });

function fmtDate(d?: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }); } catch { return d; }
}

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<any>({ status: "Not Submitted" });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [professions, setProfessions] = useState<Record<string, string[]>>({});
  const [profession, setProfession] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [draft, setDraft] = useState<Doc>(emptyDoc());
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState<string | null>(null);
  const [professionOther, setProfessionOther] = useState("");
  const [categoryOther, setCategoryOther] = useState("");
  const [otherCatOn, setOtherCatOn] = useState(false);
  const [idDocs, setIdDocs] = useState<Doc[]>([]);
  const [idDraftType, setIdDraftType] = useState<string | null>(null);
  const [idOtherLabel, setIdOtherLabel] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [desktopSent, setDesktopSent] = useState(false);

  const sendDesktopLink = async () => {
    try {
      await api("/verification/desktop-link", { method: "POST" });
      setDesktopSent(true);
      showAlert("Link sent ✓", "We've emailed you a secure verification link. Open it on your desktop or laptop within 24 hours.");
    } catch (e: any) {
      showAlert("Couldn't send link", e.message || "Try again.");
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploadNoticeVisible, setUploadNoticeVisible] = useState(false);

  const load = () => {
    api<any>("/verification/status").then(setStatus).catch(() => {});
    api<any>("/config").then((c) => setProfessions(c.professions || {})).catch(() => {});
    api<any[]>("/notifications").then((n) => setNotifications(n.filter((x) => x.type.startsWith("verification")).slice(0, 5))).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const pickFile = async () => {
    // Contextual credential-upload notice — picker must not open before "Continue".
    const seen = await AsyncStorage.getItem("orrbbit_credential_notice_v1").catch(() => null);
    if (!seen) {
      setUploadNoticeVisible(true);
      return;
    }
    await openPicker();
  };

  const acceptUploadNotice = async () => {
    setUploadNoticeVisible(false);
    await AsyncStorage.setItem("orrbbit_credential_notice_v1", "1").catch(() => {});
    api("/consents/acknowledge", {
      method: "POST",
      body: { notice_type: "credential_upload_notice", version: "1.0" },
    }).catch(() => {});
    await openPicker();
  };

  const openPicker = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if ((a.size || 0) > 5 * 1024 * 1024) { showAlert("File too large", "Maximum 5MB per document."); return; }
      let b64 = "";
      if (Platform.OS === "web" && a.uri.startsWith("data:")) {
        b64 = a.uri.split(",")[1] || "";
      } else {
        const FileSystem = await import("expo-file-system/legacy");
        b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" as any });
      }
      setDraft((d) => ({ ...d, file_b64: b64, file_type: a.mimeType || "application/pdf", file_name: a.name, doc_name: d.doc_name || (a.name || "").replace(/\.[^.]+$/, "") }));
      // Secure server-side pre-fill (best effort) — user always reviews and edits
      if ((a.mimeType || "").startsWith("image/")) {
        setExtracting(true);
        api<any>("/verification/extract", { method: "POST", body: { file_b64: b64, file_type: a.mimeType } })
          .then((r) => {
            if (r?.extracted) {
              setDraft((d) => ({
                ...d,
                doc_name: r.fields.doc_name || d.doc_name,
                issuer: d.issuer || r.fields.issuer,
                doc_number: d.doc_number || r.fields.license_number || "",
                issue_date: d.issue_date || r.fields.issue_date,
                expiry_date: d.expiry_date || r.fields.expiry_date,
              }));
            }
          })
          .catch(() => {})
          .finally(() => setExtracting(false));
      }
    } catch (e: any) {
      showAlert("Couldn't attach file", e.message || "Try again.");
    }
  };

  const addDoc = () => {
    setError(null);
    if (!draft.file_b64) { setError("Upload the credential document first — it's required."); return; }
    if (!draft.doc_name.trim()) { setError("Each document needs a name."); return; }
    if (editIndex !== null) {
      setDocs(docs.map((d, i) => (i === editIndex ? draft : d)));
      setEditIndex(null);
    } else {
      if (docs.length >= 10) { setError("Maximum 10 documents."); return; }
      setDocs([...docs, draft]);
    }
    setDraft(emptyDoc());
  };

  const addIdDoc = async () => {
    setError(null);
    if (!idDraftType) { setError("Choose the ID document type first."); return; }
    if (idDraftType === "Other" && !idOtherLabel.trim()) { setError("Please specify the ID document type."); return; }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if ((a.size || 0) > 5 * 1024 * 1024) { showAlert("File too large", "Maximum 5MB per document."); return; }
      let b64 = "";
      if (Platform.OS === "web" && a.uri.startsWith("data:")) b64 = a.uri.split(",")[1] || "";
      else {
        const FileSystem = await import("expo-file-system/legacy");
        b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: "base64" as any });
      }
      const label = idDraftType === "Other" ? `Other — ${idOtherLabel.trim()}` : idDraftType;
      setIdDocs((cur) => [...cur, { ...emptyDoc(), doc_name: label, file_b64: b64, file_type: a.mimeType || "application/pdf", file_name: a.name }]);
      setIdDraftType(null); setIdOtherLabel("");
    } catch (e: any) { showAlert("Couldn't attach file", e.message || "Try again."); }
  };

  const submit = async () => {
    setError(null);
    if (!profession) return setError("Step 1: choose your profession.");
    if (profession === "Other" && !professionOther.trim()) return setError("Step 1: please specify your profession.");
    if (profession !== "Other" && categories.length === 0 && !(otherCatOn && categoryOther.trim())) return setError("Step 2: pick at least one category.");
    if (profession === "Other" && !(otherCatOn && categoryOther.trim()) && categories.length === 0) return setError("Step 2: describe what you offer.");
    if (docs.length === 0) return setError("Upload Credentials: add at least one credential document.");
    if (idDocs.length < 2) return setError("Identity: add at least 2 ID documents.");
    if (!fullName.trim() || !idType) return setError("Add your full legal name and primary ID type.");
    setBusy(true);
    try {
      await api("/verification/submit", {
        method: "POST",
        body: {
          profession, categories, full_name: fullName.trim(), id_type: idType,
          profession_other: professionOther.trim() || undefined,
          categories_other: otherCatOn ? categoryOther.trim() : undefined,
          documents: docs.map((d) => ({ ...d, expiry_date: d.expiry_date || null })),
          identity_documents: idDocs,
        },
      });
      setShowForm(false);
      setDocs([]); setIdDocs([]);
      load();
    } catch (e: any) {
      setError(e.message || "Couldn't submit.");
    }
    setBusy(false);
  };

  const statusColor =
    status.status === "Approved" ? (status.credential_status === "Expiring Soon" ? colors.warning : colors.success)
    : status.status === "Pending Review" ? colors.orange
    : status.status === "Rejected" || status.status === "Expired" || status.status === "Suspended" ? colors.pink
    : colors.textTertiary;
  const canSubmit = ["Not Submitted", "Rejected", "More Information Required", "Expired", "Suspended"].includes(status.status);
  const catOptions = profession ? professions[profession] || [] : [];

  const pills = (options: string[], isOn: (o: string) => boolean, onPick: (o: string) => void, prefix: string) => (
    <View style={styles.pills}>
      {options.map((o) => (
        <Pressable key={o} testID={`${prefix}-${o.replace(/[^a-zA-Z0-9]+/g, "-")}`} style={[styles.pill, isOn(o) && styles.pillActive]} onPress={() => onPick(o)}>
          <Text style={[styles.pillText, isOn(o) && styles.pillTextActive]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );

  const field = (key: keyof Doc, label: string, placeholder: string) => (
    <View key={key} style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`ver-doc-${key}`}
        style={styles.input}
        value={draft[key] as string}
        onChangeText={(t) => setDraft((d) => ({ ...d, [key]: t }))}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled" testID="verification-screen">
        <View style={styles.header}>
          <Pressable testID="ver-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Professional Verification</Text>
        </View>

        {/* status */}
        <View style={styles.statusCard} testID="ver-status">
          <Ionicons name="shield-checkmark" size={20} color={statusColor} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.status === "Approved" ? "Professionally Verified" : status.status}
            </Text>
            {!!status.profession && <Text style={styles.statusMeta}>{status.profession}{status.categories?.length ? ` · ${status.categories.join(", ")}` : ""}</Text>}
            {!!status.verified_since && <Text style={styles.statusMeta}>Verified since {fmtDate(status.verified_since)}</Text>}
            {!!status.credential_last_reviewed_at && (
              <Text style={styles.statusMeta} testID="ver-last-review">Credential reviewed {fmtDate(status.credential_last_reviewed_at)}</Text>
            )}
            {!!status.credential_next_review_at && status.status === "Approved" && (
              <Text style={[styles.statusMeta, status.review_due && { color: colors.warning, fontWeight: "700" }]} testID="ver-next-review">
                Next Orrbbit review {fmtDate(status.credential_next_review_at)}{status.review_due ? " · Review due" : ""}
              </Text>
            )}
            {!!status.credential_effective_expiry && status.status === "Approved" && (
              <Text style={[styles.statusMeta, status.credential_status === "Expiring Soon" && { color: colors.warning, fontWeight: "700" }]} testID="ver-valid-until">
                Credential expiry {fmtDate(status.credential_effective_expiry)}{status.credential_status === "Expiring Soon" ? " · Expiring Soon" : ""}
              </Text>
            )}
            {!!status.note && <Text style={styles.statusNote}>Reviewer note: {status.note}</Text>}
          </View>
        </View>

        {/* credential documents on file */}
        {!!status.documents?.length && !showForm && (
          <View style={styles.docList}>
            <Text style={styles.step}>CREDENTIALS ON FILE</Text>
            {status.documents.map((d: any, i: number) => (
              <View key={i} style={styles.docRow}>
                <Ionicons name="document-text" size={15} color={colors.teal} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{d.doc_name}</Text>
                  <Text style={styles.docMeta}>{[d.issuer, d.expiry_date ? `Valid until ${fmtDate(d.expiry_date)}` : null].filter(Boolean).join(" · ")}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* notifications */}
        {notifications.length > 0 && (
          <View style={styles.notifBox} testID="ver-notifications">
            {notifications.map((n) => (
              <View key={n.id} style={styles.notifRow}>
                <Ionicons name="notifications" size={12} color={colors.orange} />
                <Text style={styles.notifText}><Text style={{ fontWeight: "700" }}>{n.title}</Text> — {n.body}</Text>
              </View>
            ))}
          </View>
        )}

        {(canSubmit || showForm) ? (
          <>
            {status.status !== "Not Submitted" && !showForm && (
              <PrimaryButton testID="ver-renew" title={status.status === "Expired" ? "Renew Verification" : "Resubmit"} onPress={() => setShowForm(true)} style={{ marginTop: spacing.lg }} />
            )}
            {(status.status === "Not Submitted" || showForm) && (
              <>
                <SecondaryButton
                  testID="ver-desktop-link"
                  title={desktopSent ? "✓ Desktop link sent — check your email" : "Complete on desktop/laptop"}
                  onPress={sendDesktopLink}
                  style={{ marginTop: spacing.md, minHeight: 44 }}
                />
                <Text style={styles.step}>STEP 1 · CHOOSE PROFESSION</Text>
                {pills(Array.from(new Set([...Object.keys(professions), "Other"])), (o) => profession === o, (o) => { setProfession(o); setCategories([]); }, "ver-prof")}
                {profession === "Other" && (
                  <TextInput testID="ver-prof-other" style={[styles.input, { marginTop: spacing.sm }]} value={professionOther} onChangeText={setProfessionOther}
                    placeholder="Please specify your profession" placeholderTextColor={colors.textTertiary} />
                )}

                {!!profession && (
                  <>
                    <Text style={styles.step}>STEP 2 · CHOOSE CATEGORIES</Text>
                    <Text style={styles.helper}>You can only offer services inside your verified categories.</Text>
                    {pills([...catOptions, "Other"], (o) => (o === "Other" ? otherCatOn : categories.includes(o)),
                      (o) => (o === "Other" ? setOtherCatOn(!otherCatOn) : setCategories(categories.includes(o) ? categories.filter((c) => c !== o) : [...categories, o])), "ver-cat")}
                    {otherCatOn && (
                      <TextInput testID="ver-cat-other" style={[styles.input, { marginTop: spacing.sm }]} value={categoryOther} onChangeText={setCategoryOther}
                        placeholder="Please specify your category" placeholderTextColor={colors.textTertiary} />
                    )}
                  </>
                )}

                <Text style={styles.step}>UPLOAD CREDENTIALS</Text>
                <Text style={styles.helper}>PDF, JPG or PNG · up to 10 documents · degrees, licences, registrations, memberships, insurance, checks. A document upload is required for each credential.</Text>
                <SecondaryButton testID="ver-pick-file" title={draft.file_name ? `📎 ${draft.file_name}` : "Upload Document (required)"} onPress={pickFile} style={{ marginTop: spacing.md, minHeight: 44 }} />
                {extracting && <Text style={styles.helper}>Reading your document to pre-fill details…</Text>}
                {!!draft.file_b64 && (
                  <Text style={styles.helper} testID="ver-prefill-note">
                    We&rsquo;ll use the information in your uploaded document to help pre-fill the details below. Please review and edit the information before continuing.
                  </Text>
                )}
                {field("doc_name", "Document Name *", "e.g. CIPD Level 7 Certificate")}
                {field("issuer", "Issuing Organisation", "e.g. CIPD")}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {field("issue_date", "Issue Date", "YYYY-MM-DD")}
                  {field("expiry_date", "Expiry Date (optional)", "YYYY-MM-DD")}
                </View>
                {field("doc_number", "Document Number (optional)", "e.g. #12345")}
                {field("notes", "Notes (optional)", "Anything the reviewer should know")}
                <SecondaryButton testID="ver-add-doc" title={editIndex !== null ? "Save Document" : "+ Add Document"} onPress={addDoc} style={{ marginTop: spacing.md, minHeight: 44 }} />

                {docs.map((d, i) => (
                  <View key={i} style={styles.docRow} testID={`ver-doc-row-${i}`}>
                    <Ionicons name="document-text" size={15} color={colors.teal} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{d.doc_name}{d.file_name ? ` · ${d.file_name}` : ""}</Text>
                      <Text style={styles.docMeta}>{[d.issuer, d.expiry_date ? `Expires ${d.expiry_date}` : null].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Pressable testID={`ver-doc-edit-${i}`} onPress={() => { setDraft(d); setEditIndex(i); }} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                      <Text style={{ color: colors.teal, fontSize: 12, fontWeight: "800" }}>EDIT</Text>
                    </Pressable>
                    <Pressable testID={`ver-doc-remove-${i}`} onPress={() => { setDocs(docs.filter((_, j) => j !== i)); if (editIndex === i) { setEditIndex(null); setDraft(emptyDoc()); } }} hitSlop={8} style={{ paddingHorizontal: 6 }}>
                      <Text style={{ color: colors.pink, fontSize: 12, fontWeight: "800" }}>REMOVE</Text>
                    </Pressable>
                  </View>
                ))}

                <Text style={styles.step}>IDENTITY</Text>
                <Text style={styles.helper}>Minimum 2 ID documents. Identity documents are private — never shown on your profile, to other users, or in emails. Only authorised Orrbbit administrators can view them.</Text>
                <Text style={styles.label}>Full Legal Name</Text>
                <TextInput testID="ver-name" style={styles.input} value={fullName} onChangeText={setFullName} placeholder="As shown on your ID" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.label}>Primary ID Type</Text>
                {pills(ID_TYPES, (o) => idType === o, setIdType, "ver-id")}
                <Text style={styles.label}>Add ID Documents ({idDocs.length}/2 minimum)</Text>
                {pills(ID_TYPES, (o) => idDraftType === o, setIdDraftType, "ver-iddoc")}
                {idDraftType === "Other" && (
                  <TextInput testID="ver-iddoc-other" style={[styles.input, { marginTop: spacing.sm }]} value={idOtherLabel} onChangeText={setIdOtherLabel}
                    placeholder="Please specify the document type" placeholderTextColor={colors.textTertiary} />
                )}
                <SecondaryButton testID="ver-add-iddoc" title="Upload ID Document" onPress={addIdDoc} style={{ marginTop: spacing.md, minHeight: 44 }} />
                {idDocs.map((d, i) => (
                  <View key={i} style={styles.docRow} testID={`ver-iddoc-row-${i}`}>
                    <Ionicons name="id-card" size={15} color={colors.teal} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{d.doc_name}</Text>
                      <Text style={styles.docMeta}>{d.file_name}</Text>
                    </View>
                    <Pressable testID={`ver-iddoc-remove-${i}`} onPress={() => setIdDocs(idDocs.filter((_, j) => j !== i))} hitSlop={8}>
                      <Text style={{ color: colors.pink, fontSize: 12, fontWeight: "800" }}>REMOVE</Text>
                    </Pressable>
                  </View>
                ))}

                <Text style={styles.helper}>Documents are never shown to other users — Orrbbit administrators only. Approval is manual.</Text>
                {error && <Text testID="ver-error" style={styles.error}>{error}</Text>}
                <PrimaryButton testID="ver-submit" title="Submit for Review" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
              </>
            )}
          </>
        ) : (
          <Text style={styles.helper}>
            {status.status === "Pending Review"
              ? "Your submission is with our review team. You'll see the outcome here."
              : "Your verification is active. Credential expiry is monitored automatically — you'll be reminded 90, 60 and 30 days before anything expires."}
          </Text>
        )}
      </ScrollView>

      <Modal visible={uploadNoticeVisible} transparent animationType="fade" onRequestClose={() => setUploadNoticeVisible(false)}>
        <View style={styles.noticeOverlay}>
          <View style={styles.noticeCard} testID="credential-upload-notice">
            <View style={styles.noticeIcon}>
              <Ionicons name="document-lock" size={24} color={colors.teal} />
            </View>
            <Text style={styles.noticeTitle}>Before you upload credentials</Text>
            <Text style={styles.noticeText}>
              Your documents are used only to verify your professional credentials. They are stored
              securely, never shown to other users, and reviewed by the Orrbbit verification team.
              Only your verification badge and status are visible to others.
            </Text>
            <Text style={styles.noticeText}>
              Once verified, your credentials will be reviewed annually to help keep professional
              information current. Credentials may remain valid for up to 2 years, subject to their
              actual expiry date and Orrbbit&rsquo;s annual review. Verification is not an endorsement
              or guarantee.
            </Text>
            <Pressable testID="credential-notice-continue" style={styles.noticeBtn} onPress={acceptUploadNotice}>
              <Text style={styles.noticeBtnText}>Continue</Text>
            </Pressable>
            <Pressable testID="credential-notice-cancel" style={styles.noticeCancel} onPress={() => setUploadNoticeVisible(false)}>
              <Text style={styles.noticeCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  statusText: { fontSize: font.lg, fontWeight: "800" },
  statusMeta: { color: colors.textSecondary, fontSize: font.sm },
  statusNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, fontStyle: "italic" },
  step: { color: colors.teal, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xl },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  pill: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, minHeight: 36, justifyContent: "center" },
  pillActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  pillText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
  pillTextActive: { color: "#FFF", fontWeight: "700" },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: font.base, color: colors.text, minHeight: 52, backgroundColor: colors.card },
  docList: { marginTop: spacing.xs },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  docName: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  docMeta: { color: colors.textSecondary, fontSize: 11 },
  notifBox: { backgroundColor: colors.orangeSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, gap: 6 },
  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  notifText: { color: colors.text, fontSize: 11, flex: 1, lineHeight: 15 },
  helper: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 19, marginTop: spacing.md },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.md },
  noticeOverlay: { flex: 1, backgroundColor: "rgba(8,26,53,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  noticeCard: { backgroundColor: "#FFF", borderRadius: radius.lg, padding: spacing.xl, width: "100%", maxWidth: 380 },
  noticeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.tealSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  noticeTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  noticeText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 22, marginTop: spacing.md },
  noticeBtn: { backgroundColor: colors.teal, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: spacing.xl, minHeight: 48, justifyContent: "center" },
  noticeBtnText: { color: "#FFF", fontWeight: "800", fontSize: font.base },
  noticeCancel: { alignItems: "center", paddingVertical: 12, marginTop: spacing.sm, minHeight: 44, justifyContent: "center" },
  noticeCancelText: { color: colors.textSecondary, fontWeight: "600" },
});

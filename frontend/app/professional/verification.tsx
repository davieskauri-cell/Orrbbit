import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const ID_TYPES = ["Passport", "Driver licence", "Government ID"];

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api<any>("/verification/status").then(setStatus).catch(() => {});
    api<any>("/config").then((c) => setProfessions(c.professions || {})).catch(() => {});
    api<any[]>("/notifications").then((n) => setNotifications(n.filter((x) => x.type.startsWith("verification")).slice(0, 5))).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const pickFile = async () => {
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
    } catch (e: any) {
      showAlert("Couldn't attach file", e.message || "Try again.");
    }
  };

  const addDoc = () => {
    setError(null);
    if (!draft.doc_name.trim()) { setError("Each document needs a name."); return; }
    if (docs.length >= 10) { setError("Maximum 10 documents."); return; }
    setDocs([...docs, draft]);
    setDraft(emptyDoc());
  };

  const submit = async () => {
    setError(null);
    if (!profession) return setError("Step 1: choose your profession.");
    if (categories.length === 0) return setError("Step 2: pick at least one category.");
    if (docs.length === 0) return setError("Step 3: add at least one credential document.");
    if (!fullName.trim() || !idType) return setError("Add your full legal name and ID type.");
    setBusy(true);
    try {
      await api("/verification/submit", {
        method: "POST",
        body: { profession, categories, full_name: fullName.trim(), id_type: idType, documents: docs.map((d) => ({ ...d, expiry_date: d.expiry_date || null })) },
      });
      setShowForm(false);
      setDocs([]);
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
            {!!status.valid_until && (
              <Text style={[styles.statusMeta, status.credential_status === "Expiring Soon" && { color: colors.warning, fontWeight: "700" }]} testID="ver-valid-until">
                Valid until {fmtDate(status.valid_until)}{status.credential_status === "Expiring Soon" ? " · Expiring Soon" : ""}
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
                <Text style={styles.step}>STEP 1 · CHOOSE PROFESSION</Text>
                {pills(Object.keys(professions), (o) => profession === o, (o) => { setProfession(o); setCategories([]); }, "ver-prof")}

                {!!profession && (
                  <>
                    <Text style={styles.step}>STEP 2 · CHOOSE CATEGORIES</Text>
                    <Text style={styles.helper}>You can only offer services inside your verified categories.</Text>
                    {pills(catOptions, (o) => categories.includes(o), (o) => setCategories(categories.includes(o) ? categories.filter((c) => c !== o) : [...categories, o]), "ver-cat")}
                  </>
                )}

                <Text style={styles.step}>STEP 3 · UPLOAD CREDENTIALS</Text>
                <Text style={styles.helper}>PDF, JPG or PNG · up to 10 documents · degrees, licences, registrations, memberships, insurance, checks.</Text>
                <SecondaryButton testID="ver-pick-file" title={draft.file_name ? `📎 ${draft.file_name}` : "Attach File (optional)"} onPress={pickFile} style={{ marginTop: spacing.md, minHeight: 44 }} />

                <Text style={styles.step}>STEP 4 · DOCUMENT DETAILS</Text>
                {field("doc_name", "Document Name *", "e.g. CIPD Level 7 Certificate")}
                {field("issuer", "Issuing Organisation", "e.g. CIPD")}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {field("issue_date", "Issue Date", "YYYY-MM-DD")}
                  {field("expiry_date", "Expiry Date (optional)", "YYYY-MM-DD")}
                </View>
                {field("doc_number", "Document Number (optional)", "e.g. #12345")}
                {field("notes", "Notes (optional)", "Anything the reviewer should know")}
                <SecondaryButton testID="ver-add-doc" title="+ Add Document" onPress={addDoc} style={{ marginTop: spacing.md, minHeight: 44 }} />

                {docs.map((d, i) => (
                  <View key={i} style={styles.docRow} testID={`ver-doc-row-${i}`}>
                    <Ionicons name="document-text" size={15} color={colors.teal} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{d.doc_name}{d.file_name ? ` · ${d.file_name}` : ""}</Text>
                      <Text style={styles.docMeta}>{[d.issuer, d.expiry_date ? `Expires ${d.expiry_date}` : null].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Pressable onPress={() => setDocs(docs.filter((_, j) => j !== i))} hitSlop={8}>
                      <Ionicons name="close" size={15} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}

                <Text style={styles.step}>IDENTITY</Text>
                <Text style={styles.label}>Full Legal Name</Text>
                <TextInput testID="ver-name" style={styles.input} value={fullName} onChangeText={setFullName} placeholder="As shown on your ID" placeholderTextColor={colors.textTertiary} />
                <Text style={styles.label}>ID Type</Text>
                {pills(ID_TYPES, (o) => idType === o, setIdType, "ver-id")}

                <Text style={styles.helper}>Documents are never shown to other users — IntroYu administrators only. Approval is manual.</Text>
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
});

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from "react-native";
import Shell from "../../src/control/Shell";
import { useCC } from "../../src/control/ControlContext";
import { CC } from "../../src/control/theme";
import { Card, SectionTitle, Badge, Btn, Chip, Loading, EmptyText } from "../../src/control/ui";

const FILTERS = ["Pending Review", "More Info Required", "Verified", "Rejected", "Suspended", "All"];

/** Dedicated BUSINESS verification queue — fully separate from Professional verification. */
export default function ControlBusinessVerification() {
  const { req } = useCC();
  const [filter, setFilter] = useState("Pending Review");
  const [rows, setRows] = useState<any[] | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = filter === "All" ? "" : `?status=${encodeURIComponent(filter)}`;
    req(`/control/businesses${p}`).then((r: any) => setRows(r.businesses)).catch(() => setRows([]));
  }, [req, filter]);
  useEffect(() => { load(); }, [load]);

  const open = (b: any) => {
    setSel(b); setDetail(null); setMsg(null); setNote("");
    req(`/control/businesses/${b.id}`).then(setDetail).catch(() => {});
  };

  const act = async (action: string) => {
    try {
      const r: any = await req(`/control/businesses/${sel.id}/verification`, {
        method: "POST", body: JSON.stringify({ action, note: note.trim() }) });
      setMsg(`✓ ${action} → ${r.status} · in-app: ${r.communication?.notification} · email: ${r.communication?.email}`);
      load(); open(sel);
    } catch (e: any) { setMsg(`✗ ${e?.message || "action failed"}`); }
  };

  return (
    <Shell title="Business Verification">
      {!sel ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {FILTERS.map((f) => <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} testID={`bv-filter-${f}`} />)}
          </ScrollView>
          <Card>
            <SectionTitle>Business applications ({rows?.length ?? "…"})</SectionTitle>
            {rows === null ? <Loading /> : rows.length === 0 ? <EmptyText icon="shield-outline">No businesses in this state.</EmptyText> :
              rows.map((b) => (
                <Pressable key={b.id} testID={`bv-row-${b.id}`} onPress={() => open(b)} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{b.name}</Text>
                    <Text style={st.meta}>{b.category} · {b.country || "country n/a"} · {b.location} · joined {String(b.created_at || "").slice(0, 10)}</Text>
                  </View>
                  <Badge label={b.verification_status} status={b.verification_status === "Verified" ? "approved" : b.verification_status === "Pending Review" ? "pending" : "rejected"} />
                </Pressable>
              ))}
          </Card>
        </>
      ) : (
        <>
          <Pressable onPress={() => setSel(null)} style={{ marginBottom: 10 }}><Text style={{ color: CC.teal, fontWeight: "700" }}>← Back to queue</Text></Pressable>
          <Card>
            <SectionTitle>{sel.name}</SectionTitle>
            {!!msg && <Text style={st.msg}>{msg}</Text>}
            {!detail ? <Loading /> : (
              <>
                <Text style={st.kv}>Status: {detail.business.verification_status} · Country: {detail.business.country || "—"}</Text>
                <Text style={st.kv}>Owner: {detail.owner.email} · Business email: {detail.business.email} · Phone: {detail.business.phone || "—"}</Text>
                <Text style={st.kv}>Address: {detail.business.location_display} · Website: {detail.business.website || "—"}</Text>
                {(detail.verifications || []).map((v: any) => (
                  <View key={v.id} style={st.box}>
                    <Text style={st.kv}>Legal name: {v.legal_name} · {v.registration_label || "Registration"}: {v.abn || "—"}</Text>
                    <Text style={st.kv}>Primary contact: {v.primary_contact || "—"} · Phone: {v.phone || "—"}</Text>
                    <Text style={st.kv}>Document (admin-only): {v.document_name || "—"}</Text>
                    <Text style={st.kv}>Submitted: {String(v.submitted_at).slice(0, 16)} · Status: {v.status}
                      {v.reviewed_at ? ` · Reviewed ${String(v.reviewed_at).slice(0, 16)} by ${v.reviewer}` : ""}</Text>
                    {(v.history || []).map((h: any, i: number) => (
                      <Text key={i} style={st.meta}>• {String(h.at).slice(0, 16)} — {h.action}{h.by ? ` by ${h.by}` : ""}{h.note ? ` — ${h.note}` : ""}</Text>
                    ))}
                  </View>
                ))}
                <TextInput value={note} onChangeText={setNote} placeholder="Internal note / message to the business" placeholderTextColor={CC.sub} style={st.input} testID="bv-note" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <Btn title="Approve" onPress={() => act("approve")} testID="bv-approve" />
                  <Btn title="Request More Info" variant="outline" onPress={() => act("more_info")} />
                  <Btn title="Reject" variant="danger" onPress={() => act("reject")} />
                  <Btn title="Suspend" variant="danger" onPress={() => act("suspend")} />
                  <Btn title="Reinstate" variant="outline" onPress={() => act("reinstate")} />
                </View>
                <Text style={st.meta}>Every action is audited and triggers the central in-app + email pipeline.</Text>
              </>
            )}
          </Card>
        </>
      )}
    </Shell>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: CC.border },
  name: { color: CC.text, fontWeight: "800", fontSize: 14 },
  meta: { color: CC.sub, fontSize: 12, marginTop: 2 },
  kv: { color: CC.text, fontSize: 13, marginTop: 4 },
  box: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, padding: 10, marginTop: 8 },
  input: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: CC.text, marginTop: 10 },
  msg: { color: CC.tealDark, fontSize: 12, fontWeight: "700", marginVertical: 6 },
});

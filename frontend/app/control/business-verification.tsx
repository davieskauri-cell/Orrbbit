import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from "react-native";
import Shell from "../../src/control/Shell";
import { useCC } from "../../src/control/ControlContext";
import { CC } from "../../src/control/theme";
import { Card, SectionTitle, Btn, Loading, EmptyText } from "../../src/control/ui";
import { showAlert } from "../../src/lib/alert";

const TABS = [
  { label: "In Progress", value: "In Progress" },
  { label: "Pending", value: "Pending Review" },
  { label: "In Review", value: "In Review" },
  { label: "More Info", value: "More Info Required" },
  { label: "Verified", value: "Verified" },
  { label: "Rejected", value: "Rejected" },
  { label: "Suspended", value: "Suspended" },
  { label: "Revoked", value: "Revoked" },
  { label: "Reverification", value: "Reverification Required" },
  { label: "All", value: "All" },
];

const PILL: Record<string, { bg: string; fg: string }> = {
  "In Progress": { bg: "#E2E8F0", fg: "#334155" },
  "Not Submitted": { bg: "#E2E8F0", fg: "#334155" },
  "Pending Review": { bg: "#FEF3C7", fg: "#B45309" },
  "In Review": { bg: "#DBEAFE", fg: "#1D4ED8" },
  "More Info Required": { bg: "#FFEDD5", fg: "#C2410C" },
  Verified: { bg: "#DCFCE7", fg: "#15803D" },
  Rejected: { bg: "#FEE2E2", fg: "#B91C1C" },
  Suspended: { bg: "#FEE2E2", fg: "#B91C1C" },
  Revoked: { bg: "#FEE2E2", fg: "#B91C1C" },
  "Reverification Required": { bg: "#FFEDD5", fg: "#C2410C" },
};

function StatusPill({ status }: { status: string }) {
  const c = PILL[status] || { bg: CC.border, fg: CC.sub };
  const label = status === "Pending Review" ? "Pending" : status === "More Info Required" ? "More Info" : status;
  return (
    <View style={[st.pill, { backgroundColor: c.bg }]}>
      <Text style={[st.pillTxt, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Dedicated BUSINESS verification queue — fully separate from Professional verification. */
export default function ControlBusinessVerification() {
  const { req } = useCC();
  const [filter, setFilter] = useState("Pending Review");
  const [rows, setRows] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [countryFilter, setCountryFilter] = useState("All Countries");
  const [sel, setSel] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = filter === "All" ? "" : `?status=${encodeURIComponent(filter)}`;
    req(`/control/businesses${p}`).then((r: any) => setRows(r.businesses)).catch(() => setRows([]));
    req(`/control/businesses`).then((r: any) => {
      const c: Record<string, number> = {};
      (r.businesses || []).forEach((b: any) => { c[b.verification_status] = (c[b.verification_status] || 0) + 1; });
      setCounts(c);
    }).catch(() => {});
  }, [req, filter]);
  useEffect(() => { load(); }, [load]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    (rows || []).forEach((b) => { if (b.country) set.add(b.country); });
    return ["All Countries", ...Array.from(set).sort()];
  }, [rows]);

  const visible = useMemo(() => (rows || []).filter((b) => {
    if (countryFilter !== "All Countries" && b.country !== countryFilter) return false;
    if (q.trim() && !`${b.name} ${b.category} ${b.location}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [rows, q, countryFilter]);

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

  const confirmAct = (action: string, label: string) => {
    showAlert(
      `${label} this business?`,
      `${sel?.name} — this action notifies the business and is permanently audited.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: label, style: "destructive", onPress: () => act(action) },
      ]
    );
  };

  return (
    <Shell title="Business Verification">
      {!sel ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 10 }}>
            {TABS.map((t) => {
              const on = filter === t.value;
              const n = t.value === "All" ? undefined : counts[t.value];
              return (
                <Pressable key={t.value} testID={`bv-filter-${t.value}`} onPress={() => setFilter(t.value)} style={[st.tab, on && st.tabOn]}>
                  <Text style={[st.tabTxt, on && st.tabTxtOn]}>{t.label}{n ? ` (${n})` : ""}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={st.toolRow}>
            <View style={st.searchBox}>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search businesses…"
                placeholderTextColor={CC.sub}
                style={st.searchInput}
                testID="bv-search"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {countries.map((c) => (
                <Pressable key={c} onPress={() => setCountryFilter(c)} style={[st.cChip, countryFilter === c && st.cChipOn]}>
                  <Text style={[st.cChipTxt, countryFilter === c && { color: "#FFF" }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Card>
            <SectionTitle>Business applications ({rows === null ? "…" : visible.length})</SectionTitle>
            <View style={st.thead}>
              <Text style={[st.th, { flex: 2 }]}>Business Name</Text>
              <Text style={[st.th, { flex: 1.2 }]}>Category</Text>
              <Text style={[st.th, { flex: 1.6 }]}>Location</Text>
              <Text style={[st.th, { flex: 1.1 }]}>Submitted</Text>
              <Text style={[st.th, { width: 84, textAlign: "right" }]}>Status</Text>
            </View>
            {rows === null ? <Loading /> : visible.length === 0 ? <EmptyText icon="shield-outline">No businesses in this state.</EmptyText> :
              visible.map((b) => (
                <Pressable key={b.id} testID={`bv-row-${b.id}`} onPress={() => open(b)} style={st.row}>
                  <Text style={[st.name, { flex: 2 }]} numberOfLines={1}>{b.name}</Text>
                  <Text style={[st.cell, { flex: 1.2 }]} numberOfLines={1}>{b.category}</Text>
                  <Text style={[st.cell, { flex: 1.6 }]} numberOfLines={1}>{b.location || "—"}{b.country ? `, ${b.country}` : ""}</Text>
                  <Text style={[st.cell, { flex: 1.1 }]} numberOfLines={1}>{String(b.submitted_at || b.created_at || "").slice(0, 10)}</Text>
                  <View style={{ width: 84, alignItems: "flex-end" }}><StatusPill status={b.verification_status} /></View>
                </Pressable>
              ))}
          </Card>
        </>
      ) : (
        <>
          <Pressable onPress={() => setSel(null)} style={{ marginBottom: 10, minHeight: 32, justifyContent: "center" }}>
            <Text style={{ color: CC.teal, fontWeight: "700" }}>← Back to queue</Text>
          </Pressable>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <SectionTitle>{sel.name}</SectionTitle>
              {detail && <StatusPill status={detail.business.verification_status} />}
            </View>
            {!!msg && <Text style={st.msg}>{msg}</Text>}
            {!detail ? <Loading /> : (
              <>
                <View style={st.kvGrid}>
                  {[
                    ["Business Name", detail.business.name],
                    ["Category", detail.business.category],
                    ["Country", detail.business.country || "—"],
                    ["Business Address", detail.business.location_display],
                    ["Business Email", detail.business.email],
                    ["Business Phone", detail.business.phone || "—"],
                    ["Website", detail.business.website || "—"],
                    ["Owner account", detail.owner.email],
                    ["Account State", detail.owner.admin_status || "active"],
                    ["Active Events", String((detail.events || []).filter((e: any) => ["active", "full"].includes(e.status)).length)],
                    ["Reviews", `${detail.review_count ?? 0}${detail.average_rating != null ? ` · avg ${detail.average_rating}` : ""}`],
                  ].map(([k, v]) => (
                    <View key={k as string} style={st.kvItem}>
                      <Text style={st.kvKey}>{k}</Text>
                      <Text style={st.kvVal}>{v}</Text>
                    </View>
                  ))}
                </View>
                {(() => {
                  const s = detail.business.subscription || { status: "not_subscribed" };
                  const bad = ["cancelled", "expired", "billing_issue"].includes(s.status);
                  return (
                    <View style={[st.box, bad && { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]} testID="bv-subscription">
                      <Text style={[st.kv, { fontWeight: "800" }]}>Subscription: <Text style={{ color: bad ? "#B91C1C" : s.status === "active" ? "#15803D" : CC.sub, textTransform: "capitalize" }}>{String(s.status).replace("_", " ")}</Text></Text>
                      <Text style={st.meta}>
                        {s.started_at ? `Started ${String(s.started_at).slice(0, 10)} · ` : ""}
                        {s.renews_at ? `Renews ${String(s.renews_at).slice(0, 10)} · ` : ""}
                        Platform: {s.platform || "—"}
                      </Text>
                      {bad && <Text style={[st.meta, { color: "#B91C1C", fontWeight: "700" }]}>⚠ Subscription is {String(s.status).replace("_", " ")} — Business publishing may be blocked.</Text>}
                    </View>
                  );
                })()}
                {(detail.verifications || []).map((v: any) => (
                  <View key={v.id} style={st.box}>
                    <Text style={st.kv}>Legal name: {v.legal_name} · {v.registration_label || "Registration"}: {v.abn || "—"}</Text>
                    <Text style={st.kv}>Primary contact: {v.primary_contact || "—"} · Phone: {v.phone || "—"}</Text>
                    <Text style={st.kv}>Supporting documents (admin-only): {v.document_name || "—"}</Text>
                    <Text style={st.kv}>Submitted: {String(v.submitted_at).slice(0, 16)} · Status: {v.status}
                      {v.reviewed_at ? ` · Reviewed ${String(v.reviewed_at).slice(0, 16)} by ${v.reviewer}` : ""}</Text>
                    {(v.history || []).map((h: any, i: number) => (
                      <Text key={i} style={st.meta}>• {String(h.at).slice(0, 16)} — {h.action}{h.by ? ` by ${h.by}` : ""}{h.note ? ` — ${h.note}` : ""}</Text>
                    ))}
                  </View>
                ))}
                <TextInput value={note} onChangeText={setNote} placeholder="Internal note / message to the business" placeholderTextColor={CC.sub} style={st.input} testID="bv-note" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <Btn title="Start Review" variant="outline" onPress={() => act("start_review")} testID="bv-start-review" />
                  <Btn title="Approve" onPress={() => act("approve")} testID="bv-approve" />
                  <Btn title="Request More Info" variant="outline" onPress={() => act("more_info")} />
                  <Btn title="Request Reverification" variant="outline" onPress={() => act("request_reverification")} />
                  <Btn title="Reject" variant="danger" onPress={() => confirmAct("reject", "Reject")} />
                  <Btn title="Suspend" variant="danger" onPress={() => confirmAct("suspend", "Suspend")} />
                  <Btn title="Revoke" variant="danger" onPress={() => confirmAct("revoke", "Revoke")} />
                  <Btn title="Reinstate" variant="outline" onPress={() => act("reinstate")} />
                </View>
                <Text style={st.meta}>Every action is audited and triggers the central in-app + email pipeline.</Text>
                {(detail.events || []).length > 0 && (
                  <View style={st.box}>
                    <Text style={[st.kv, { fontWeight: "800" }]}>Events ({(detail.events || []).length})</Text>
                    {(detail.events || []).slice(0, 5).map((e: any) => (
                      <Text key={e.id} style={st.meta}>• {e.title} · {e.category} · {e.status} · {String(e.start_datetime).slice(0, 10)}</Text>
                    ))}
                  </View>
                )}
                {(detail.emails || []).length > 0 && (
                  <View style={st.box}>
                    <Text style={[st.kv, { fontWeight: "800" }]}>Email Records ({(detail.emails || []).length})</Text>
                    {(detail.emails || []).slice(0, 5).map((m: any, i: number) => (
                      <Text key={i} style={st.meta}>• {String(m.created_at || "").slice(0, 16)} — {m.template_key || m.key || m.subject || "email"} · {m.status}</Text>
                    ))}
                  </View>
                )}
                {(detail.audit || []).length > 0 && (
                  <View style={st.box}>
                    <Text style={[st.kv, { fontWeight: "800" }]}>Audit History ({(detail.audit || []).length})</Text>
                    {(detail.audit || []).slice(0, 5).map((a: any, i: number) => (
                      <Text key={i} style={st.meta}>• {String(a.created_at || "").slice(0, 16)} — {a.action}{a.admin_email ? ` by ${a.admin_email}` : ""}{a.reason ? ` — ${a.reason}` : ""}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </Shell>
  );
}

const st = StyleSheet.create({
  tab: { borderWidth: 1, borderColor: CC.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minHeight: 32, justifyContent: "center" },
  tabOn: { backgroundColor: CC.teal, borderColor: CC.teal },
  tabTxt: { color: CC.sub, fontSize: 12, fontWeight: "700" },
  tabTxtOn: { color: "#FFF" },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  searchBox: { flexGrow: 1, minWidth: 200 },
  searchInput: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: CC.text, fontSize: 13, backgroundColor: CC.surface },
  cChip: { borderWidth: 1, borderColor: CC.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  cChipOn: { backgroundColor: CC.teal, borderColor: CC.teal },
  cChipTxt: { color: CC.sub, fontSize: 11, fontWeight: "700" },
  thead: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: CC.border },
  th: { color: CC.sub, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: CC.border },
  name: { color: CC.text, fontWeight: "800", fontSize: 13 },
  cell: { color: CC.sub, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" },
  pillTxt: { fontSize: 11, fontWeight: "800" },
  meta: { color: CC.sub, fontSize: 12, marginTop: 4 },
  kv: { color: CC.text, fontSize: 13, marginTop: 4 },
  kvGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  kvItem: { minWidth: 200, flexGrow: 1 },
  kvKey: { color: CC.sub, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  kvVal: { color: CC.text, fontSize: 13, marginTop: 2 },
  box: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, padding: 10, marginTop: 10 },
  input: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: CC.text, marginTop: 10 },
  msg: { color: CC.tealDark, fontSize: 12, fontWeight: "700", marginVertical: 6 },
});

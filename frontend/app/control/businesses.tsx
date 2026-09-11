import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from "react-native";
import Shell from "../../src/control/Shell";
import { useCC } from "../../src/control/ControlContext";
import { CC } from "../../src/control/theme";
import { Card, SectionTitle, Badge, Btn, Chip, Loading, EmptyText } from "../../src/control/ui";

const V_FILTERS = ["All", "Pending Review", "Verified", "More Info Required", "Rejected", "Suspended"];
const SUB_FILTERS = [{ k: "", l: "Any subscription" }, { k: "active", l: "Active Subscription" }, { k: "expired", l: "Expired Subscription" }];
const R_FILTERS = ["All", "Reported", "Visible", "Removed"];

export default function ControlBusinesses() {
  const { req } = useCC();
  const [rows, setRows] = useState<any[] | null>(null);
  const [status, setStatus] = useState("All");
  const [sub, setSub] = useState("");
  const [sel, setSel] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"overview" | "verification" | "events" | "reviews" | "subscription" | "audit">("overview");
  const [revFilter, setRevFilter] = useState("All");
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (status !== "All") p.set("status", status);
    if (sub) p.set("subscription", sub);
    req(`/businesses?${p}`).then((r: any) => setRows(r.businesses)).catch(() => setRows([]));
  }, [req, status, sub]);
  useEffect(() => { load(); }, [load]);

  const openDetail = (b: any) => {
    setSel(b); setDetail(null); setTab("overview"); setMsg(null);
    req(`/businesses/${b.id}`).then(setDetail).catch(() => {});
  };

  const verify = async (action: string) => {
    try {
      const r: any = await req(`/businesses/${sel.id}/verification`, {
        method: "POST", body: JSON.stringify({ action, note: note.trim() }) });
      setMsg(`✓ ${action} → ${r.status} · notification: ${r.communication?.notification} · email: ${r.communication?.email}`);
      setNote(""); load(); openDetail({ ...sel });
    } catch (e: any) { setMsg(`✗ ${e?.message || "action failed"}`); }
  };

  const loadReviews = useCallback(() => {
    req(`/business-reviews?filter=${revFilter}`).then((r: any) => setReviews(r.reviews)).catch(() => setReviews([]));
  }, [req, revFilter]);
  useEffect(() => { if (tab === "reviews") loadReviews(); }, [tab, loadReviews]);

  const reviewAction = async (id: string, action: "remove" | "restore") => {
    try {
      await req(`/business-reviews/${id}/action`, { method: "POST", body: JSON.stringify({ action, reason: action === "remove" ? "Admin moderation" : "" }) });
      loadReviews(); setMsg(`✓ review ${action}d (audited)`);
    } catch (e: any) { setMsg(`✗ ${e?.message}`); }
  };

  return (
    <Shell title="Businesses">
      {!sel ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
            {V_FILTERS.map((f) => <Chip key={f} label={f} active={status === f} onPress={() => setStatus(f)} testID={`bizfilter-${f}`} />)}
            {SUB_FILTERS.map((f) => <Chip key={f.k} label={f.l} active={sub === f.k} onPress={() => setSub(f.k)} />)}
          </ScrollView>
          <Card>
            <SectionTitle>Business accounts ({rows?.length ?? "…"})</SectionTitle>
            {rows === null ? <Loading /> : rows.length === 0 ? <EmptyText icon="storefront-outline">No businesses match this filter.</EmptyText> :
              rows.map((b) => (
                <Pressable key={b.id} testID={`bizrow-${b.id}`} onPress={() => openDetail(b)} style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{b.name}</Text>
                    <Text style={st.meta}>{b.category} · {b.location} · joined {String(b.created_at || "").slice(0, 10)}</Text>
                    <Text style={st.meta}>Events: {b.active_events} active · Rating: {b.average_rating ?? "—"} ({b.review_count}) · Account: {b.account_status}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Badge label={b.verification_status} status={b.verification_status === "Verified" ? "approved" : b.verification_status === "Pending Review" ? "pending" : "rejected"} />
                    <Badge label={b.subscription_status} status={["active", "grace"].includes(b.subscription_status) ? "approved" : "pending"} />
                  </View>
                </Pressable>
              ))}
          </Card>
        </>
      ) : (
        <>
          <Pressable onPress={() => { setSel(null); setMsg(null); }} style={{ marginBottom: 10 }}><Text style={{ color: CC.teal, fontWeight: "700" }}>← Back to Businesses</Text></Pressable>
          <Card>
            <SectionTitle>{sel.name}</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
              {(["overview", "verification", "events", "reviews", "subscription", "audit"] as const).map((t) => (
                <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} testID={`biztab-${t}`} />
              ))}
            </ScrollView>
            {!!msg && <Text style={st.msg}>{msg}</Text>}
            {!detail ? <Loading /> : (
              <>
                {tab === "overview" && (
                  <View>
                    <Text style={st.kv}>Category: {detail.business.category} · {detail.business.location_display}</Text>
                    <Text style={st.kv}>Owner: {detail.owner.email} ({detail.owner.admin_status})</Text>
                    <Text style={st.kv}>Verification: {detail.business.verification_status}</Text>
                    <Text style={st.kv}>Subscription: {(detail.business.subscription || {}).status || "not_subscribed"}</Text>
                    <Text style={st.kv}>Rating: {detail.average_rating ?? "—"} · {detail.review_count} reviews · Profile views: {detail.business.profile_views}</Text>
                    <Text style={st.kv}>Description: {detail.business.description}</Text>
                  </View>
                )}
                {tab === "verification" && (
                  <View>
                    {detail.verifications.length === 0 ? <EmptyText icon="shield-outline">No verification submissions yet.</EmptyText> :
                      detail.verifications.map((v: any) => (
                        <View key={v.id} style={st.verBox}>
                          <Text style={st.kv}>Legal name: {v.legal_name} · ABN: {v.abn || "—"}</Text>
                          <Text style={st.kv}>Email: {v.email} · Website: {v.website || "—"}</Text>
                          <Text style={st.kv}>Address: {v.address || "—"}</Text>
                          <Text style={st.kv}>Document (admin-only): {v.document_name || "—"}</Text>
                          <Text style={st.kv}>Status: {v.status} · submitted {String(v.submitted_at).slice(0, 16)}</Text>
                        </View>
                      ))}
                    <TextInput value={note} onChangeText={setNote} placeholder="Note to the business (included in notification/email)" placeholderTextColor={CC.sub} style={st.input} testID="bizver-note" />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      <Btn title="Approve" onPress={() => verify("approve")} testID="bizver-approve" />
                      <Btn title="More Info" variant="outline" onPress={() => verify("more_info")} />
                      <Btn title="Reject" variant="danger" onPress={() => verify("reject")} />
                      <Btn title="Suspend" variant="danger" onPress={() => verify("suspend")} />
                      <Btn title="Reinstate" variant="outline" onPress={() => verify("reinstate")} />
                      <Btn title="Revoke" variant="danger" onPress={() => verify("revoke")} />
                    </View>
                  </View>
                )}
                {tab === "events" && (
                  detail.events.length === 0 ? <EmptyText icon="flame-outline">No events hosted.</EmptyText> :
                    detail.events.map((e: any) => (
                      <View key={e.id} style={st.verBox}>
                        <Text style={st.name}>{e.title}</Text>
                        <Text style={st.meta}>{e.category} · {String(e.start_datetime).slice(0, 16)} · {e.status}{e.cancellation_reason ? ` — ${e.cancellation_reason}` : ""}</Text>
                      </View>
                    ))
                )}
                {tab === "subscription" && (
                  <View>
                    <Text style={st.kv}>Status: {(detail.business.subscription || {}).status || "not_subscribed"}</Text>
                    <Text style={st.kv}>Product: orrbbit_business_monthly · $5.99/month</Text>
                    <Text style={st.kv}>Platform: {(detail.business.subscription || {}).platform || "—"} · Renews: {(detail.business.subscription || {}).renews_at || "—"}</Text>
                    <Text style={st.meta}>View-only. Entitlement changes go through store billing — no manual paid subscriptions.</Text>
                  </View>
                )}
                {tab === "audit" && (
                  detail.audit.length === 0 ? <EmptyText icon="document-outline">No audit entries.</EmptyText> :
                    detail.audit.map((a: any) => (
                      <Text key={a.id} style={st.kv}>{String(a.at).slice(0, 16)} · {a.admin_email} · {a.action}</Text>
                    ))
                )}
              </>
            )}
            {tab === "reviews" && (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                  {R_FILTERS.map((f) => <Chip key={f} label={f} active={revFilter === f} onPress={() => setRevFilter(f)} testID={`revfilter-${f}`} />)}
                </ScrollView>
                {reviews === null ? <Loading /> : reviews.filter((r) => !sel || r.business_name === sel.name || true).map((r: any) => (
                  <View key={r.id} style={st.verBox}>
                    <Text style={st.name}>{"★".repeat(r.rating)} — {r.business_name}</Text>
                    <Text style={st.meta}>{r.text || r.tags?.join(", ") || "(no text)"} · by {r.reviewer_name} on {r.event_title}</Text>
                    <Text style={st.meta}>Status: {r.status}{r.reports?.length ? ` · ${r.reports.length} report(s)` : ""}{r.removed_reason ? ` · removed: ${r.removed_reason}` : ""}</Text>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                      {r.status === "visible"
                        ? <Btn title="Remove" variant="danger" onPress={() => reviewAction(r.id, "remove")} testID={`rev-remove-${r.id}`} />
                        : <Btn title="Restore" variant="outline" onPress={() => reviewAction(r.id, "restore")} testID={`rev-restore-${r.id}`} />}
                    </View>
                  </View>
                ))}
              </View>
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
  verBox: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, padding: 10, marginTop: 8 },
  input: { borderWidth: 1, borderColor: CC.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, color: CC.text, marginTop: 10 },
  msg: { color: CC.tealDark, fontSize: 12, fontWeight: "700", marginVertical: 6 },
});

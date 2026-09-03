import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font, shadow } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import {
  getEvent, joinEvent, leaveEvent, cancelEvent, eventAttendees, manageAttendee,
  reportEvent, EVENT_CATEGORY_ICONS, OrbEvent,
} from "@/src/services/eventService";

const REPORT_REASONS = ["Unsafe activity", "Harassment", "Spam", "Misleading event", "Inappropriate content", "Illegal activity", "Other"];

function when(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ev, setEv] = useState<OrbEvent | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [atts, setAtts] = useState<any[] | null>(null);
  const [isHostView, setIsHostView] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(() => {
    getEvent(String(id)).then(setEv).catch((e) => setError(e?.message || "Couldn't load this event"));
  }, [id]);
  useEffect(load, [load]);

  const loadAtts = () =>
    eventAttendees(String(id)).then((r) => { setAtts(r.attendees); setIsHostView(r.is_host); }).catch(() => setAtts([]));

  const doJoin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await joinEvent(String(id));
      showAlert(r.join_status === "pending" ? "Request sent" : "You're in 🎉",
        r.join_status === "pending" ? "The host will review your request." : "See you there. Meet people going in Attendees.");
      load();
      if (atts) loadAtts();
    } catch (e: any) { showAlert("Couldn't join", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  const doLeave = async () => {
    setBusy(true);
    try { await leaveEvent(String(id)); load(); if (atts) loadAtts(); }
    catch (e: any) { showAlert("Error", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  const doCancel = () => {
    showAlert("Cancel this event?", "Everyone who joined will be notified.", [
      { text: "Keep event", style: "cancel" },
      { text: "Cancel event", style: "destructive", onPress: async () => { await cancelEvent(String(id)).catch(() => {}); load(); } },
    ]);
  };

  const doShare = () => {
    if (!ev) return;
    Share.share({ message: `${ev.title} — ${when(ev.start_datetime)} on Orrbbit. ${ev.going} going. Open Orrbbit to join.` }).catch(() => {});
  };

  const doReport = async (reason: string) => {
    setReportOpen(false);
    try { await reportEvent(String(id), reason); showAlert("Report sent", "Thanks — our team will review this event."); }
    catch { showAlert("Error", "Couldn't send report. Please try again."); }
  };

  if (error) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.err}>{error}</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Text style={s.backTxt}>Back</Text></Pressable>
      </View>
    );
  }
  if (!ev) return <View style={s.center}><ActivityIndicator color={colors.teal} /></View>;

  const icon = EVENT_CATEGORY_ICONS[ev.category] || "flame";
  const joined = ev.my_status === "accepted";
  const pending = ev.my_status === "pending";
  const closed = ev.status === "cancelled" || ev.status === "completed";
  const full = ev.status === "full" && !joined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="event-back"><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>Event</Text>
        <Pressable onPress={doShare} hitSlop={10} testID="event-share"><Ionicons name="share-outline" size={22} color={colors.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 120 }}>
        <View style={[s.cover, shadow.card]}>
          <Ionicons name={icon as any} size={44} color={colors.orange} />
        </View>
        {ev.status === "cancelled" && <View style={s.cancelBanner} testID="cancelled-banner"><Text style={s.cancelTxt}>EVENT CANCELLED</Text></View>}
        {ev.status === "completed" && <View style={[s.cancelBanner, { backgroundColor: colors.tealSoft }]}><Text style={[s.cancelTxt, { color: colors.teal }]}>COMPLETED</Text></View>}
        <Text style={s.title} testID="event-title">{ev.title}</Text>
        <Text style={s.meta}>{ev.category} · {ev.join_type === "approval" ? "Approval required" : "Everyone"} · Approx. {ev.distance >= 1000 ? `${(ev.distance / 1000).toFixed(1)}km` : `${ev.distance}m`} away</Text>

        <View style={s.rows}>
          <Row icon="time-outline" text={`${when(ev.start_datetime)}  →  ${new Date(ev.end_datetime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`} />
          <Row icon="location-outline" text={ev.location_display} sub="Exact locations stay hidden until people meet" />
          <Row icon="people-outline" text={`${ev.going} going${ev.capacity ? ` · ${ev.spots_left} spot${ev.spots_left === 1 ? "" : "s"} left of ${ev.capacity}` : ""}`} />
        </View>

        {!!ev.description && <Text style={s.desc}>{ev.description}</Text>}

        <View style={s.hostRow}>
          <Avatar uri={ev.host.photo_url} name={ev.host.name} size={36} />
          <Text style={s.hostTxt}>Hosted by {ev.host.name}</Text>
          {ev.host.verified && <Ionicons name="checkmark-circle" size={16} color={colors.teal} />}
        </View>

        {/* attendees */}
        <Pressable testID="view-attendees" onPress={() => (atts ? setAtts(null) : loadAtts())} style={s.attToggle}>
          <Text style={s.attToggleTxt}>{atts ? "Hide attendees" : "View attendees"}</Text>
          <Ionicons name={atts ? "chevron-up" : "chevron-down"} size={16} color={colors.teal} />
        </Pressable>
        {atts && atts.length === 0 && (
          <Text style={s.emptyAtt}>No one has joined yet. Be the first person in.</Text>
        )}
        {atts && atts.map((a) => (
          <View key={a.id} style={s.attRow}>
            <Pressable style={s.attMain} onPress={() => router.push(`/person/${a.id}`)} testID={`attendee-${a.id}`}>
              <Avatar uri={a.photo_url} name={a.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={s.attName}>{a.name}{a.age ? `, ${a.age}` : ""}</Text>
                {a.join_status === "pending" ? <Text style={s.attPending}>Requested to join</Text> : null}
              </View>
            </Pressable>
            {isHostView && a.join_status === "pending" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable testID={`accept-${a.id}`} style={s.acceptBtn} onPress={() => manageAttendee(String(id), a.id, "accept").then(() => { loadAtts(); load(); })}><Text style={s.acceptTxt}>Accept</Text></Pressable>
                <Pressable testID={`decline-${a.id}`} style={s.declineBtn} onPress={() => manageAttendee(String(id), a.id, "decline").then(loadAtts)}><Text style={s.declineTxt}>Decline</Text></Pressable>
              </View>
            )}
            {isHostView && a.join_status === "accepted" && (
              <Pressable style={s.declineBtn} onPress={() => manageAttendee(String(id), a.id, "remove").then(() => { loadAtts(); load(); })}><Text style={s.declineTxt}>Remove</Text></Pressable>
            )}
          </View>
        ))}

        {/* host management */}
        {ev.is_host && !closed && (
          <View style={s.hostTools}>
            <Pressable testID="edit-event" style={s.toolBtn} onPress={() => router.push(`/create-event?id=${ev.id}`)}><Ionicons name="create-outline" size={16} color={colors.text} /><Text style={s.toolTxt}>Edit Event</Text></Pressable>
            <Pressable testID="cancel-event" style={s.toolBtn} onPress={doCancel}><Ionicons name="close-circle-outline" size={16} color="#DC2626" /><Text style={[s.toolTxt, { color: "#DC2626" }]}>Cancel Event</Text></Pressable>
          </View>
        )}
        {!ev.is_host && (
          <Pressable testID="report-event" style={s.reportLink} onPress={() => setReportOpen(true)}>
            <Ionicons name="flag-outline" size={14} color={colors.textSecondary} />
            <Text style={s.reportTxt}>Report event</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* sticky CTA */}
      {!ev.is_host && !closed && (
        <View style={[s.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {joined ? (
            <Pressable testID="leave-event" style={[s.cta, s.ctaJoined]} onPress={doLeave} disabled={busy}>
              <Ionicons name="checkmark" size={18} color={colors.teal} /><Text style={[s.ctaTxt, { color: colors.teal }]}>JOINED · Tap to leave</Text>
            </Pressable>
          ) : pending ? (
            <Pressable testID="leave-event" style={[s.cta, s.ctaJoined]} onPress={doLeave} disabled={busy}>
              <Text style={[s.ctaTxt, { color: colors.teal }]}>REQUEST SENT · Tap to withdraw</Text>
            </Pressable>
          ) : (
            <Pressable testID="join-event" style={[s.cta, full && { opacity: 0.5 }]} onPress={doJoin} disabled={busy || full}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>{full ? "EVENT FULL" : ev.join_type === "approval" ? "REQUEST TO JOIN" : "JOIN EVENT"}</Text>}
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={s.modalBg} onPress={() => setReportOpen(false)}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Report this event</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r} testID={`report-${r}`} style={s.reasonRow} onPress={() => doReport(r)}>
                <Text style={s.reasonTxt}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ icon, text, sub }: { icon: any; text: string; sub?: string }) {
  return (
    <View style={s.row}>
      <Ionicons name={icon} size={18} color={colors.teal} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTxt}>{text}</Text>
        {!!sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 12 },
  err: { color: colors.textSecondary, fontSize: font.base },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.teal, borderRadius: 999 },
  backTxt: { color: "#FFF", fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  cover: { height: 110, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  cancelBanner: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingVertical: 8, alignItems: "center", marginBottom: spacing.md },
  cancelTxt: { color: "#DC2626", fontWeight: "800", fontSize: font.sm },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4, marginBottom: spacing.lg },
  rows: { gap: 10, marginBottom: spacing.lg },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  rowTxt: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  rowSub: { color: colors.textTertiary, fontSize: font.micro, marginTop: 2 },
  desc: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, marginBottom: spacing.lg },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.lg },
  hostTxt: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  attToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 },
  attToggleTxt: { color: colors.teal, fontWeight: "700", fontSize: font.base },
  emptyAtt: { color: colors.textTertiary, fontSize: font.sm, paddingVertical: 8 },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  attMain: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  attName: { color: colors.text, fontWeight: "700", fontSize: font.base },
  attPending: { color: colors.orange, fontSize: font.micro, fontWeight: "600" },
  acceptBtn: { backgroundColor: colors.teal, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  acceptTxt: { color: "#FFF", fontWeight: "700", fontSize: font.sm },
  declineBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  declineTxt: { color: colors.textSecondary, fontWeight: "700", fontSize: font.sm },
  hostTools: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  toolBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toolTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  reportLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xl, alignSelf: "center" },
  reportTxt: { color: colors.textSecondary, fontSize: font.sm },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  cta: { backgroundColor: colors.orange, borderRadius: 999, minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaJoined: { backgroundColor: colors.tealSoft },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base, letterSpacing: 0.4 },
  modalBg: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: "#FFF", borderRadius: 18, padding: spacing.lg, width: "100%", maxWidth: 380 },
  modalTitle: { color: colors.text, fontWeight: "800", fontSize: font.lg, marginBottom: 8 },
  reasonRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  reasonTxt: { color: colors.text, fontSize: font.base },
});

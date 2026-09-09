import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { getEvent, cancelEvent, createEvent, eventAttendees, manageAttendee, OrbEvent } from "@/src/services/eventService";

export default function BizEventDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ev, setEv] = useState<OrbEvent | null>(null);
  const [atts, setAtts] = useState<any[]>([]);

  const load = useCallback(() => {
    getEvent(String(id)).then(setEv).catch(() => {});
    eventAttendees(String(id)).then((r) => setAtts(r.attendees)).catch(() => {});
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = () => {
    showAlert("Cancel this event?", "All attendees will be notified and emailed. This can't be undone.", [
      { text: "Keep event", style: "cancel" },
      { text: "Cancel event", style: "destructive", onPress: async () => {
        try { await cancelEvent(String(id)); showAlert("Cancelled", "Attendees have been notified."); load(); }
        catch (e: any) { showAlert("Cancel", e?.message || "Could not cancel."); }
      } },
    ]);
  };

  const duplicate = async () => {
    if (!ev) return;
    try {
      const shift = 7 * 24 * 3600e3;
      await createEvent({
        title: ev.title, category: ev.category, description: ev.description,
        location_display: ev.location_display, capacity: ev.capacity, join_type: ev.join_type,
        cover_image: ev.cover_image, offer: ev.offer || null,
        lat: -37.8136, lng: 144.9631,
        start_datetime: new Date(new Date(ev.start_datetime).getTime() + shift).toISOString(),
        end_datetime: new Date(new Date(ev.end_datetime).getTime() + shift).toISOString(),
      });
      showAlert("Duplicated", "A copy was created one week later — edit it under Events.");
      router.replace("/business/events");
    } catch (e: any) { showAlert("Duplicate", e?.message || "Could not duplicate."); }
  };

  const act = async (uid: string, action: "accept" | "decline" | "remove") => {
    try { await manageAttendee(String(id), uid, action); load(); }
    catch (e: any) { showAlert("Attendees", e?.message || "Action failed."); }
  };

  const open = ev && (ev.status === "active" || ev.status === "full");
  return (
    <BizShell title="Event">
      {ev && (
        <>
          <BizCard>
            {!!ev.cover_image && <Image source={{ uri: ev.cover_image }} style={{ width: "100%", height: 180, borderRadius: 12, marginBottom: spacing.md }} />}
            <View style={st.badge}><Text style={st.badgeTxt}>BUSINESS HOSTED EVENT</Text></View>
            <Text style={st.title}>{ev.title}</Text>
            <Text style={st.meta}>{ev.category} · {new Date(ev.start_datetime).toLocaleString()} → {new Date(ev.end_datetime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
            <Text style={st.meta}>{ev.location_display} · {ev.going} going{ev.capacity ? ` / ${ev.capacity}` : ""} · {ev.status.toUpperCase()}</Text>
            {!!ev.offer && <Text style={st.offer}>OFFER: {ev.offer}</Text>}
            {!!ev.description && <Text style={st.desc}>{ev.description}</Text>}
            <View style={st.btnRow}>
              {open && <Pressable testID="bizev-edit" onPress={() => router.push(`/business/events/create?id=${ev.id}`)} style={st.btn}><Text style={st.btnTxt}>Edit</Text></Pressable>}
              <Pressable testID="bizev-duplicate" onPress={duplicate} style={st.btn}><Text style={st.btnTxt}>Duplicate</Text></Pressable>
              {open && <Pressable testID="bizev-cancel" onPress={cancel} style={[st.btn, { borderColor: "#DC2626" }]}><Text style={[st.btnTxt, { color: "#DC2626" }]}>Cancel Event</Text></Pressable>}
            </View>
          </BizCard>
          <BizCard>
            <Text style={st.section}>Attendees ({atts.length})</Text>
            {atts.length === 0 ? <Text style={st.empty}>No attendees yet.</Text> : atts.map((a) => (
              <View key={a.user_id} style={st.attRow}>
                <Text style={st.attName}>{a.name}</Text>
                <Text style={st.attStatus}>{a.join_status}</Text>
                {a.join_status === "pending" && open && (
                  <>
                    <Pressable testID={`att-accept-${a.user_id}`} onPress={() => act(a.user_id, "accept")} style={st.miniBtn}><Text style={st.miniTxt}>Approve</Text></Pressable>
                    <Pressable onPress={() => act(a.user_id, "decline")} style={[st.miniBtn, { backgroundColor: "#FEE2E2" }]}><Text style={[st.miniTxt, { color: "#DC2626" }]}>Decline</Text></Pressable>
                  </>
                )}
              </View>
            ))}
          </BizCard>
        </>
      )}
    </BizShell>
  );
}

const st = StyleSheet.create({
  badge: { alignSelf: "flex-start", backgroundColor: colors.cobalt, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 6 },
  badgeTxt: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 3 },
  offer: { color: colors.cobalt, fontSize: font.sm, fontWeight: "800", marginTop: 6 },
  desc: { color: colors.text, fontSize: font.base, marginTop: spacing.md, lineHeight: 20 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  btnTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  section: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: font.sm },
  attRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  attName: { color: colors.text, fontWeight: "700", flex: 1 },
  attStatus: { color: colors.textSecondary, fontSize: font.sm },
  miniBtn: { backgroundColor: colors.tealSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  miniTxt: { color: colors.teal, fontWeight: "800", fontSize: 12 },
});

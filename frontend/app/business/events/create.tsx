import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { createEvent, editEvent, getEvent, EVENT_CATEGORY_ICONS } from "@/src/services/eventService";
import { getMyBusiness } from "@/src/services/businessService";

const CATEGORIES = Object.keys(EVENT_CATEGORY_ICONS);

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3 * 3600e3);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function parseLocal(v: string): string | null {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Desktop Business Event editor — writes to the SAME backend as mobile. */
export default function BizEventForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Business Networking");
  const [start, setStart] = useState(toLocalInput());
  const [end, setEnd] = useState(toLocalInput(new Date(Date.now() + 5 * 3600e3).toISOString()));
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [approval, setApproval] = useState(false);
  const [description, setDescription] = useState("");
  const [offer, setOffer] = useState("");
  const [poster, setPoster] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat?: number | null; lng?: number | null }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMyBusiness().then((r) => {
      if (r.business) {
        setCoords({ lat: (r.business as any).lat, lng: (r.business as any).lng });
        if (!editing) setLocation(r.business.location_display || "");
      }
    }).catch(() => {});
    if (editing) getEvent(String(id)).then((e) => {
      setTitle(e.title); setCategory(e.category); setStart(toLocalInput(e.start_datetime));
      setEnd(toLocalInput(e.end_datetime)); setLocation(e.location_display);
      setCapacity(e.capacity ? String(e.capacity) : ""); setApproval(e.join_type === "approval");
      setDescription(e.description || ""); setOffer(e.offer || ""); setPoster(e.cover_image || null);
    }).catch(() => {});
  }, [editing, id]);

  const pickPoster = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setPoster(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
    }
  };

  const save = async () => {
    const s = parseLocal(start); const e = parseLocal(end);
    if (!title.trim()) return showAlert("Event", "Event name is required.");
    if (!s || !e) return showAlert("Event", "Use date format YYYY-MM-DD HH:MM.");
    if (!location.trim()) return showAlert("Event", "Location is required.");
    setBusy(true);
    try {
      const body: any = {
        title: title.trim(), category, start_datetime: s, end_datetime: e,
        location_display: location.trim(), description: description.trim(),
        capacity: capacity ? parseInt(capacity, 10) : null,
        join_type: approval ? "approval" : "everyone",
        cover_image: poster, offer: offer.trim() || null,
        lat: coords.lat ?? -37.8136, lng: coords.lng ?? 144.9631,
      };
      if (editing) await editEvent(String(id), body);
      else await createEvent(body);
      showAlert("Saved", editing ? "Event updated — changes are live in the app." : "Event published — it now appears to people nearby in the app.");
      router.replace("/business/events");
    } catch (err: any) {
      showAlert("Event", err?.message || "Could not save event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BizShell title={editing ? "Edit Event" : "Create Event"}>
      <BizCard>
        <View style={st.hostBadge}><Text style={st.hostBadgeTxt}>BUSINESS HOSTED EVENT</Text></View>
        <Pressable testID="bizform-poster" onPress={pickPoster} style={st.poster}>
          {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: 160, borderRadius: 12 }} /> :
            <Text style={st.posterTxt}>+ Upload Event poster</Text>}
        </Pressable>
        <Text style={st.label}>Event name *</Text>
        <TextInput testID="bizform-title" value={title} onChangeText={setTitle} placeholder="Friday Happy Hour" placeholderTextColor={colors.textTertiary} style={st.input} />
        <Text style={st.label}>Category *</Text>
        <View style={st.chips}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[st.chip, category === c && st.chipOn]}>
              <Text style={[st.chipTxt, category === c && { color: "#FFF" }]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <View style={st.two}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Start (YYYY-MM-DD HH:MM) *</Text>
            <TextInput testID="bizform-start" value={start} onChangeText={setStart} placeholderTextColor={colors.textTertiary} style={st.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>End (YYYY-MM-DD HH:MM) *</Text>
            <TextInput testID="bizform-end" value={end} onChangeText={setEnd} placeholderTextColor={colors.textTertiary} style={st.input} />
          </View>
        </View>
        <Text style={st.label}>Location *</Text>
        <TextInput testID="bizform-location" value={location} onChangeText={setLocation} placeholderTextColor={colors.textTertiary} style={st.input} />
        <View style={st.two}>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Attendee limit (blank = unlimited)</Text>
            <TextInput testID="bizform-capacity" value={capacity} onChangeText={setCapacity} keyboardType="numeric" placeholderTextColor={colors.textTertiary} style={st.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.label}>Join approval</Text>
            <Pressable testID="bizform-approval" onPress={() => setApproval((v) => !v)} style={[st.toggle, approval && st.toggleOn]}>
              <Text style={[st.toggleTxt, approval && { color: "#FFF" }]}>{approval ? "Approval required" : "Everyone can join"}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={st.label}>Description</Text>
        <TextInput testID="bizform-desc" value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textTertiary} style={[st.input, { minHeight: 80, textAlignVertical: "top" }]} />
        <Text style={st.label}>Offer / promotion (optional — tied to this event&rsquo;s date and times)</Text>
        <TextInput testID="bizform-offer" value={offer} onChangeText={setOffer} placeholder="e.g. 20% off selected drinks 5-7pm" placeholderTextColor={colors.textTertiary} style={st.input} />
        <Pressable testID="bizform-save" onPress={save} disabled={busy} style={[st.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.ctaTxt}>{editing ? "Save changes" : "Publish Event"}</Text>}
        </Pressable>
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  hostBadge: { alignSelf: "flex-start", backgroundColor: colors.cobalt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: spacing.md },
  hostBadgeTxt: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  poster: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, borderRadius: 14, minHeight: 90, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  posterTxt: { color: colors.textTertiary, fontWeight: "700" },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.md, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: font.base, backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  chipTxt: { color: colors.text, fontSize: 12, fontWeight: "600" },
  two: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: spacing.md },
  toggle: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  toggleOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  toggleTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  cta: { backgroundColor: colors.cobalt, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base },
});

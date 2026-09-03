import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { useApp } from "@/src/context/AppContext";
import { createEvent, editEvent, getEvent, EVENT_CATEGORY_ICONS } from "@/src/services/eventService";

const CATEGORIES = Object.keys(EVENT_CATEGORY_ICONS);
const RADII = [250, 500, 750, 1000];
const CAPS: (number | null)[] = [null, 5, 10, 20, 50];
const DAY_MS = 24 * 60 * 60 * 1000;

function dayOpts() {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(Date.now() + i * DAY_MS);
    return { label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }), date: d };
  });
}
const TIMES = ["07:00", "08:00", "09:00", "10:00", "12:00", "14:00", "16:00", "17:30", "18:00", "19:00", "20:00", "21:00"];

function futureDefaults() {
  // default to the next future slot so a new event is never created in the past
  const now = new Date();
  const cutoff = new Date(now.getTime() + 45 * 60000); // ≥45 min from now
  for (const t of TIMES) {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    if (d > cutoff) {
      const idx = TIMES.indexOf(t);
      return { dayIdx: 0, startT: t, endT: TIMES[Math.min(idx + 2, TIMES.length - 1)] };
    }
  }
  return { dayIdx: 1, startT: "09:00", endT: "10:00" }; // late night → tomorrow morning
}

export default function CreateEvent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { coords } = useApp();
  const editing = !!id;
  const defs = futureDefaults();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Social");
  const [dayIdx, setDayIdx] = useState(defs.dayIdx);
  const [startT, setStartT] = useState(defs.startT);
  const [endT, setEndT] = useState(defs.endT);
  const [locationDisplay, setLocationDisplay] = useState("");
  const [radius, setRadius] = useState(500);
  const [desc, setDesc] = useState("");
  const [cap, setCap] = useState<number | null>(null);
  const [joinType, setJoinType] = useState<"everyone" | "approval">("everyone");
  const [busy, setBusy] = useState(false);
  const days = dayOpts();

  useEffect(() => {
    if (!editing) return;
    getEvent(String(id)).then((ev) => {
      setTitle(ev.title); setCategory(ev.category); setLocationDisplay(ev.location_display === "Approximate area shown on radar" ? "" : ev.location_display);
      setRadius(ev.visibility_radius); setDesc(ev.description); setCap(ev.capacity); setJoinType(ev.join_type as any);
      const st = new Date(ev.start_datetime); const en = new Date(ev.end_datetime);
      const di = Math.max(0, Math.min(6, Math.round((st.getTime() - Date.now()) / DAY_MS)));
      setDayIdx(di);
      setStartT(`${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}`);
      setEndT(`${String(en.getHours()).padStart(2, "0")}:${String(en.getMinutes()).padStart(2, "0")}`);
    }).catch(() => showAlert("Error", "Couldn't load this event."));
  }, [editing, id]);

  const submit = async () => {
    if (!title.trim()) { showAlert("Missing name", "Give your event a name."); return; }
    const base = days[dayIdx].date;
    const mk = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const d = new Date(base); d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    let start = mk(startT); let end = mk(endT);
    if (!editing && new Date(start) < new Date()) {
      showAlert("Time has passed", "That start time is already in the past — pick a later time or another day.");
      return;
    }
    if (end <= start) end = new Date(new Date(start).getTime() + 2 * 3600000).toISOString();
    const lat = coords?.lat ?? -37.8136;
    const lng = coords?.lng ?? 144.9631;
    setBusy(true);
    try {
      const body = { title: title.trim(), description: desc.trim(), category, lat, lng,
        location_display: locationDisplay.trim(), location_privacy_type: locationDisplay.trim() ? "venue" : "area",
        visibility_radius: radius, start_datetime: start, end_datetime: end, capacity: cap, join_type: joinType };
      const ev = editing ? await editEvent(String(id), body) : await createEvent(body);
      if (editing) { router.back(); return; }
      showAlert("🎉 Your event is live", `${ev.title}\n\nPeople nearby can now discover your event on their Orrbbit Radar.`, [
        { text: "View Event", onPress: () => router.replace(`/event/${ev.id}`) },
        { text: "Back to Radar", onPress: () => router.back() },
      ]);
    } catch (e: any) { showAlert("Couldn't save event", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
        <Text style={s.headerTitle}>{editing ? "Edit Event" : "Create Event"}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>EVENT NAME</Text>
        <TextInput testID="event-name" style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Saturday Morning Run Club" placeholderTextColor={colors.textTertiary} maxLength={60} />

        <Text style={s.label}>CATEGORY</Text>
        <View style={s.chipWrap}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`cat-${c}`} style={[s.chip, category === c && s.chipOn]} onPress={() => setCategory(c)}>
              <Ionicons name={EVENT_CATEGORY_ICONS[c] as any} size={13} color={category === c ? "#FFF" : colors.textSecondary} />
              <Text style={[s.chipTxt, category === c && { color: "#FFF" }]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>DATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d, i) => (
            <Pressable key={d.label} style={[s.chip, dayIdx === i && s.chipOn]} onPress={() => setDayIdx(i)}>
              <Text style={[s.chipTxt, dayIdx === i && { color: "#FFF" }]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.label}>START TIME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIMES.map((t) => (
            <Pressable key={`s${t}`} style={[s.chip, startT === t && s.chipOn]} onPress={() => setStartT(t)}>
              <Text style={[s.chipTxt, startT === t && { color: "#FFF" }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={s.label}>END TIME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIMES.map((t) => (
            <Pressable key={`e${t}`} style={[s.chip, endT === t && s.chipOn]} onPress={() => setEndT(t)}>
              <Text style={[s.chipTxt, endT === t && { color: "#FFF" }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={s.label}>EVENT LOCATION (shown to attendees)</Text>
        <TextInput testID="event-location" style={s.input} value={locationDisplay} onChangeText={setLocationDisplay} placeholder="e.g. Fed Square steps — leave blank for approximate area" placeholderTextColor={colors.textTertiary} maxLength={60} />
        <Text style={s.privNote}>Your exact GPS position is never shown. The hotspot appears at an approximate distance, following Orrbbit{"'"}s privacy rules.</Text>

        <Text style={s.label}>EVENT VISIBILITY RADIUS</Text>
        <View style={s.chipWrap}>
          {RADII.map((r) => (
            <Pressable key={r} testID={`radius-${r}`} style={[s.chip, radius === r && s.chipOn]} onPress={() => setRadius(r)}>
              <Text style={[s.chipTxt, radius === r && { color: "#FFF" }]}>{r >= 1000 ? "1km" : `${r}m`}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>DESCRIPTION</Text>
        <TextInput testID="event-desc" style={[s.input, { minHeight: 84, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} multiline placeholder="e.g. Easy 5km run followed by coffee. Everyone welcome." placeholderTextColor={colors.textTertiary} maxLength={400} />

        <Text style={s.label}>CAPACITY</Text>
        <View style={s.chipWrap}>
          {CAPS.map((c) => (
            <Pressable key={String(c)} style={[s.chip, cap === c && s.chipOn]} onPress={() => setCap(c)}>
              <Text style={[s.chipTxt, cap === c && { color: "#FFF" }]}>{c === null ? "Unlimited" : c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>WHO CAN JOIN</Text>
        <View style={s.chipWrap}>
          <Pressable testID="join-everyone" style={[s.chip, joinType === "everyone" && s.chipOn]} onPress={() => setJoinType("everyone")}>
            <Text style={[s.chipTxt, joinType === "everyone" && { color: "#FFF" }]}>Everyone</Text>
          </Pressable>
          <Pressable testID="join-approval" style={[s.chip, joinType === "approval" && s.chipOn]} onPress={() => setJoinType("approval")}>
            <Text style={[s.chipTxt, joinType === "approval" && { color: "#FFF" }]}>Approval Required</Text>
          </Pressable>
        </View>

        <Pressable testID="submit-event" style={[s.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>{editing ? "SAVE CHANGES" : "CREATE EVENT"}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  label: { color: colors.textSecondary, fontSize: font.micro, fontWeight: "800", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: font.base, backgroundColor: "#FFF" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: "#FFF" },
  chipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  privNote: { color: colors.textTertiary, fontSize: font.micro, marginTop: 6, lineHeight: 16 },
  cta: { backgroundColor: colors.orange, borderRadius: 999, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base, letterSpacing: 0.5 },
});

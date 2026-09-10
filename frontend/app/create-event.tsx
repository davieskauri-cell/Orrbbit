import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { createEvent, editEvent, getEvent, EVENT_CATEGORY_ICONS } from "@/src/services/eventService";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import EventPoster from "@/src/components/EventPoster";

const CATEGORIES = Object.keys(EVENT_CATEGORY_ICONS);
const RADII = [250, 500, 750, 1000];
const CAPS: (number | null)[] = [null, 5, 10, 20, 50];
const DAY_MS = 24 * 60 * 60 * 1000;

/** minutes-from-midnight → "9:30 PM" */
const fmtTime = (mins: number) => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
};

const fmtDate = (d: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((dd.getTime() - today.getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

function defaultTimes() {
  // default: next half-hour slot at least 1 hour away, 2-hour duration
  const now = new Date();
  let start = Math.ceil((now.getHours() * 60 + now.getMinutes() + 60) / 30) * 30;
  let dayOffset = 0;
  if (start >= 1440) { start -= 1440; dayOffset = 1; }
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset);
  return { date: d, startMin: start, endMin: (start + 120) % 1440 };
}

export default function CreateEvent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { coords } = useApp();
  const { user } = useAuth();
  const isBiz = user?.account_type === "business";
  const on = isBiz ? { backgroundColor: colors.cobalt, borderColor: colors.cobalt } : null;
  const onSoft = isBiz ? { backgroundColor: colors.cobaltSoft } : null;
  const [offer, setOffer] = useState("");
  const editing = !!id;
  const defs = defaultTimes();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Social");
  const [date, setDate] = useState<Date>(defs.date);
  const [startMin, setStartMin] = useState(defs.startMin);
  const [endMin, setEndMin] = useState(defs.endMin);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState<"start" | "end" | null>(null);
  const [locationDisplay, setLocationDisplay] = useState("");
  const [radius, setRadius] = useState(500);
  const [desc, setDesc] = useState("");
  const [cap, setCap] = useState<number | null>(null);
  const [joinType, setJoinType] = useState<"everyone" | "approval">("everyone");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const crossesMidnight = endMin <= startMin;
  const durMin = (endMin - startMin + 1440) % 1440;
  const durTxt = durMin === 0 ? null
    : `${Math.floor(durMin / 60) > 0 ? `${Math.floor(durMin / 60)} hour${Math.floor(durMin / 60) === 1 ? "" : "s"}` : ""}${durMin % 60 ? `${Math.floor(durMin / 60) > 0 ? " " : ""}${durMin % 60} min` : ""}`;

  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.getCameraPermissionsAsync();
        if (!perm.granted) {
          const req = perm.canAskAgain ? await ImagePicker.requestCameraPermissionsAsync() : perm;
          if (!req.granted) {
            showAlert("Camera access needed", "Add an event photo with your camera by allowing access.", [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]);
            return;
          }
        }
      }
      // full photo/poster is kept — no forced crop
      const opts = { mediaTypes: ["images"] as any, quality: 0.9, base64: true };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      // normalise like profile photos: HEIC→JPEG, EXIF stripped, resized ≤1600px, upload-safe size
      try {
        const wide = Math.max(asset.width || 0, asset.height || 0);
        const actions = wide > 1600
          ? [(asset.width || 0) >= (asset.height || 0) ? { resize: { width: 1600 } } : { resize: { height: 1600 } }]
          : [];
        const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
          compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true,
        });
        if (out.base64) { setPhoto(`data:image/jpeg;base64,${out.base64}`); return; }
      } catch {}
      // fallback: picker-provided base64
      if (asset.base64 && asset.base64.length <= 5_000_000) setPhoto(`data:image/jpeg;base64,${asset.base64}`);
      else showAlert("Photo too large", "Please choose a smaller photo.");
    } catch { showAlert("Error", "Couldn't load that photo. Please try again."); }
  };

  useEffect(() => {
    if (!editing) return;
    getEvent(String(id)).then((ev) => {
      setTitle(ev.title); setCategory(ev.category); setLocationDisplay(ev.location_display === "Approximate area shown on radar" ? "" : ev.location_display);
      setRadius(ev.visibility_radius); setDesc(ev.description); setCap(ev.capacity); setJoinType(ev.join_type as any);
      setOffer(ev.offer || "");
      setPhoto(ev.cover_image || null);
      const st = new Date(ev.start_datetime); const en = new Date(ev.end_datetime);
      const d0 = new Date(st); d0.setHours(0, 0, 0, 0);
      setDate(d0);
      setStartMin(st.getHours() * 60 + st.getMinutes());
      setEndMin(en.getHours() * 60 + en.getMinutes());
    }).catch(() => showAlert("Error", "Couldn't load this event."));
  }, [editing, id]);

  const submit = async () => {
    if (!title.trim()) { showAlert("Missing name", "Give your event a name."); return; }
    if (endMin === startMin) { showAlert("Check times", "End time must be after the start time."); return; }
    const start = new Date(date); start.setHours(0, 0, 0, 0); start.setMinutes(startMin);
    const end = new Date(date); end.setHours(0, 0, 0, 0); end.setMinutes(crossesMidnight ? endMin + 1440 : endMin);
    if (!editing && start < new Date()) {
      showAlert("Time has passed", "That start time is already in the past — pick a later time or another day.");
      return;
    }
    const lat = coords?.lat ?? -37.8136;
    const lng = coords?.lng ?? 144.9631;
    setBusy(true);
    try {
      const body = { title: title.trim(), description: desc.trim(), category, lat, lng,
        location_display: locationDisplay.trim(), location_privacy_type: locationDisplay.trim() ? "venue" : "area",
        visibility_radius: radius, start_datetime: start.toISOString(), end_datetime: end.toISOString(),
        capacity: cap, join_type: joinType, cover_image: photo, offer: offer.trim() || null };
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
        <View style={[s.hostTypeBanner, { backgroundColor: isBiz ? colors.cobalt : colors.orange }]} testID="host-type-banner">
          <Ionicons name={isBiz ? "storefront" : "person"} size={13} color="#FFF" />
          <Text style={s.hostTypeTxt}>{isBiz ? "BUSINESS HOSTED EVENT" : "PERSONAL HOSTED EVENT"}</Text>
        </View>
        <Text style={s.label}>PHOTO OR EVENTS POSTER (optional)</Text>
        {photo ? (
          <View>
            <EventPoster uri={photo} radius={16} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Pressable testID="change-photo" style={s.photoBtn} onPress={() => pick(false)}>
                <Ionicons name="camera-outline" size={15} color={colors.text} />
                <Text style={s.photoBtnTxt}>Change Photo</Text>
              </Pressable>
              <Pressable testID="remove-photo" style={[s.photoBtn, { borderColor: "#FCA5A5" }]} onPress={() => setPhoto(null)}>
                <Ionicons name="trash-outline" size={15} color="#DC2626" />
                <Text style={[s.photoBtnTxt, { color: "#DC2626" }]}>Remove Photo</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <View style={s.photoRow}>
              <Pressable testID="photo-library" style={[s.photoAdd, isBiz && { borderColor: colors.cobalt + "66", backgroundColor: colors.cobaltSoft }]} onPress={() => pick(false)}>
                <Ionicons name="images-outline" size={20} color={isBiz ? colors.cobalt : colors.orange} />
                <Text style={[s.photoAddTxt, isBiz && { color: colors.cobalt }]}>Photo Library</Text>
              </Pressable>
              <Pressable testID="photo-camera" style={[s.photoAdd, isBiz && { borderColor: colors.cobalt + "66", backgroundColor: colors.cobaltSoft }]} onPress={() => pick(true)}>
                <Ionicons name="camera-outline" size={20} color={isBiz ? colors.cobalt : colors.orange} />
                <Text style={[s.photoAddTxt, isBiz && { color: colors.cobalt }]}>Take Photo</Text>
              </Pressable>
            </View>
            <View style={s.infoNote}>
              <Ionicons name="information-circle-outline" size={15} color={colors.teal} />
              <Text style={s.infoNoteTxt}>Add a photo or events poster to make your event stand out. The full image is shown on your event — nothing gets cropped.</Text>
            </View>
          </View>
        )}

        <Text style={s.label}>EVENT NAME</Text>
        <TextInput testID="event-name" style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Saturday Morning Run Club" placeholderTextColor={colors.textTertiary} maxLength={60} />
        {isBiz && (
          <>
            <Text style={s.label}>OFFER / PROMOTION (optional)</Text>
            <TextInput testID="event-offer" style={s.input} value={offer} onChangeText={setOffer} placeholder="e.g. 20% off selected drinks 5-7pm" placeholderTextColor={colors.textTertiary} maxLength={160} />
          </>
        )}

        <Text style={s.label}>CATEGORY</Text>
        <View style={s.chipWrap}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`cat-${c}`} style={[s.chip, category === c && [s.chipOn, on]]} onPress={() => setCategory(c)}>
              <Ionicons name={EVENT_CATEGORY_ICONS[c] as any} size={13} color={category === c ? "#FFF" : colors.textSecondary} />
              <Text style={[s.chipTxt, category === c && { color: "#FFF" }]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>DATE & TIME</Text>
        <Pressable testID="date-field" style={s.field} onPress={() => setDateOpen(true)}>
          <Ionicons name="calendar-outline" size={17} color={colors.teal} />
          <Text style={s.fieldTxt}>{fmtDate(date)}</Text>
          <Ionicons name="chevron-down" size={15} color={colors.textTertiary} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Start time</Text>
            <Pressable testID="start-time-field" style={s.field} onPress={() => setTimeOpen("start")}>
              <Ionicons name="time-outline" size={17} color={colors.teal} />
              <Text style={s.fieldTxt}>{fmtTime(startMin)}</Text>
              <Ionicons name="chevron-down" size={15} color={colors.textTertiary} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>End time</Text>
            <Pressable testID="end-time-field" style={s.field} onPress={() => setTimeOpen("end")}>
              <Ionicons name="time-outline" size={17} color={colors.teal} />
              <Text style={s.fieldTxt}>{fmtTime(endMin)}</Text>
              <Ionicons name="chevron-down" size={15} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
        {!!durTxt && (
          <View style={s.durRow} testID="event-duration">
            <Ionicons name="hourglass-outline" size={14} color={colors.teal} />
            <Text style={s.durTxt}>Event duration: {durTxt}{crossesMidnight ? " · ends next day" : ""}</Text>
          </View>
        )}

        <Text style={s.label}>EVENT LOCATION (shown to attendees)</Text>
        <TextInput testID="event-location" style={s.input} value={locationDisplay} onChangeText={setLocationDisplay} placeholder="e.g. Fed Square steps — leave blank for approximate area" placeholderTextColor={colors.textTertiary} maxLength={60} />
        <Text style={s.privNote}>Your exact GPS position is never shown. The hotspot appears at an approximate distance, following Orrbbit{"'"}s privacy rules.</Text>

        <Text style={s.label}>EVENT VISIBILITY RADIUS</Text>
        <View style={s.chipWrap}>
          {RADII.map((r) => (
            <Pressable key={r} testID={`radius-${r}`} style={[s.chip, radius === r && [s.chipOn, on]]} onPress={() => setRadius(r)}>
              <Text style={[s.chipTxt, radius === r && { color: "#FFF" }]}>{r >= 1000 ? "1km" : `${r}m`}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>DESCRIPTION</Text>
        <TextInput testID="event-desc" style={[s.input, { minHeight: 84, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} multiline placeholder="e.g. Easy 5km run followed by coffee. Everyone welcome." placeholderTextColor={colors.textTertiary} maxLength={400} />

        <Text style={s.label}>CAPACITY</Text>
        <View style={s.chipWrap}>
          {CAPS.map((c) => (
            <Pressable key={String(c)} style={[s.chip, cap === c && [s.chipOn, on]]} onPress={() => setCap(c)}>
              <Text style={[s.chipTxt, cap === c && { color: "#FFF" }]}>{c === null ? "Unlimited" : c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>WHO CAN JOIN</Text>
        <View style={s.chipWrap}>
          <Pressable testID="join-everyone" style={[s.chip, joinType === "everyone" && [s.chipOn, on]]} onPress={() => setJoinType("everyone")}>
            <Text style={[s.chipTxt, joinType === "everyone" && { color: "#FFF" }]}>Everyone</Text>
          </Pressable>
          <Pressable testID="join-approval" style={[s.chip, joinType === "approval" && [s.chipOn, on]]} onPress={() => setJoinType("approval")}>
            <Text style={[s.chipTxt, joinType === "approval" && { color: "#FFF" }]}>Approval Required</Text>
          </Pressable>
        </View>

        <Pressable testID="submit-event" style={[s.cta, isBiz && { backgroundColor: colors.cobalt }, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>{editing ? "SAVE CHANGES" : "CREATE EVENT"}</Text>}
        </Pressable>
      </ScrollView>

      {/* date picker */}
      <Modal visible={dateOpen} transparent animationType="slide" onRequestClose={() => setDateOpen(false)}>
        <Pressable style={s.sheetBg} onPress={() => setDateOpen(false)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Event date</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
                const sel = d.getTime() === new Date(date).setHours(0, 0, 0, 0);
                return (
                  <Pressable key={i} testID={`date-opt-${i}`} style={[s.dateRow, sel && [s.dateRowOn, onSoft]]} onPress={() => { setDate(d); setDateOpen(false); }}>
                    <Text style={[s.dateRowTxt, sel && { color: colors.teal, fontWeight: "800" }]}>
                      {i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                    {sel && <Ionicons name="checkmark" size={18} color={colors.teal} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* time picker */}
      <TimeSheet
        visible={timeOpen !== null}
        title={timeOpen === "start" ? "Start time" : "End time"}
        initial={timeOpen === "end" ? endMin : startMin}
        bottomInset={insets.bottom}
        isBiz={isBiz}
        onClose={() => setTimeOpen(null)}
        onDone={(mins) => {
          if (timeOpen === "start") {
            setStartMin(mins);
            // keep the same duration when the start moves
            setEndMin((mins + durMin) % 1440);
          } else setEndMin(mins);
          setTimeOpen(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

/** Native-style 12-hour time picker (hour / minutes / AM-PM columns) — any time, 5-min steps. */
function TimeSheet({ visible, title, initial, bottomInset, isBiz, onClose, onDone }:
  { visible: boolean; title: string; initial: number; bottomInset: number; isBiz?: boolean; onClose: () => void; onDone: (mins: number) => void }) {
  const on = isBiz ? { backgroundColor: colors.cobalt, borderColor: colors.cobalt } : null;
  const onSoft = isBiz ? { backgroundColor: colors.cobaltSoft } : null;
  const [h, setH] = useState(9);
  const [m, setM] = useState(30);
  const [ap, setAp] = useState<"AM" | "PM">("PM");

  useEffect(() => {
    if (!visible) return;
    const h24 = Math.floor(initial / 60) % 24;
    setH(h24 % 12 === 0 ? 12 : h24 % 12);
    setM(initial % 60);
    setAp(h24 >= 12 ? "PM" : "AM");
  }, [visible, initial]);

  const commit = () => onDone((((ap === "PM" ? 12 : 0) + (h % 12)) * 60 + m) % 1440);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetBg} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: bottomInset + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
          <Text style={s.sheetTitle}>{title}</Text>
          <View style={s.wheelRow}>
            <ScrollView style={s.wheelCol} showsVerticalScrollIndicator={false}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((hh) => (
                <Pressable key={hh} testID={`time-hour-${hh}`} style={[s.wheelOpt, h === hh && [s.wheelOptOn, onSoft]]} onPress={() => setH(hh)}>
                  <Text style={[s.wheelTxt, h === hh && s.wheelTxtOn]}>{hh}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView style={s.wheelCol} showsVerticalScrollIndicator={false}>
              {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
                <Pressable key={mm} testID={`time-min-${mm}`} style={[s.wheelOpt, m === mm && [s.wheelOptOn, onSoft]]} onPress={() => setM(mm)}>
                  <Text style={[s.wheelTxt, m === mm && s.wheelTxtOn]}>{String(mm).padStart(2, "0")}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[s.wheelCol, { justifyContent: "center", gap: 10 }]}>
              {(["AM", "PM"] as const).map((a) => (
                <Pressable key={a} testID={`time-${a}`} style={[s.apBtn, ap === a && [s.apBtnOn, on]]} onPress={() => setAp(a)}>
                  <Text style={[s.apTxt, ap === a && { color: "#FFF" }]}>{a}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable testID="time-done" style={[s.sheetDone, isBiz && { backgroundColor: colors.cobalt }]} onPress={commit}>
            <Text style={s.sheetDoneTxt}>Set {`${h}:${String(m).padStart(2, "0")} ${ap}`}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  hostTypeBanner: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, marginBottom: spacing.md },
  hostTypeTxt: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  label: { color: colors.textSecondary, fontSize: font.micro, fontWeight: "800", letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: font.base, backgroundColor: "#FFF" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: "#FFF" },
  chipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  privNote: { color: colors.textTertiary, fontSize: font.micro, marginTop: 6, lineHeight: 16 },
  field: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "#FFF" },
  fieldTxt: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "700" },
  fieldLabel: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", marginBottom: 6 },
  durRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.tealSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10 },
  durTxt: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  infoNote: { flexDirection: "row", gap: 8, backgroundColor: colors.tealSoft, borderRadius: 12, padding: 12, marginTop: 10, alignItems: "flex-start" },
  infoNoteTxt: { flex: 1, color: colors.textSecondary, fontSize: font.micro, lineHeight: 16 },
  sheetBg: { flex: 1, backgroundColor: "rgba(17,24,39,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFF", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.xl },
  sheetTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10 },
  dateRowOn: { backgroundColor: colors.tealSoft },
  dateRowTxt: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  wheelRow: { flexDirection: "row", gap: 10, height: 230 },
  wheelCol: { flex: 1 },
  wheelOpt: { paddingVertical: 11, alignItems: "center", borderRadius: 10 },
  wheelOptOn: { backgroundColor: colors.tealSoft },
  wheelTxt: { color: colors.textSecondary, fontSize: font.lg, fontWeight: "600" },
  wheelTxtOn: { color: colors.teal, fontWeight: "800" },
  apBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  apBtnOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  apTxt: { color: colors.text, fontWeight: "800", fontSize: font.base },
  sheetDone: { backgroundColor: colors.orange, borderRadius: 999, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  sheetDoneTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base },
  photoRow: { flexDirection: "row", gap: 10 },
  photoAdd: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: colors.orange + "66", borderStyle: "dashed", borderRadius: 14, paddingVertical: 18, backgroundColor: colors.orangeSoft },
  photoAddTxt: { color: colors.orange, fontWeight: "700", fontSize: font.sm },
  photoBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  photoBtnTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
  cta: { backgroundColor: colors.orange, borderRadius: 999, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base, letterSpacing: 0.5 },
});

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import PromptsEditor, { MAX_PROMPTS } from "@/src/components/PromptsEditor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { showAlert } from "@/src/lib/alert";
import { updateProfile, addPhoto, removePhoto } from "@/src/services/userService";
import PhotoGrid from "@/src/components/PhotoGrid";
import InterestChip from "@/src/components/InterestChip";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const INTERESTS = [
  "Coffee", "Music", "Fitness", "Business", "Startups", "Travel", "Advice",
  "Sport", "Dating", "Study", "Career", "Golf", "Food", "Walking", "Tech",
];

type Prompt = { prompt: string; answer: string };

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [selected, setSelected] = useState<string[]>(user?.interests || []);
  const [city, setCity] = useState(user?.city || "");
  const [country, setCountry] = useState(user?.country || "");
  const [homeCity, setHomeCity] = useState(user?.home_city || "");
  const [occupation, setOccupation] = useState(user?.occupation || "");
  const [education, setEducation] = useState(user?.education || "");
  const [languages, setLanguages] = useState(user?.languages || "");
  const [prompts, setPrompts] = useState<Prompt[]>(user?.prompts || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // hydrate form once the user loads (direct URL access / refresh)
  const hydrated = useRef(!!user);
  useEffect(() => {
    if (user && !hydrated.current) {
      hydrated.current = true;
      setName(user.name || "");
      setBio(user.bio || "");
      setSelected(user.interests || []);
      setPhotos(user.photos || []);
      setCity(user.city || "");
      setCountry(user.country || "");
      setHomeCity(user.home_city || "");
      setOccupation(user.occupation || "");
      setEducation(user.education || "");
      setLanguages(user.languages || "");
      setPrompts(user.prompts || []);
    }
  }, [user]);

  const toggle = (i: string) =>
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const addPhotos = async (uris: string[]) => {
    setUploading(true);
    setError("");
    try {
      let updated: any = null;
      for (const uri of uris) {
        updated = await addPhoto(uri);
      }
      if (updated) {
        setUser(updated);
        setPhotos(updated.photos || []);
      }
    } catch (e: any) {
      setError(e.message || "Photo upload failed");
    }
    setUploading(false);
  };

  const removeAt = async (index: number) => {
    const doRemove = async () => {
      try {
        const updated: any = await removePhoto(index);
        setUser(updated);
        setPhotos(updated.photos || []);
      } catch (e: any) {
        setError(e?.message || "Couldn't remove that photo. Please try again.");
      }
    };
    if (photos.length === 2 && user?.people_discoverable) {
      showAlert(
        "Your profile will be less visible",
        "With fewer than 2 photos your People profile won't be fully discoverable on Radar and Nearby until you add another photo.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove anyway", style: "destructive", onPress: doRemove },
        ]
      );
      return;
    }
    await doRemove();
  };

  const reorder = async (from: number, to: number) => {
    const prev = [...photos];
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPhotos(next);
    try {
      const updated: any = await updateProfile({ photos: next });
      setUser(updated);
      setPhotos(updated.photos || next);
    } catch (e: any) {
      setPhotos(prev); // revert — the new order was not persisted
      setError(e?.message || "Couldn't reorder your photos. Please try again.");
    }
  };


  const save = async () => {
    setError("");
    setBusy(true);
    try {
      const updated = await updateProfile({
        name: name.trim() || undefined,
        bio,
        interests: selected,
        city: city.trim(),
        country: country.trim(),
        home_city: homeCity.trim(),
        occupation: occupation.trim(),
        education: education.trim(),
        languages: languages.trim(),
        prompts: prompts.filter((p) => p.answer.trim()).slice(0, MAX_PROMPTS),
      });
      setUser(updated as any);
      router.back();
    } catch (e: any) {
      setError(e?.message || "Couldn't save your profile. Please check your connection and try again.");
    }
    setBusy(false);
  };

  // merge any custom interests the user already has
  const all = Array.from(new Set([...INTERESTS, ...selected]));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable testID="edit-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Edit Profile</Text>
        </View>

        <Text style={styles.label}>Photos ({photos.length}/6)</Text>
        <Text style={styles.subLabel}>Add at least 2 photos to complete your profile.</Text>
        <PhotoGrid photos={photos} onAdd={addPhotos} onRemove={removeAt} onReorder={reorder} uploading={uploading} />

        <Text style={styles.label}>First name</Text>
        <TextInput testID="edit-name" value={name} onChangeText={setName} style={styles.input} placeholder="Name" placeholderTextColor={colors.textTertiary} />
        {!!user?.age && (
          <Text style={styles.ageNote} testID="edit-age-note">
            Age {user.age} — calculated from your date of birth, never shown as a full birthday.
          </Text>
        )}
        <Text style={styles.label}>Bio</Text>
        <TextInput
          testID="edit-bio"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={500}
          style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
          placeholder="Where you're from, what you do, what you're into…"
          placeholderTextColor={colors.textTertiary}
        />
        <Text
          style={[styles.charCount, bio.trim().length >= 40 && { color: colors.success }]}
          testID="bio-char-count"
        >
          {bio.trim().length >= 40 ? `${bio.length}/500` : `${bio.trim().length}/500 · at least 40 characters to be discoverable`}
        </Text>

        <Text style={styles.sectionHeading}>About you</Text>
        <Text style={styles.label}>Lives in (current city)</Text>
        <TextInput testID="edit-city" value={city} onChangeText={setCity} style={styles.input} placeholder="e.g. Melbourne" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Country</Text>
        <TextInput testID="edit-country" value={country} onChangeText={setCountry} style={styles.input} placeholder="e.g. Australia" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>From (home city)</Text>
        <TextInput testID="edit-home-city" value={homeCity} onChangeText={setHomeCity} style={styles.input} placeholder="e.g. Auckland, New Zealand" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.hintText}>City-level only — your address and exact location are never shown.</Text>
        <Text style={styles.label}>Occupation (optional)</Text>
        <TextInput testID="edit-occupation" value={occupation} onChangeText={setOccupation} style={styles.input} placeholder="e.g. Marketing" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Education (optional)</Text>
        <TextInput testID="edit-education" value={education} onChangeText={setEducation} style={styles.input} placeholder="e.g. University of Auckland" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Languages (optional)</Text>
        <TextInput testID="edit-languages" value={languages} onChangeText={setLanguages} style={styles.input} placeholder="e.g. English" placeholderTextColor={colors.textTertiary} />

        <Text style={styles.sectionHeading}>Conversation prompts ({prompts.length}/{MAX_PROMPTS})</Text>
        <Text style={styles.hintText}>Optional — give people an easy way to start a conversation.</Text>
        <PromptsEditor prompts={prompts} onChange={setPrompts} />

        <Text style={styles.sectionHeading}>Interests</Text>
        <View style={styles.chips}>
          {all.map((i) => (
            <InterestChip key={i} label={i} selected={selected.includes(i)} onPress={() => toggle(i)} />
          ))}
        </View>

        {!!error && <Text style={styles.error} testID="edit-error">{error}</Text>}

        <PrimaryButton testID="edit-save" title="Save" onPress={save} loading={busy} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  subLabel: { color: colors.textTertiary, fontSize: font.sm, marginBottom: spacing.sm, marginTop: -4 },
  sectionHeading: {
    color: colors.text,
    fontSize: font.lg,
    fontWeight: "800",
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  ageNote: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm },
  charCount: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.xs, alignSelf: "flex-end" },
  hintText: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.xs },
  promptCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  promptHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  promptTitle: { color: colors.text, fontSize: font.base, fontWeight: "800", flex: 1 },
  addPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    minHeight: 48,
    marginTop: spacing.md,
  },
  addPromptText: { color: colors.teal, fontSize: font.base, fontWeight: "700" },
  promptPicker: { marginTop: spacing.md, gap: spacing.xs },
  promptOption: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  promptOptionText: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: font.lg,
    minHeight: 50,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.pink, fontSize: font.sm, fontWeight: "600", marginTop: spacing.md },
});

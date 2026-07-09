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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { updateProfile, addPhoto, removePhoto } from "@/src/services/userService";
import PhotoGrid from "@/src/components/PhotoGrid";
import InterestChip from "@/src/components/InterestChip";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const INTERESTS = [
  "Coffee", "Music", "Fitness", "Business", "Startups", "Travel", "Advice",
  "Sport", "Dating", "Study", "Career", "Golf", "Food", "Walking", "Tech",
];

export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState(String(user?.age || ""));
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [selected, setSelected] = useState<string[]>(user?.interests || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // hydrate form once the user loads (direct URL access / refresh)
  const hydrated = useRef(!!user);
  useEffect(() => {
    if (user && !hydrated.current) {
      hydrated.current = true;
      setName(user.name || "");
      setAge(String(user.age || ""));
      setBio(user.bio || "");
      setSelected(user.interests || []);
      setPhotos(user.photos || []);
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
    try {
      const updated: any = await removePhoto(index);
      setUser(updated);
      setPhotos(updated.photos || []);
    } catch {}
  };

  const save = async () => {
    if (photos.length < 3) {
      setError("Please add at least 3 photos.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const updated = await updateProfile({
        name: name.trim() || undefined,
        age: parseInt(age, 10) || undefined,
        bio,
        interests: selected,
      });
      setUser(updated as any);
      router.back();
    } catch {}
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

        <Text style={styles.label}>Your photos (minimum 3)</Text>
        <PhotoGrid photos={photos} onAdd={addPhotos} onRemove={removeAt} uploading={uploading} />

        <Text style={styles.label}>First name</Text>
        <TextInput testID="edit-name" value={name} onChangeText={setName} style={styles.input} placeholder="Name" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Age</Text>
        <TextInput testID="edit-age" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} style={styles.input} placeholder="Age" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Short bio</Text>
        <TextInput
          testID="edit-bio"
          value={bio}
          onChangeText={setBio}
          multiline
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          placeholder="A line or two about you…"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.label}>Interests</Text>
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

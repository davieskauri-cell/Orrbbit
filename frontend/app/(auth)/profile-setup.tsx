import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

export default function ProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState((user as any)?.display_name || user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [selected, setSelected] = useState<string[]>(user?.interests || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // hydrate once the user loads (direct URL access / refresh)
  const hydrated = useRef(!!user);
  useEffect(() => {
    if (user && !hydrated.current) {
      hydrated.current = true;
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
    } catch (e: any) {
      setError(e?.message || "Couldn't remove that photo. Please try again.");
    }
  };

  const next = async () => {
    if (photos.length < 2) {
      setError("Please add at least 2 photos.");
      return;
    }
    if (!displayName.trim()) {
      setError("Please choose a display name.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const updated = await updateProfile({ display_name: displayName.trim(), bio, interests: selected });
      setUser(updated as any);
      router.push("/(auth)/choose-vibe");
    } catch (e: any) {
      setError(e?.message || "Couldn't save your profile. Please check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {router.canGoBack() && (
          <Pressable testID="setup-back" onPress={() => router.back()} hitSlop={10} style={{ marginBottom: spacing.md, marginLeft: -6, width: 44, height: 44, justifyContent: "center" }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.sub}>This is what people nearby will see.</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          testID="setup-display-name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How you'll appear to people nearby"
          placeholderTextColor={colors.textTertiary}
          maxLength={40}
          style={[styles.bioInput, { minHeight: 44 }]}
        />

        <Text style={styles.label}>Your photos (minimum 2)</Text>
        <PhotoGrid photos={photos} onAdd={addPhotos} onRemove={removeAt} uploading={uploading} />

        <Text style={styles.label}>Short bio</Text>
        <TextInput
          testID="setup-bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A line or two about you…"
          placeholderTextColor={colors.textTertiary}
          multiline
          style={styles.bioInput}
        />

        <Text style={styles.label}>Interests</Text>
        <View style={styles.chips}>
          {INTERESTS.map((i) => (
            <InterestChip key={i} label={i} selected={selected.includes(i)} onPress={() => toggle(i)} />
          ))}
        </View>

        {!!error && <Text style={styles.error} testID="setup-error">{error}</Text>}

        <PrimaryButton
          testID="setup-next"
          title="Next"
          onPress={next}
          loading={busy}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.xs },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md, letterSpacing: 0.5 },
  error: { color: colors.pink, fontSize: font.sm, fontWeight: "600", marginTop: spacing.md },
  bioInput: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    color: colors.text,
    fontSize: font.lg,
    minHeight: 80,
    textAlignVertical: "top",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});

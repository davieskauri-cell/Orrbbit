import React, { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { updateProfile } from "@/src/services/userService";
import Avatar from "@/src/components/Avatar";
import InterestChip from "@/src/components/InterestChip";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const INTERESTS = [
  "Coffee", "Music", "Fitness", "Business", "Startups", "Travel", "Advice",
  "Sport", "Dating", "Study", "Career", "Golf", "Food", "Walking", "Tech",
];

const PHOTOS = [
  "https://randomuser.me/api/portraits/men/45.jpg",
  "https://randomuser.me/api/portraits/women/26.jpg",
  "https://randomuser.me/api/portraits/men/64.jpg",
  "https://randomuser.me/api/portraits/women/57.jpg",
  "https://randomuser.me/api/portraits/men/17.jpg",
  "https://randomuser.me/api/portraits/women/79.jpg",
];

export default function ProfileSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [photo, setPhoto] = useState<string | null>(user?.photo_url || null);
  const [selected, setSelected] = useState<string[]>(user?.interests || []);
  const [busy, setBusy] = useState(false);

  const toggle = (i: string) =>
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  const next = async () => {
    setBusy(true);
    try {
      const updated = await updateProfile({ bio, interests: selected, photo_url: photo });
      setUser(updated as any);
      router.replace("/(auth)/choose-vibe");
    } catch {}
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.sub}>This is what people nearby will see.</Text>

        <Text style={styles.label}>Profile photo</Text>
        <View style={styles.photoRow}>
          <Pressable testID="photo-initials" onPress={() => setPhoto(null)}>
            <Avatar name={user?.name} size={56} ringColor={photo === null ? colors.orange : undefined} />
          </Pressable>
          {PHOTOS.map((p) => (
            <Pressable key={p} testID={`photo-${p.slice(-11, -4)}`} onPress={() => setPhoto(p)}>
              <Avatar uri={p} size={56} ringColor={photo === p ? colors.orange : undefined} />
            </Pressable>
          ))}
        </View>

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
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
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

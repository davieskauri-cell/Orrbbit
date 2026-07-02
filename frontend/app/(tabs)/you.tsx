import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useRadar } from "@/src/context/RadarContext";
import { api } from "@/src/lib/api";
import { colors, spacing, radius, font } from "@/src/theme";

const RADIUS_OPTIONS = [10, 25, 50];

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, signOut, setUser, refreshUser } = useAuth();
  const { statusMap, setVisible, setRadius } = useRadar();
  const [radiusLocal, setRadiusLocal] = useState(
    RADIUS_OPTIONS.includes(user?.radius as number) ? (user?.radius as number) : 50
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);

  const st = user?.status ? statusMap[user.status] : undefined;

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api("/users/me", {
        method: "PUT",
        body: { display_name: name, bio },
        token,
      });
      setUser(updated as any);
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>You</Text>

      {/* Profile card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <Image source={{ uri: user?.avatar_url || undefined }} style={styles.avatar} />
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            {editing ? (
              <TextInput
                testID="profile-name-input"
                value={name}
                onChangeText={setName}
                style={styles.nameInput}
                placeholder="Name"
                placeholderTextColor={colors.onSurfaceSecondary}
              />
            ) : (
              <Text style={styles.name}>{user?.display_name}</Text>
            )}
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Pressable
            testID="profile-edit-toggle"
            onPress={() => (editing ? saveProfile() : setEditing(true))}
          >
            {saving ? (
              <ActivityIndicator color={colors.brandPrimary} />
            ) : (
              <Ionicons
                name={editing ? "checkmark" : "create-outline"}
                size={22}
                color={colors.brandPrimary}
              />
            )}
          </Pressable>
        </View>
        {editing ? (
          <TextInput
            testID="profile-bio-input"
            value={bio}
            onChangeText={setBio}
            style={styles.bioInput}
            placeholder="Add a short bio"
            placeholderTextColor={colors.onSurfaceSecondary}
            multiline
          />
        ) : (
          !!user?.bio && <Text style={styles.bio}>{user.bio}</Text>
        )}
      </View>

      {/* Current status */}
      <Pressable testID="you-status-card" style={styles.card} onPress={() => router.push("/status")}>
        <Text style={styles.sectionLabel}>YOUR VIBE</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: st?.color || colors.onSurfaceSecondary }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{st?.label || "Not broadcasting"}</Text>
            {st && <Text style={styles.statusDesc}>{st.description}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceSecondary} />
        </View>
      </Pressable>

      {/* Privacy controls */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>PRIVACY</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Visible on radar</Text>
            <Text style={styles.toggleDesc}>Turn off to go invisible instantly.</Text>
          </View>
          <Switch
            testID="visibility-switch"
            value={!!user?.visible}
            onValueChange={setVisible}
            trackColor={{ false: colors.surfaceTertiary, true: colors.brandSecondary }}
            thumbColor={user?.visible ? colors.brandPrimary : colors.onSurfaceSecondary}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.sliderBlock}>
          <View style={styles.sliderHeader}>
            <Text style={styles.toggleTitle}>Discovery range</Text>
            <Text style={styles.radiusVal}>{radiusLocal}m</Text>
          </View>
          <View style={styles.rangeRow}>
            {RADIUS_OPTIONS.map((r) => {
              const active = radiusLocal === r;
              return (
                <Pressable
                  key={r}
                  testID={`radius-option-${r}`}
                  onPress={() => {
                    setRadiusLocal(r);
                    setRadius(r);
                  }}
                  style={[styles.rangeChip, active && styles.rangeChipActive]}
                >
                  <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                    {r}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.toggleDesc}>
            Only people within {radiusLocal} metres can see you. Intro caps at 50m so every
            connection stays truly face-to-face.
          </Text>
        </View>
      </View>

      <Pressable testID="logout-btn" style={styles.logout} onPress={async () => {
        await signOut();
        router.replace("/(auth)/onboarding");
      }}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  screenTitle: {
    color: colors.onSurface,
    fontSize: font.display,
    fontWeight: "500",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceTertiary },
  name: { color: colors.onSurface, fontSize: font.xl, fontWeight: "500" },
  nameInput: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "500",
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 2,
  },
  email: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 2 },
  bio: { color: colors.onSurfaceTertiary, fontSize: font.base, marginTop: spacing.lg, lineHeight: 20 },
  bioInput: {
    color: colors.onSurface,
    fontSize: font.base,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: "top",
  },
  sectionLabel: {
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "500" },
  statusDesc: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 2 },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  toggleTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "500" },
  toggleDesc: { color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: 4, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  sliderBlock: {},
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radiusVal: { color: colors.brandPrimary, fontSize: font.lg, fontWeight: "500" },
  rangeRow: { flexDirection: "row", gap: spacing.md, marginVertical: spacing.md },
  rangeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rangeChipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  rangeChipText: { color: colors.onSurfaceTertiary, fontSize: font.base, fontWeight: "500" },
  rangeChipTextActive: { color: colors.onBrandPrimary },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.error, fontSize: font.lg, fontWeight: "500" },
});

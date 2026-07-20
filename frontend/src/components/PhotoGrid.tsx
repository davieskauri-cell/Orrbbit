import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius, font } from "@/src/theme";

type Props = {
  photos: string[];
  onAdd: (uris: string[]) => void;
  onRemove: (index: number) => void;
  uploading?: boolean;
  max?: number;
  minRequired?: number;
};

const settingsAlert = () =>
  Alert.alert(
    "Photo access needed",
    "Enable photo access in Settings to add profile photos.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]
  );

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (perm.granted) return true;
  if (!perm.canAskAgain) {
    settingsAlert();
    return false;
  }
  if (perm.status === "undetermined") {
    const proceed = await new Promise<boolean>((resolve) =>
      Alert.alert(
        "Add your photos",
        "Intro uses your gallery so you can pick profile photos people nearby will see.",
        [
          { text: "Not now", style: "cancel", onPress: () => resolve(false) },
          { text: "Continue", onPress: () => resolve(true) },
        ]
      )
    );
    if (!proceed) return false;
  }
  perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted) return true;
  if (!perm.canAskAgain) settingsAlert();
  return false;
}

export default function PhotoGrid({ photos, onAdd, onRemove, uploading, max = 6, minRequired = 3 }: Props) {
  const pick = async () => {
    if (!(await ensurePermission())) return;
    const remaining = max - photos.length;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.4,
      base64: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const uris = res.assets
      .slice(0, remaining)
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri));
    onAdd(uris);
  };

  return (
    <View>
      <View style={styles.grid} testID="photo-grid">
        {photos.map((p, i) => (
          <View key={`${i}-${p.slice(0, 24)}`} style={styles.tile}>
            <Image source={{ uri: p }} style={styles.img} contentFit="cover" transition={150} />
            {i === 0 && (
              <View style={styles.mainTag}>
                <Text style={styles.mainTagText}>Main</Text>
              </View>
            )}
            <Pressable testID={`photo-remove-${i}`} style={styles.removeBtn} onPress={() => onRemove(i)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
        {photos.length < max && (
          <Pressable testID="photo-add" style={styles.addTile} onPress={pick} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.teal} />
            ) : (
              <>
                <Ionicons name="add" size={26} color={colors.teal} />
                <Text style={styles.addText}>Add photo</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Text
        style={[styles.hint, photos.length >= minRequired && { color: colors.success }]}
        testID="photo-count-hint"
      >
        {photos.length >= minRequired
          ? `${photos.length} photos added`
          : `${photos.length} of ${minRequired} minimum photos`}
      </Text>
    </View>
  );
}

const TILE = "31%";

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { width: TILE, aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.card },
  img: { width: "100%", height: "100%" },
  mainTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15,23,42,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  mainTagText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: TILE,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderStyle: "dashed",
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  hint: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm },
});

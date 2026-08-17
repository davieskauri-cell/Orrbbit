import { resolvePhotoUri } from "@/src/lib/photo";
import React from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { colors, spacing, radius, font } from "@/src/theme";

type Props = {
  photos: string[];
  onAdd: (uris: string[]) => void;
  onRemove: (index: number) => void;
  onReorder?: (from: number, to: number) => void;
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
        "Orrbbit uses your gallery so you can pick profile photos people nearby will see.",
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

const MAX_DIM = 1600;
const MAX_B64_BYTES = 5 * 1024 * 1024;

/**
 * Normalise any picked image (incl. iOS HEIC/HEIF, Android content:// URIs) to an
 * upload-safe JPEG data URI: corrected orientation, resized to <=1600px, ~82% quality.
 * Re-encoding strips all EXIF metadata including GPS location.
 */
async function normalisePhoto(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  try {
    const wide = Math.max(asset.width || 0, asset.height || 0);
    const actions: ImageManipulator.Action[] =
      wide > MAX_DIM
        ? [asset.width >= asset.height ? { resize: { width: MAX_DIM } } : { resize: { height: MAX_DIM } }]
        : [];
    const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) return null;
    if (out.base64.length > MAX_B64_BYTES * 1.4) return null; // > ~5MB after encoding
    return `data:image/jpeg;base64,${out.base64}`;
  } catch {
    // Fallback: use picker-provided base64 (already JPEG re-encoded by the picker)
    return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
  }
}

export default function PhotoGrid({ photos, onAdd, onRemove, onReorder, uploading, max = 6, minRequired = 2 }: Props) {
  const [processing, setProcessing] = React.useState(false);
  const busy = uploading || processing;

  const pick = async () => {
    if (busy) return; // prevent duplicate taps
    if (!(await ensurePermission())) return;
    const remaining = max - photos.length;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
      base64: true,
      exif: false,
    });
    if (res.canceled || !res.assets?.length) return; // cancellation is not an error
    setProcessing(true);
    try {
      const uris: string[] = [];
      for (const a of res.assets.slice(0, remaining)) {
        const norm = await normalisePhoto(a);
        if (norm) uris.push(norm);
      }
      if (uris.length) onAdd(uris);
      else Alert.alert("Couldn't read that photo", "Please try a different photo (JPEG, PNG or HEIC).");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View>
      <View style={styles.grid} testID="photo-grid">
        {photos.map((p, i) => (
          <View key={`${i}-${p.slice(0, 24)}`} style={styles.tile}>
            <Image source={{ uri: resolvePhotoUri(p) || p }} style={styles.img} contentFit="cover" transition={150} />
            {i === 0 && (
              <View style={styles.mainTag}>
                <Text style={styles.mainTagText}>Main</Text>
              </View>
            )}
            {!!onReorder && i > 0 && (
              <Pressable
                testID={`photo-make-main-${i}`}
                style={styles.mainBtn}
                accessibilityLabel="Make main photo"
                onPress={() => onReorder(i, 0)}
                hitSlop={8}
              >
                <Ionicons name="star-outline" size={13} color="#FFF" />
              </Pressable>
            )}
            {!!onReorder && i > 0 && (
              <Pressable
                testID={`photo-move-left-${i}`}
                style={styles.moveBtn}
                accessibilityLabel="Move photo earlier"
                onPress={() => onReorder(i, i - 1)}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={12} color="#FFF" />
              </Pressable>
            )}
            <Pressable
              testID={`photo-remove-${i}`}
              style={styles.removeBtn}
              onPress={() =>
                Alert.alert("Remove this photo?", i === 0 ? "This is your main profile photo. Your next photo will become the new main photo." : undefined, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive", onPress: () => onRemove(i) },
                ])
              }
              hitSlop={8}
            >
              <Ionicons name="close" size={14} color="#FFF" />
            </Pressable>
          </View>
        ))}
        {photos.length < max && (
          <Pressable testID="photo-add" style={styles.addTile} onPress={pick} disabled={busy}>
            {busy ? (
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
      {photos.length > 0 && (
        <View style={styles.previewRow} testID="avatar-crop-preview">
          <Image
            source={{ uri: resolvePhotoUri(photos[0]) || photos[0] }}
            style={styles.previewCircle}
            contentFit="cover"
          />
          <Text style={styles.previewText}>How your main photo appears to people nearby</Text>
        </View>
      )}
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
  mainBtn: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  moveBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  previewCircle: { width: 52, height: 52, borderRadius: 26 },
  previewText: { flex: 1, color: colors.textSecondary, fontSize: font.sm, lineHeight: 18 },
});

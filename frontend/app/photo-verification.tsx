import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, ScrollView, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import PhotoVerifiedBadge from "@/src/components/PhotoVerifiedBadge";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

type Status = { status: string; reason?: string | null; checked_at?: string | null; photo_verified: boolean };

/** Photo Verification — fresh FRONT-CAMERA live selfie compared against your profile
 * photos. Gallery photos can never be used, and uploading photos alone never verifies.
 * This is Photo Verification, not identity verification. */
export default function PhotoVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Status>("/users/me/photo-verification").then(setStatus).catch(() => setStatus({ status: "not_submitted", photo_verified: false }));
  }, []);

  const photosCount = (user?.photos || []).length || (user?.photo_url ? 1 : 0);

  const openCamera = async () => {
    setError("");
    if (!permission?.granted) {
      if (permission && !permission.canAskAgain) return; // settings button shown instead
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setCaptured(null);
    setCameraOpen(true);
  };

  const capture = async () => {
    try {
      const pic = await camRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
      if (pic?.base64) {
        setCaptured(`data:image/jpeg;base64,${pic.base64}`);
        setCameraOpen(false);
      }
    } catch {
      setError("Couldn't capture — please try again.");
    }
  };

  const submit = async () => {
    if (!captured) return;
    setSubmitting(true);
    setError("");
    try {
      const res: any = await api("/users/me/photo-verification", { method: "POST", body: { selfie: captured } });
      setStatus(res);
      if (res.user) setUser(res.user);
      setCaptured(null);
    } catch (e: any) {
      setError(e?.message || "Verification failed. Please try again.");
    }
    setSubmitting(false);
  };

  const blocked = permission && !permission.granted && !permission.canAskAgain;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View style={styles.header}>
        <Pressable testID="pv-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Photo Verification</Text>
        <View style={{ width: 26 }} />
      </View>

      {status?.photo_verified ? (
        <View style={[styles.card, shadow.card]} testID="pv-verified-state">
          <PhotoVerifiedBadge size={40} />
          <Text style={styles.verifiedTitle}>You{"'"}re Photo Verified</Text>
          <Text style={styles.sub}>
            The orange tick now appears beside your name so people nearby know your profile photos really show you.
          </Text>
          {!!status.checked_at && <Text style={styles.meta}>Verified {new Date(status.checked_at).toLocaleDateString()}</Text>}
        </View>
      ) : (
        <>
          <Text style={styles.sub}>
            Take a fresh selfie with your front camera. We compare it with your profile photos — if it{"'"}s you, you earn the
            orange <Text style={{ color: colors.orange, fontWeight: "800" }}>Photo Verified</Text> tick.
          </Text>

          <View style={styles.rules} testID="pv-rules">
            <View style={styles.ruleRow}>
              <Ionicons name="camera" size={15} color={colors.teal} />
              <Text style={styles.ruleText}>Front camera only — gallery photos can{"'"}t be used</Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons name="images" size={15} color={colors.teal} />
              <Text style={styles.ruleText}>Compared against your uploaded profile photos</Text>
            </View>
            <View style={styles.ruleRow}>
              <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
              <Text style={styles.ruleText}>Your live selfie is checked, then discarded — never stored or shown</Text>
            </View>
          </View>

          {photosCount === 0 && (
            <View style={styles.warnCard} testID="pv-no-photos">
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.warnText}>Add at least one profile photo first so we have something to compare with.</Text>
              <Pressable onPress={() => router.push("/edit-profile")} hitSlop={6}>
                <Text style={styles.warnAction}>Add photos</Text>
              </Pressable>
            </View>
          )}

          {status?.status === "failed" && !captured && !cameraOpen && (
            <View style={styles.failCard} testID="pv-failed-state">
              <Ionicons name="close-circle" size={16} color={colors.pink} />
              <Text style={styles.failText}>{status.reason || "Your last selfie didn't clearly match your profile photos. You can try again."}</Text>
            </View>
          )}

          {cameraOpen ? (
            <View style={styles.cameraWrap} testID="pv-camera">
              <CameraView ref={camRef} style={styles.camera} facing="front" />
              <View style={styles.cameraBar}>
                <Pressable testID="pv-cancel-camera" onPress={() => setCameraOpen(false)} hitSlop={8}>
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable testID="pv-capture" onPress={capture} style={styles.shutter}>
                  <View style={styles.shutterInner} />
                </Pressable>
                <View style={{ width: 48 }} />
              </View>
            </View>
          ) : captured ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <Image source={{ uri: captured }} style={styles.preview} testID="pv-preview" />
              {submitting ? (
                <View style={styles.checking} testID="pv-checking">
                  <ActivityIndicator color={colors.teal} />
                  <Text style={styles.checkingTxt}>Comparing with your profile photos…</Text>
                </View>
              ) : (
                <>
                  <PrimaryButton testID="pv-submit" title="Submit for verification" onPress={submit} />
                  <Pressable testID="pv-retake" onPress={openCamera} style={styles.retake}>
                    <Ionicons name="refresh" size={15} color={colors.teal} />
                    <Text style={styles.retakeTxt}>Retake selfie</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : blocked ? (
            <View style={[styles.card, shadow.card]} testID="pv-permission-blocked">
              <Ionicons name="videocam-off-outline" size={30} color={colors.textTertiary} />
              <Text style={styles.blockedTitle}>Camera access is turned off</Text>
              <Text style={styles.sub}>Photo Verification needs your front camera. Enable camera access in your device settings, then come back.</Text>
              <PrimaryButton
                testID="pv-open-settings"
                title="Open Settings"
                onPress={() => (Platform.OS === "web" ? null : Linking.openSettings())}
                style={{ marginTop: spacing.md, alignSelf: "stretch" }}
              />
            </View>
          ) : (
            <PrimaryButton
              testID="pv-start"
              title="Take live selfie"
              onPress={openCamera}
              disabled={photosCount === 0}
              style={{ marginTop: spacing.xl }}
            />
          )}

          {!!error && <Text style={styles.error} testID="pv-error">{error}</Text>}

          <Text style={styles.footnote}>
            Photo Verification confirms your profile photos show you. It is not identity or government ID verification.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  headerTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, marginTop: spacing.sm },
  rules: { marginTop: spacing.lg, gap: spacing.sm },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ruleText: { color: colors.text, fontSize: font.sm, fontWeight: "600", flex: 1 },
  warnCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  warnText: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  warnAction: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  failCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  failText: { color: colors.textSecondary, fontSize: font.sm, flex: 1 },
  cameraWrap: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" },
  camera: { width: "100%", aspectRatio: 3 / 4 },
  cameraBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, backgroundColor: "#000" },
  cancelTxt: { color: "#FFF", fontSize: font.base, fontWeight: "700", width: 48 },
  shutter: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF" },
  preview: { width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg },
  checking: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  checkingTxt: { color: colors.textSecondary, fontSize: font.base, fontWeight: "600" },
  retake: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 },
  retakeTxt: { color: colors.teal, fontSize: font.base, fontWeight: "700" },
  card: { alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, marginTop: spacing.lg },
  verifiedTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  blockedTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  meta: { color: colors.textTertiary, fontSize: font.sm },
  error: { color: colors.pink, fontSize: font.sm, fontWeight: "600", marginTop: spacing.md },
  footnote: { color: colors.textTertiary, fontSize: font.sm, lineHeight: 18, marginTop: spacing.xl },
});

import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { api } from "@/src/lib/api";
import { useTestMode } from "@/src/lib/testMode";
import { colors, spacing, radius, font } from "@/src/theme";

/**
 * Internal Device Diagnostics — QA/internal builds only.
 * Gated: visible only in development (__DEV__) or when Test Mode is unlocked
 * with the server-verified QA code. Shows NON-SENSITIVE status only:
 * never keys, tokens, credentials or location history.
 */
export default function Diagnostics() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [testMode] = useTestMode();
  const [rows, setRows] = useState<{ label: string; value: string; ok?: boolean }[] | null>(null);

  const allowed = __DEV__ || testMode;

  const run = useCallback(async () => {
    const out: { label: string; value: string; ok?: boolean }[] = [];
    out.push({ label: "App version", value: `Orrbbit v${Constants.expoConfig?.version || "1.0.0"}`, ok: true });
    out.push({ label: "Build profile", value: __DEV__ ? "development" : "internal/production build", ok: true });
    out.push({ label: "Expo SDK", value: String(Constants.expoConfig?.sdkVersion || "54"), ok: true });
    out.push({ label: "URL scheme", value: String(Constants.expoConfig?.scheme || "orrbbit"), ok: true });
    out.push({ label: "Deep link base", value: Linking.createURL("/"), ok: true });

    // Backend connectivity (no secrets — public health route)
    const t0 = Date.now();
    try {
      await api("/vibes");
      out.push({ label: "Backend connectivity", value: `OK · ${Date.now() - t0} ms`, ok: true });
    } catch (e: any) {
      out.push({ label: "Backend connectivity", value: `FAILED (${e.message || "network error"})`, ok: false });
    }

    // Location permission + accuracy
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      out.push({
        label: "Location permission",
        value: `${perm.status}${perm.canAskAgain === false ? " (blocked — use Settings)" : ""}`,
        ok: perm.status === "granted",
      });
      if (perm.status === "granted") {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          out.push({ label: "GPS accuracy", value: `${Math.round(last.coords.accuracy ?? 0)} m`, ok: (last.coords.accuracy ?? 999) < 100 });
          out.push({ label: "Last location update", value: new Date(last.timestamp).toLocaleTimeString(), ok: true });
          const speed = last.coords.speed ?? -1;
          out.push({ label: "Movement state", value: speed < 0 ? "unknown" : speed < 0.5 ? "stationary" : speed < 3 ? "walking" : "driving", ok: true });
        } else {
          out.push({ label: "GPS fix", value: "no fix yet — open Radar first", ok: false });
        }
      }
    } catch {
      out.push({ label: "Location", value: "unavailable on this platform", ok: false });
    }

    // Media library permission (camera capture not used — library only)
    try {
      const media = await ImagePicker.getMediaLibraryPermissionsAsync();
      out.push({ label: "Photo library permission", value: media.status, ok: media.status === "granted" });
    } catch {
      out.push({ label: "Photo library permission", value: "unavailable", ok: false });
    }
    out.push({ label: "Camera capture", value: "not used by app (library picker only)", ok: true });
    out.push({ label: "Push notifications", value: "not configured — requires google-services.json + native build", ok: false });
    setRows(out);
  }, []);

  useEffect(() => {
    if (allowed) run();
  }, [allowed, run]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 120, paddingHorizontal: spacing.xl }}>
        <View style={styles.header}>
          <Pressable testID="diag-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Device Diagnostics</Text>
        </View>

        {!allowed ? (
          <View style={styles.blocked} testID="diag-blocked">
            <Ionicons name="lock-closed-outline" size={28} color={colors.textTertiary} />
            <Text style={styles.blockedText}>Diagnostics are only available in internal QA builds.</Text>
          </View>
        ) : !rows ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.note}>Internal build tool. No keys, tokens or private data are shown.</Text>
            {rows.map((r) => (
              <View key={r.label} style={styles.row} testID={`diag-${r.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                <Ionicons
                  name={r.ok ? "checkmark-circle" : "alert-circle-outline"}
                  size={18}
                  color={r.ok ? colors.teal : colors.orange}
                />
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue} numberOfLines={2}>{r.value}</Text>
              </View>
            ))}
            <Pressable testID="diag-rerun" style={styles.rerun} onPress={() => { setRows(null); run(); }}>
              <Ionicons name="refresh" size={16} color="#FFF" />
              <Text style={styles.rerunText}>Re-run checks</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  note: { color: colors.textTertiary, fontSize: font.sm, marginBottom: spacing.lg },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.card,
    paddingHorizontal: spacing.lg, paddingVertical: 14, marginBottom: spacing.sm, minHeight: 52,
  },
  rowLabel: { color: colors.text, fontSize: font.sm, fontWeight: "600", flex: 1 },
  rowValue: { color: colors.textSecondary, fontSize: font.sm, flexShrink: 1, textAlign: "right", maxWidth: "50%" },
  blocked: { alignItems: "center", gap: spacing.md, marginTop: 60, paddingHorizontal: spacing.xl },
  blockedText: { color: colors.textTertiary, fontSize: font.base, textAlign: "center" },
  rerun: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.teal, borderRadius: 999, paddingVertical: 14, marginTop: spacing.lg, minHeight: 48,
  },
  rerunText: { color: "#FFF", fontWeight: "700", fontSize: font.base },
});

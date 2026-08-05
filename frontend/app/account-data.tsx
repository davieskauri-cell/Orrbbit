import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Platform, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { trackAccountDeleted } from "@/src/services/analyticsService";
import { colors, spacing, radius, font } from "@/src/theme";

const ROWS = [
  { icon: "lock-closed-outline", label: "Privacy Settings", route: "/privacy", testID: "ad-privacy" },
  { icon: "map-outline", label: "Location Privacy", route: "/location-privacy", testID: "ad-location" },
  { icon: "mail-outline", label: "Email Preferences", route: "/email-preferences", testID: "ad-email" },
  { icon: "ban-outline", label: "Blocked Users", route: "/blocked-users", testID: "ad-blocked" },
] as const;

export default function AccountDataScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const downloadData = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const data = await api("/users/me/data-export");
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "orrbbit-data-export.json";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: "My Orrbbit data", message: json });
      }
    } catch (e: any) {
      showAlert("Download failed", e.message || "Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const openDelete = () => {
    if (user?.is_demo) {
      showAlert("Not available", "Demo accounts can't be deleted.");
      return;
    }
    showAlert(
      "Delete your account?",
      "This permanently deletes your profile, photos, connections, pings, matches and meetup history. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: () => setDeleteVisible(true) },
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleteError(null);
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteError('Please type "DELETE" to confirm.');
      return;
    }
    if (!password) {
      setDeleteError("Please enter your password.");
      return;
    }
    setDeleting(true);
    try {
      await api("/users/me", { method: "DELETE", body: { password, confirmation: "DELETE" } });
      trackAccountDeleted();
      setDeleteVisible(false);
      await signOut();
      router.replace("/(auth)/onboarding");
    } catch (e: any) {
      setDeleteError(e.message || "Couldn't delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      testID="account-data-screen"
    >
      <View style={styles.headerRow}>
        <Pressable testID="ad-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Account &amp; Data</Text>
      </View>
      <Text style={styles.sub}>Manage your data, privacy preferences and account.</Text>

      <Text style={styles.sectionTitle}>Your data</Text>
      <View style={styles.menu}>
        <Pressable
          testID="ad-download"
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }]}
          onPress={downloadData}
        >
          <Ionicons name="download-outline" size={20} color={colors.teal} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{downloading ? "Preparing export…" : "Download my data"}</Text>
            <Text style={styles.rowHint}>Profile, consent records, reports and saved profiles</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.menu}>
        {ROWS.map((m) => (
          <Pressable
            key={m.label}
            testID={m.testID}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }]}
            onPress={() => router.push(m.route as any)}
          >
            <Ionicons name={m.icon as any} size={20} color={colors.teal} />
            <Text style={styles.rowLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.pink }]}>Danger zone</Text>
      <View style={[styles.menu, { borderColor: "#FECDD3" }]}>
        <Pressable
          testID="ad-delete-account"
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#FFF1F2" }]}
          onPress={openDelete}
        >
          <Ionicons name="trash-outline" size={20} color={colors.pink} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.pink }]}>Delete Account</Text>
            <Text style={styles.rowHint}>Permanently removes your account and personal data</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>

      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => setDeleteVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={26} color={colors.pink} />
            </View>
            <Text style={styles.modalTitle}>Confirm account deletion</Text>
            <Text style={styles.modalSub}>
              For your security, enter your password and type DELETE. This action is permanent and cannot be undone.
            </Text>
            <TextInput
              testID="delete-password-input"
              style={styles.modalInput}
              placeholder="Your password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              testID="delete-confirm-input"
              style={styles.modalInput}
              placeholder='Type "DELETE"'
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              value={confirmText}
              onChangeText={setConfirmText}
            />
            {deleteError && <Text testID="delete-error" style={styles.modalError}>{deleteError}</Text>}
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable
                testID="delete-cancel"
                style={styles.cancelBtn}
                onPress={() => { setDeleteVisible(false); setPassword(""); setConfirmText(""); setDeleteError(null); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable testID="delete-confirm" style={styles.deleteBtn} onPress={confirmDelete} disabled={deleting}>
                <Text style={styles.deleteBtnText}>{deleting ? "Deleting…" : "Delete forever"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  backBtn: { minHeight: 44, minWidth: 34, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  menu: {
    marginHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
    minHeight: 54,
  },
  rowLabel: { color: colors.text, fontSize: font.lg, fontWeight: "600" },
  rowHint: { color: colors.textTertiary, fontSize: font.sm, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(8,26,53,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: "#FFF", borderRadius: radius.card ?? 20, padding: spacing.xl, width: "100%", maxWidth: 380 },
  modalIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FFF1F2", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  modalSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 6, lineHeight: 20, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: font.base,
    marginTop: spacing.sm,
    minHeight: 48,
  },
  modalError: { color: colors.pink, fontSize: font.sm, marginTop: spacing.sm },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 999, backgroundColor: colors.card, minHeight: 46, justifyContent: "center" },
  cancelText: { color: colors.textSecondary, fontWeight: "700" },
  deleteBtn: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 999, backgroundColor: colors.pink, minHeight: 46, justifyContent: "center" },
  deleteBtnText: { color: "#FFF", fontWeight: "800" },
});

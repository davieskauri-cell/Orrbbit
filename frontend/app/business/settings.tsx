import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { openLegal } from "@/src/lib/legalLinks";
import { openBusinessDashboard, copyBusinessDashboardLink } from "@/src/lib/businessLinks";
import { useAuth } from "@/src/context/AuthContext";
import { getMyBusiness, saveBusiness, submitBusinessVerification, Business } from "@/src/services/businessService";

const NOTIF_PREFS = [
  { key: "events", label: "Event notifications" },
  { key: "attendees", label: "Attendee notifications" },
  { key: "reviews", label: "Review notifications" },
  { key: "verification", label: "Verification notifications" },
  { key: "account", label: "Account notifications" },
];

export default function BizSettings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [biz, setBiz] = useState<Business | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem("biz_notif_prefs").then((v) => {
      const stored = v ? JSON.parse(v) : {};
      const merged: Record<string, boolean> = {};
      NOTIF_PREFS.forEach((p) => { merged[p.key] = stored[p.key] !== false; });
      setPrefs(merged);
    }).catch(() => {});
  }, []));

  const togglePref = (key: string) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      AsyncStorage.setItem("biz_notif_prefs", JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const deleteAccount = () => router.push("/business-delete");

  useFocusEffect(useCallback(() => {
    getMyBusiness().then((r) => {
      setBiz(r.business);
      if (r.business) setForm({
        name: r.business.name, category: r.business.category, email: r.business.email,
        location_display: r.business.location_display, description: r.business.description,
        logo_url: r.business.logo_url, cover_url: r.business.cover_url,
        website: r.business.website, phone: r.business.phone, abn: r.business.abn,
        opening_hours: r.business.opening_hours,
      });
    }).catch(() => {});
  }, []));

  const set = (k: string) => (v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    try { await saveBusiness(form); showAlert("Saved", "Business details updated everywhere — desktop and mobile."); }
    catch (e: any) { showAlert("Settings", e?.message || "Could not save."); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    try {
      await submitBusinessVerification({ legal_name: form.name, abn: form.abn || "", email: form.email, website: form.website || "", address: form.location_display });
      showAlert("Submitted", "Verification submitted for review.");
    } catch (e: any) { showAlert("Verification", e?.message || "Could not submit."); }
  };

  const F = ({ label, k, multi }: { label: string; k: string; multi?: boolean }) => (
    <View>
      <Text style={st.label}>{label}</Text>
      <TextInput value={form[k] || ""} onChangeText={set(k)} multiline={multi} placeholderTextColor={colors.textTertiary}
        style={[st.input, multi && { minHeight: 70, textAlignVertical: "top" }]} testID={`bizset-${k}`} />
    </View>
  );

  return (
    <BizShell title="Settings">
      <BizCard>
        <F label="Business name" k="name" />
        <F label="Business email" k="email" />
        <F label="Location" k="location_display" />
        <F label="Description" k="description" multi />
        <F label="Website" k="website" />
        <F label="Phone" k="phone" />
        <F label="Opening hours" k="opening_hours" />
        <F label="ABN / registration" k="abn" />
        <Pressable testID="bizset-save" onPress={save} disabled={busy} style={[st.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={st.ctaTxt}>Save changes</Text>}
        </Pressable>
      </BizCard>
      {biz && ["Not Submitted", "More Info Required", "Rejected"].includes(biz.verification_status || "") && (
        <BizCard>
          <Text style={st.vTitle}>Business verification</Text>
          <Text style={st.vSub}>Status: {biz.verification_status}{biz.verification_note ? ` — ${biz.verification_note}` : ""}</Text>
          <Pressable testID="bizset-verify" onPress={verify} style={[st.cta, { backgroundColor: colors.teal }]}>
            <Text style={st.ctaTxt}>Submit for verification</Text>
          </Pressable>
        </BizCard>
      )}
      <BizCard>
        <Text style={st.vTitle}>Notifications</Text>
        {NOTIF_PREFS.map((p) => (
          <View key={p.key} style={st.prefRow}>
            <Text style={st.prefTxt}>{p.label}</Text>
            <Switch testID={`bizset-notif-${p.key}`} value={prefs[p.key] !== false} onValueChange={() => togglePref(p.key)}
              trackColor={{ true: colors.cobalt, false: colors.border }} thumbColor="#FFF" />
          </View>
        ))}
      </BizCard>
      <BizCard>
        <Text style={st.vTitle}>Subscription</Text>
        <LinkRow testID="bizset-sub" icon="card-outline" label="Orrbbit Business — Manage Subscription" onPress={() => router.push("/business/subscription")} />
      </BizCard>
      <BizCard>
        <Text style={st.vTitle}>Web access</Text>
        <LinkRow testID="bizset-open-dashboard" icon="desktop-outline" label="Open Business Dashboard" onPress={openBusinessDashboard} />
        <LinkRow testID="bizset-copy-dashboard" icon="copy-outline" label="Copy Dashboard Link" onPress={copyBusinessDashboardLink} />
      </BizCard>
      <BizCard>
        <Text style={st.vTitle}>Legal</Text>
        <LinkRow icon="document-text-outline" label="Terms of Service" onPress={() => openLegal("terms")} />
        <LinkRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => openLegal("privacy")} />
        <LinkRow icon="shield-outline" label="Safety Centre" onPress={() => openLegal("safety")} />
        <LinkRow icon="people-outline" label="Community Guidelines" onPress={() => openLegal("community_guidelines")} />
        <LinkRow icon="receipt-outline" label="Refund / Cancellation Policy" onPress={() => openLegal("refunds")} />
      </BizCard>
      <BizCard>
        <Text style={st.vTitle}>Support</Text>
        <LinkRow icon="help-buoy-outline" label="Contact Support" onPress={() => openLegal("support")} />
        <LinkRow icon="book-outline" label="Help Centre" onPress={() => openLegal("support")} />
        <LinkRow icon="key-outline" label="Password / Security" onPress={() => router.push("/(auth)/forgot-password")} />
      </BizCard>
      <BizCard>
        <Text style={st.vTitle}>Account actions</Text>
        <LinkRow testID="bizset-signout" icon="log-out-outline" label="Sign Out" danger onPress={signOut} />
        <LinkRow testID="bizset-delete" icon="trash-outline" label="Delete Business Account" danger onPress={deleteAccount} />
      </BizCard>
    </BizShell>
  );
}

function LinkRow({ icon, label, onPress, danger, testID }: { icon: string; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={st.linkRow}>
      <Ionicons name={icon as any} size={17} color={danger ? "#DC2626" : colors.cobalt} />
      <Text style={[st.linkTxt, danger && { color: "#DC2626" }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.md, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: font.base },
  cta: { backgroundColor: colors.cobalt, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base },
  vTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  vSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4 },
  prefRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.card, minHeight: 44 },
  prefTxt: { color: colors.text, fontSize: font.base, fontWeight: "600" },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.card, minHeight: 44 },
  linkTxt: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "600" },
});

import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { showAlert } from "@/src/lib/alert";
import { getMyBusiness, saveBusiness, submitBusinessVerification, Business } from "@/src/services/businessService";

export default function BizSettings() {
  const [biz, setBiz] = useState<Business | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

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
    </BizShell>
  );
}

const st = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.md, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: font.base },
  cta: { backgroundColor: colors.cobalt, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.base },
  vTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  vSub: { color: colors.textSecondary, fontSize: font.sm, marginTop: 4 },
});

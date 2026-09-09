import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { getMyBusiness, Business } from "@/src/services/businessService";

export default function BizProfilePage() {
  const router = useRouter();
  const [biz, setBiz] = useState<Business | null>(null);
  useFocusEffect(useCallback(() => { getMyBusiness().then((r) => setBiz(r.business)).catch(() => {}); }, []));

  return (
    <BizShell title="Business Profile">
      {biz && (
        <BizCard>
          {!!biz.cover_url && <Image source={{ uri: biz.cover_url }} style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: spacing.md }} />}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {biz.logo_url ? <Image source={{ uri: biz.logo_url }} style={st.logo} /> :
              <View style={[st.logo, { backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center" }]}><Ionicons name="storefront" size={22} color={colors.cobalt} /></View>}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={st.name}>{biz.name}</Text>
                {biz.verified && <Ionicons name="checkmark-circle" size={18} color={colors.teal} />}
              </View>
              <Text style={st.meta}>{biz.category} · {biz.location_display}</Text>
              <Text style={st.meta}>Verification: {biz.verification_status}</Text>
            </View>
          </View>
          <Text style={st.desc}>{biz.description}</Text>
          {!!biz.website && <Text style={st.meta}>🌐 {biz.website}</Text>}
          {!!biz.phone && <Text style={st.meta}>📞 {biz.phone}</Text>}
          <Text style={st.meta}>✉️ {biz.email}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
            <Pressable testID="bizprofile-public" onPress={() => router.push(`/business/${biz.slug || biz.id}`)} style={st.btn}><Text style={st.btnTxt}>View Public Profile</Text></Pressable>
            <Pressable testID="bizprofile-edit" onPress={() => router.push("/business/settings")} style={st.btn}><Text style={st.btnTxt}>Edit in Settings</Text></Pressable>
          </View>
        </BizCard>
      )}
    </BizShell>
  );
}

const st = StyleSheet.create({
  logo: { width: 56, height: 56, borderRadius: 14 },
  name: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  desc: { color: colors.text, fontSize: font.base, lineHeight: 21, marginTop: spacing.md },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  btnTxt: { color: colors.text, fontWeight: "700", fontSize: font.sm },
});

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, font } from "@/src/theme";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

/** Secure single-use link landing (from the "Complete Business Verification on
 * Computer" email). Server validates the token; same account, same submission. */
export default function BusinessVerifyLink() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { adoptSession } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMsg("Missing verification link token."); return; }
    api<{ access_token: string; user: any }>("/business/verification-link/redeem", {
      method: "POST", body: { token: String(token) },
    })
      .then(async (r) => {
        await adoptSession(r.access_token, r.user);
        setState("ok");
        setTimeout(() => router.replace("/business-setup"), 900);
      })
      .catch((e: any) => { setState("error"); setMsg(e?.message || "This link is invalid or has expired."); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <View style={st.wrap}>
      <View style={st.card}>
        <Text style={st.brand}>orrbbit <Text style={{ color: colors.cobalt }}>business</Text></Text>
        {state === "working" && (<><ActivityIndicator color={colors.cobalt} style={{ marginTop: spacing.xl }} /><Text style={st.txt}>Validating your secure verification link…</Text></>)}
        {state === "ok" && (<><Ionicons name="checkmark-circle" size={40} color={colors.teal} style={{ marginTop: spacing.xl, alignSelf: "center" }} /><Text style={st.txt}>Link verified — continuing your Business verification…</Text></>)}
        {state === "error" && (<>
          <Ionicons name="alert-circle" size={40} color="#DC2626" style={{ marginTop: spacing.xl, alignSelf: "center" }} />
          <Text style={st.txt} testID="bizverify-error">{msg}</Text>
          <Pressable onPress={() => router.replace("/business/login")} style={st.cta}><Text style={st.ctaTxt}>Go to Business login</Text></Pressable>
        </>)}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F6F8FB", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.xxl },
  brand: { color: colors.text, fontSize: font.xl, fontWeight: "800", textAlign: "center" },
  txt: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", marginTop: spacing.md, lineHeight: 19 },
  cta: { backgroundColor: colors.cobalt, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: spacing.lg },
  ctaTxt: { color: "#FFF", fontWeight: "800", fontSize: font.sm },
});

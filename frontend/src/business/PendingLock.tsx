import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, font } from "@/src/theme";
import { openLegal } from "@/src/lib/legalLinks";
import { useAuth } from "@/src/context/AuthContext";
import { Business } from "@/src/services/businessService";

/** Locked-state panel for non-Verified businesses (Pending / In Review / More Info…).
 * Full Business Dashboard, Events publishing and analytics stay locked until
 * Control Centre approval — enforced server-side too. */
export default function PendingLock({ biz, status }: { biz?: Business | null; status: string }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const moreInfo = status === "More Info Required" || status === "Reverification Required";
  const inProgress = status === "In Progress" || status === "Not Submitted";
  return (
    <View style={st.wrap} testID="biz-pending-lock">
      <View style={st.iconCircle}>
        <Ionicons name={moreInfo ? "alert-circle" : "time"} size={40} color={colors.cobalt} />
      </View>
      <Text style={st.title}>
        {moreInfo ? "More information required" : inProgress ? "Finish your verification" : "Verification Pending"}
      </Text>
      <Text style={st.txt}>
        {moreInfo
          ? "Orrbbit needs more information to verify your business. Continue verification to respond."
          : inProgress
            ? "Complete and submit your business verification to unlock your Business Dashboard."
            : "Your Business verification has been submitted and is currently being reviewed by Orrbbit. We'll email you as soon as your Business is approved or if we need more information."}
      </Text>
      {biz && (
        <View style={st.card}>
          <Text style={st.cardTitle}>Submitted details</Text>
          {[
            ["Business", biz.name],
            ["Category", biz.category],
            ["Country", (biz as any).country || "—"],
            ["Verification", status],
            ["Subscription", (biz.subscription?.status || "not subscribed").replace("_", " ")],
          ].map(([k, v]) => (
            <View key={k as string} style={st.kvRow}>
              <Text style={st.kvKey}>{k}</Text>
              <Text style={st.kvVal}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      <Pressable testID="biz-lock-continue" onPress={() => router.push("/(auth)/business-setup")} style={st.primary}>
        <Text style={st.primaryTxt}>{moreInfo || inProgress ? "Continue Verification" : "View Verification Status"}</Text>
      </Pressable>
      <Pressable onPress={() => openLegal("support")} style={st.linkRow} hitSlop={8}>
        <Text style={st.linkTxt}>Contact Support</Text>
      </Pressable>
      <Pressable testID="biz-lock-logout" onPress={signOut} style={st.linkRow} hitSlop={8}>
        <Text style={[st.linkTxt, { color: "#DC2626" }]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: spacing.xl },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800", textAlign: "center" },
  txt: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, maxWidth: 340 },
  card: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: font.sm, fontWeight: "800", marginBottom: 6 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.card },
  kvKey: { color: colors.textSecondary, fontSize: font.sm },
  kvVal: { color: colors.text, fontSize: font.sm, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  primary: { alignSelf: "stretch", backgroundColor: colors.cobalt, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  primaryTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
  linkRow: { minHeight: 40, justifyContent: "center", marginTop: spacing.sm },
  linkTxt: { color: colors.teal, fontSize: font.sm, fontWeight: "700", textDecorationLine: "underline" },
});

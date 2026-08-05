import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { LEGAL_LINKS } from "@/src/lib/legalLinks";
import { colors, spacing, radius, font } from "@/src/theme";

type Policy = { key: string; title: string; url: string; version: string; effective_date: string; status: string };

const SECTIONS: { title: string; keys: string[] }[] = [
  { title: "Legal", keys: ["terms", "privacy", "cookies", "copyright", "refunds"] },
  { title: "Safety & Community", keys: ["safety", "community_guidelines", "child_safety", "location_privacy", "moderation_appeals"] },
  { title: "Professional Mode", keys: ["professional_services", "professional_verification"] },
  { title: "Account & Support", keys: ["delete_account", "support"] },
];

const FALLBACK_TITLES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  community_guidelines: "Community Guidelines",
  safety: "Safety Policy",
  location_privacy: "Location & Radar Privacy Notice",
  child_safety: "Child Safety Standards",
  moderation_appeals: "Moderation & Appeals",
  professional_services: "Professional Services Terms",
  professional_verification: "Professional Verification Policy",
  delete_account: "Account Deletion & Data Retention",
  copyright: "Copyright / IP Policy",
  support: "Support & Contact",
  cookies: "Cookie Policy",
  refunds: "Refund Policy",
};

export default function LegalSafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [registry, setRegistry] = useState<Record<string, Policy>>({});
  const [meta, setMeta] = useState<{ version?: string; effective?: string }>({});

  useEffect(() => {
    api<{ policies: Policy[] }>("/policies")
      .then((res) => {
        const map: Record<string, Policy> = {};
        res.policies.forEach((p) => { map[p.key] = p; });
        setRegistry(map);
        if (res.policies[0]) setMeta({ version: res.policies[0].version, effective: res.policies[0].effective_date });
      })
      .catch(() => {});
  }, []);

  const open = (key: string) => {
    const url = registry[key]?.url || (LEGAL_LINKS as any)[key];
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
      testID="legal-safety-screen"
    >
      <View style={styles.headerRow}>
        <Pressable testID="legal-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Legal &amp; Safety</Text>
      </View>
      <Text style={styles.sub}>
        Orrbbit&apos;s policies keep the community safe. Documents open on orrbbit.com.
      </Text>

      <Pressable testID="safety-tips-row" style={styles.tipsCard} onPress={() => router.push("/safety")}>
        <View style={styles.tipsIcon}>
          <Ionicons name="shield-checkmark" size={20} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipsTitle}>Safety Tips</Text>
          <Text style={styles.tipsText}>In-app guidance for meeting people safely</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </Pressable>

      {SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menu}>
            {section.keys.map((key) => (
              <Pressable
                key={key}
                testID={`legal-${key}`}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }]}
                onPress={() => open(key)}
              >
                <Ionicons name="document-text-outline" size={19} color={colors.teal} />
                <Text style={styles.rowLabel}>{registry[key]?.title || FALLBACK_TITLES[key]}</Text>
                <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable
        testID="legal-all-policies"
        style={styles.allPolicies}
        onPress={() => Linking.openURL(LEGAL_LINKS.policies).catch(() => {})}
      >
        <Text style={styles.allPoliciesText}>View all policies on orrbbit.com</Text>
        <Ionicons name="open-outline" size={15} color={colors.orange} />
      </Pressable>

      {meta.version && (
        <Text style={styles.versionNote}>
          Policies version {meta.version} · Effective {meta.effective}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  backBtn: { minHeight: 44, minWidth: 34, justifyContent: "center" },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, paddingHorizontal: spacing.xl, marginTop: spacing.xs, marginBottom: spacing.lg },
  tipsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 64,
  },
  tipsIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.teal, alignItems: "center", justifyContent: "center" },
  tipsTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  tipsText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 1 },
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
    minHeight: 52,
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "600" },
  allPolicies: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xl,
    minHeight: 44,
  },
  allPoliciesText: { color: colors.orange, fontSize: font.base, fontWeight: "700" },
  versionNote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.md },
});

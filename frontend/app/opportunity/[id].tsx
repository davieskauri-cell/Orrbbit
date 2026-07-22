import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useApp } from "@/src/context/AppContext";
import { requestConnection } from "@/src/services/matchingService";
import { showAlert } from "@/src/lib/alert";
import { trackMatchCreated } from "@/src/services/analyticsService";
import { distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const AMBER = "#F59E0B";

type OpportunityData = {
  user: {
    id: string;
    name: string;
    age: number;
    photo_url: string | null;
    verified: boolean;
    active_now: boolean;
    bio: string;
    city: string;
  };
  opportunity: {
    opportunity_type: string | null;
    category: string | null;
    public_summary: string | null;
    payment: string | null;
  };
  connected: boolean;
  request_status: "connected" | "pending" | "declined" | "none";
  private_details: string | null;
};

export default function OpportunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findUser } = useApp();
  const [data, setData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const nearbyUser = findUser(id!);

  const load = async () => {
    try {
      const res = await api<OpportunityData>(`/opportunity/${id}`);
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const discuss = async () => {
    if (!data) return;
    if (data.connected) {
      router.push({
        pathname: "/match",
        params: { userId: data.user.id, name: data.user.name, photo: data.user.photo_url || "", vibe: "opportunity" },
      });
      return;
    }
    setBusy(true);
    try {
      const res = await requestConnection(data.user.id);
      if (res.status === "connected") {
        trackMatchCreated();
        await load();
      } else {
        setData({ ...data, request_status: "pending" });
        showAlert("Request sent", `${data.user.name} will be asked to accept. Private details unlock once they do.`);
      }
    } catch (e: any) {
      showAlert("Couldn't send request", e.message || "Please try again.");
    }
    setBusy(false);
  };

  if (loading || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={AMBER} />
      </View>
    );
  }

  const opp = data.opportunity;
  const metaLine = [opp.category, opp.opportunity_type].filter(Boolean).join(" · ");

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 160, paddingHorizontal: spacing.xl }}
        testID="opportunity-screen"
      >
        <View style={styles.header}>
          <Pressable testID="opportunity-close" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.headerBadge}>
            <Ionicons name="sparkles" size={13} color={AMBER} />
            <Text style={styles.headerBadgeText}>Opportunity</Text>
          </View>
        </View>

        {!!metaLine && <Text style={styles.metaLine}>{metaLine}</Text>}
        {!!opp.payment && (
          <View style={styles.payChip}>
            <Ionicons name="cash-outline" size={13} color={AMBER} />
            <Text style={styles.payChipText}>{opp.payment}</Text>
          </View>
        )}
        {!!nearbyUser && <Text style={styles.dist}>{distLabel(nearbyUser.distance)}</Text>}

        <Text style={styles.sectionLabel}>PUBLIC SUMMARY</Text>
        <View style={[styles.summaryCard, shadow.card]}>
          <Text style={styles.summaryText}>{opp.public_summary || "No summary provided."}</Text>
        </View>

        <Text style={styles.sectionLabel}>PRIVATE DETAILS</Text>
        {data.connected && data.private_details ? (
          <View style={[styles.privateCard, styles.privateUnlocked]} testID="private-unlocked">
            <View style={styles.privateHead}>
              <Ionicons name="lock-open" size={14} color={colors.success} />
              <Text style={[styles.privateHeadText, { color: colors.success }]}>Unlocked · you're connected</Text>
            </View>
            <Text style={styles.privateText}>{data.private_details}</Text>
          </View>
        ) : (
          <View style={styles.privateCard} testID="private-locked">
            <View style={styles.privateHead}>
              <Ionicons
                name={data.request_status === "pending" ? "time-outline" : "lock-closed"}
                size={14}
                color={colors.textTertiary}
              />
              <Text style={styles.privateHeadText}>
                {data.request_status === "pending" ? "Request sent" : "Locked"}
              </Text>
            </View>
            <Text style={styles.privateLockedText}>
              {data.request_status === "pending"
                ? `Waiting for ${data.user.name} to accept. Private details unlock once they do.`
                : data.request_status === "declined"
                ? "This request is no longer active. Private details stay locked."
                : "Private details unlock after you both connect."}
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>SHARED BY</Text>
        <View style={[styles.profileCard, shadow.card]} testID="opportunity-profile-card">
          <Avatar uri={data.user.photo_url} name={data.user.name} size={54} ringColor={AMBER} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.profileName}>
                {data.user.name}, {data.user.age}
              </Text>
              {data.user.verified && <Ionicons name="checkmark-circle" size={17} color={colors.teal} />}
            </View>
            <Text style={styles.profileMeta}>
              Local{data.user.active_now ? " · Active now" : ""}
            </Text>
            {!!data.user.bio && (
              <Text style={styles.profileBio} numberOfLines={2}>
                {data.user.bio}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={15} color={colors.teal} />
          <Text style={styles.privacyText}>
            Approximate distance only. Exact locations are never shared on IntroYu.
          </Text>
        </View>

        <Pressable
          testID="opportunity-report"
          style={styles.reportLink}
          onPress={() => router.push({ pathname: "/report", params: { userId: data.user.id, name: data.user.name } })}
        >
          <Text style={styles.reportText}>Report this opportunity</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="discuss-opportunity"
          title={
            data.connected
              ? "Discuss Opportunity"
              : data.request_status === "pending"
              ? "Request Sent ✓"
              : data.request_status === "declined"
              ? "No Longer Active"
              : "Discuss Opportunity"
          }
          color={AMBER}
          onPress={discuss}
          loading={busy}
          disabled={!data.connected && (data.request_status === "pending" || data.request_status === "declined")}
        />
        <View style={styles.footerRow}>
          <SecondaryButton
            testID="meet-safely"
            title="Meet Safely"
            onPress={() =>
              data.connected
                ? router.push({
                    pathname: "/match",
                    params: { userId: data.user.id, name: data.user.name, photo: data.user.photo_url || "", vibe: "opportunity" },
                  })
                : router.push("/safety")
            }
            style={{ flex: 1, minHeight: 44 }}
          />
          <SecondaryButton
            testID="maybe-later"
            title="Maybe Later"
            onPress={() => router.back()}
            style={{ flex: 1, minHeight: 44, borderWidth: 0 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AMBER + "1A",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerBadgeText: { color: AMBER, fontSize: font.base, fontWeight: "800" },
  metaLine: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginTop: spacing.lg },
  payChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: AMBER + "12",
    borderWidth: 1,
    borderColor: AMBER + "44",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  payChipText: { color: AMBER, fontSize: font.sm, fontWeight: "700" },
  dist: { color: colors.teal, fontSize: font.sm, fontWeight: "600", marginTop: spacing.sm },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: font.sm,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryText: { color: colors.text, fontSize: font.lg, lineHeight: 23, fontWeight: "600" },
  privateCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  privateUnlocked: { backgroundColor: "#F4FBF6", borderColor: colors.success + "55" },
  privateHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  privateHeadText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "800" },
  privateText: { color: colors.text, fontSize: font.base, lineHeight: 21 },
  privateLockedText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  profileName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  profileMeta: { color: colors.success, fontSize: font.sm, fontWeight: "700" },
  profileBio: { color: colors.textSecondary, fontSize: font.sm, lineHeight: 18 },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1 },
  reportLink: { alignSelf: "center", padding: spacing.md, marginTop: spacing.sm },
  reportText: { color: colors.pink, fontSize: font.sm, fontWeight: "700" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  footerRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});

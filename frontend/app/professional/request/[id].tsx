import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { requestConnection } from "@/src/services/matchingService";
import { timeAgo, distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const AMBER = "#F59E0B";

export default function HelpRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await api<any>(`/help-requests/${id}`));
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const offer = async () => {
    if (!data?.user) return;
    setBusy(true);
    try {
      const res = await requestConnection(data.user.id, data.id);
      if (res.status === "connected") await load();
      else {
        setData({ ...data, request_status: "pending" });
        showAlert("Offer sent", `${data.user.name} will be asked to accept before you're connected.`);
      }
    } catch (e: any) {
      showAlert("Couldn't send offer", e.message || "Please try again.");
    }
    setBusy(false);
  };

  if (loading || !data) {
    return <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}><ActivityIndicator color={AMBER} /></View>;
  }

  const pendingState = data.request_status === "pending";
  const declined = data.request_status === "declined";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: 160, paddingHorizontal: spacing.xl }} testID="help-request-screen">
        <View style={styles.header}>
          <Pressable testID="hr-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.headerBadge}>
            <Ionicons name="help-buoy" size={13} color={AMBER} />
            <Text style={styles.headerBadgeText}>Need Help</Text>
          </View>
        </View>

        <Text style={styles.category}>{data.category}</Text>
        <Text style={styles.summary}>{data.public_summary}</Text>
        <View style={styles.metaRow}>
          {data.distance != null && <Text style={styles.meta}>{distLabel(data.distance)}</Text>}
          <Text style={styles.meta}>· {data.payment}</Text>
          <Text style={styles.meta}>· expires {timeAgo(data.expires_at).replace(" ago", "")}</Text>
        </View>
        <Text style={styles.posted}>Posted {timeAgo(data.created_at)}</Text>
        {!!data.availability && <Text style={styles.meta}>Availability: {data.availability}</Text>}

        <Text style={styles.sectionLabel}>PRIVATE DETAILS</Text>
        {data.private_details ? (
          <View style={[styles.privateCard, { backgroundColor: "#F4FBF6", borderColor: colors.success + "55" }]} testID="hr-private-unlocked">
            <View style={styles.privateHead}>
              <Ionicons name="lock-open" size={14} color={colors.success} />
              <Text style={[styles.privateHeadText, { color: colors.success }]}>Unlocked · connected</Text>
            </View>
            <Text style={styles.privateText}>{data.private_details}</Text>
          </View>
        ) : (
          <View style={styles.privateCard} testID="hr-private-locked">
            <View style={styles.privateHead}>
              <Ionicons name={pendingState ? "time-outline" : "lock-closed"} size={14} color={colors.textTertiary} />
              <Text style={styles.privateHeadText}>{pendingState ? "Offer sent" : "Locked"}</Text>
            </View>
            <Text style={styles.privateLockedText}>
              {pendingState
                ? "Waiting for them to accept your offer. Private details unlock once they do."
                : declined
                ? "This offer is no longer active. Private details stay locked."
                : "Private details unlock only if they accept your offer to help."}
            </Text>
          </View>
        )}

        {data.user && (
          <>
            <Text style={styles.sectionLabel}>POSTED BY</Text>
            <View style={[styles.userCard, shadow.card]}>
              <Avatar uri={data.user.photo_url} name={data.user.name} size={46} ringColor={AMBER} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.userName}>{data.user.name}</Text>
                  {data.user.verified && <Ionicons name="checkmark-circle" size={15} color={colors.teal} />}
                </View>
                <Text style={styles.meta}>Local{data.user.active_now ? " · Active now" : ""}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
          <Text style={styles.privacyText}>Approximate distance only. No exact pin is ever shown.</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          testID="offer-help"
          title={data.connected ? "Discuss" : pendingState ? "Offer Sent ✓" : declined ? "No Longer Active" : "Offer Help"}
          color={AMBER}
          onPress={data.connected ? () => router.push({ pathname: "/match", params: { userId: data.user.id, name: data.user.name, photo: data.user.photo_url || "", vibe: "networking" } }) : offer}
          loading={busy}
          disabled={pendingState || declined}
        />
        <SecondaryButton testID="not-interested" title="Not Interested" onPress={() => router.back()} style={{ marginTop: spacing.sm, borderWidth: 0, minHeight: 44 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: AMBER + "1A", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
  headerBadgeText: { color: AMBER, fontSize: font.base, fontWeight: "800" },
  category: { color: colors.teal, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, marginTop: spacing.lg, textTransform: "uppercase" },
  summary: { color: colors.text, fontSize: font.xl, fontWeight: "800", marginTop: spacing.xs },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: spacing.sm },
  meta: { color: colors.textSecondary, fontSize: font.sm },
  posted: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2 },
  sectionLabel: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  privateCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  privateHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  privateHeadText: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "800" },
  privateText: { color: colors.text, fontSize: font.base, lineHeight: 21 },
  privateLockedText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg },
  userName: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xl },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});

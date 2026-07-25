import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import BrandHeader from "@/src/components/BrandHeader";
import EmptyState from "@/src/components/EmptyState";
import ProfessionalRequestCard from "@/src/components/professional/ProfessionalRequestCard";
import { timeAgo } from "@/src/lib/format";
import { colors, spacing, radius, font } from "@/src/theme";

/** Professional Mode "Requests" tab — received + sent structured connection requests. */
export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<{ sent: any[]; received: any[] }>({ sent: [], received: [] });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api("/professional/connect/requests"));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accept = async (r: any) => {
    try {
      const res = await api(`/professional/connect/requests/${r.id}/accept`, { method: "POST" });
      load();
      showAlert("Request accepted", `Your conversation with ${r.user?.name} is now unlocked in Sessions.`, [
        { text: "Later", style: "cancel" },
        { text: "Start Conversation", onPress: () => router.push(`/professional/session/${res.session.id}`) },
      ]);
    } catch (e: any) {
      showAlert("Couldn't accept", e.message || "Try again.");
    }
  };

  const decline = (r: any) => {
    showAlert("Decline this request?", `${r.user?.name} will be notified neutrally. Messaging stays locked.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/professional/connect/requests/${r.id}/decline`, { method: "POST" });
            load();
          } catch (e: any) {
            showAlert("Couldn't decline", e.message || "Try again.");
          }
        },
      },
    ]);
  };

  const pendingReceived = data.received.filter((r) => r.status === "pending");
  const historyReceived = data.received.filter((r) => r.status !== "pending");
  const empty = data.received.length === 0 && data.sent.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="pro-requests-screen">
      <BrandHeader />
      <Text style={styles.h1}>Requests</Text>
      <Text style={styles.sub}>Structured connection requests. Messaging unlocks only after acceptance.</Text>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.teal}
          />
        }
      >
        {empty && (
          <EmptyState
            testID="requests-empty"
            icon="file-tray-outline"
            title="No requests yet"
            text="Requests you send to professionals — and requests sent to you — will appear here."
          />
        )}

        {pendingReceived.length > 0 && (
          <>
            <Text style={styles.section}>Received · {pendingReceived.length} pending</Text>
            {pendingReceived.map((r) => (
              <ProfessionalRequestCard
                key={r.id}
                r={r}
                onAccept={() => accept(r)}
                onDecline={() => decline(r)}
                onViewProfile={() => router.push(`/person/${r.user.id}`)}
              />
            ))}
          </>
        )}

        {data.sent.length > 0 && (
          <>
            <Text style={styles.section}>Sent</Text>
            {data.sent.map((r) => (
              <View key={r.id} style={styles.sentCard} testID={`sent-request-${r.id}`}>
                <Avatar uri={r.user?.photo_url} name={r.user?.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.sentName}>{r.user?.name}</Text>
                  <Text style={styles.sentMeta}>
                    {[r.professional?.profession, r.category, timeAgo(r.created_at)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {r.status === "accepted" && r.session_id ? (
                  <Pressable
                    testID={`start-conversation-${r.id}`}
                    style={styles.startBtn}
                    onPress={() => router.push(`/professional/session/${r.session_id}`)}
                  >
                    <Ionicons name="chatbubbles" size={13} color="#FFF" />
                    <Text style={styles.startBtnText}>Open</Text>
                  </Pressable>
                ) : (
                  <Text
                    style={[
                      styles.sentStatus,
                      {
                        color:
                          r.status === "pending"
                            ? colors.warning
                            : r.status === "accepted"
                            ? colors.success
                            : colors.textTertiary,
                      },
                    ]}
                  >
                    {r.status === "pending" ? "Pending" : r.status === "accepted" ? "Accepted" : "Declined"}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {historyReceived.length > 0 && (
          <>
            <Text style={styles.section}>Received · history</Text>
            {historyReceived.map((r) => (
              <ProfessionalRequestCard
                key={r.id}
                r={r}
                onAccept={() => {}}
                onDecline={() => {}}
                onViewProfile={() => router.push(`/person/${r.user.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  h1: { color: colors.text, fontSize: font.xxl, fontWeight: "800", paddingHorizontal: spacing.xl },
  sub: { color: colors.textSecondary, fontSize: font.sm, paddingHorizontal: spacing.xl, marginTop: 2, marginBottom: spacing.sm },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  section: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  sentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  sentName: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  sentMeta: { color: colors.textSecondary, fontSize: font.sm },
  sentStatus: { fontSize: font.sm, fontWeight: "800" },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.teal,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  startBtnText: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
});

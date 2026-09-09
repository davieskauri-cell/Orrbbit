import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, font } from "@/src/theme";
import { api } from "@/src/lib/api";

type Notif = { id: string; type: string; title: string; body: string; read?: boolean; created_at: string; event_id?: string; review_id?: string };

export default function BusinessNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notif[]>([]);

  useFocusEffect(useCallback(() => {
    api<{ notifications: Notif[] }>("/notifications").then((r) => setItems(r.notifications)).catch(() => {});
  }, []));

  const open = async (n: Notif) => {
    api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.event_id) router.push(`/event/${n.event_id}`);
  };

  return (
    <View style={[st.wrap, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={st.title}>Notifications</Text>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}
        ListEmptyComponent={<Text style={st.empty}>Attendee activity, reviews and verification updates appear here.</Text>}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={[st.row, !n.read && st.unread]}>
            <Ionicons
              name={n.type.includes("review") ? "star" : n.type.includes("verification") ? "shield-checkmark" : "notifications"}
              size={18} color={colors.cobalt} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={st.nTitle}>{n.title}</Text>
              <Text style={st.nBody}>{n.body}</Text>
              <Text style={st.nTime}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800", paddingHorizontal: spacing.xl },
  empty: { color: colors.textTertiary, textAlign: "center", marginTop: spacing.xxl, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface },
  unread: { backgroundColor: colors.cobaltSoft, borderColor: colors.cobalt },
  nTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  nBody: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 18 },
  nTime: { color: colors.textTertiary, fontSize: 11, marginTop: 4 },
});

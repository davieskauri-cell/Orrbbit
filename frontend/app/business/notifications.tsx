import React, { useCallback, useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import BizShell, { BizCard } from "@/src/business/BizShell";
import { colors, font } from "@/src/theme";
import { api } from "@/src/lib/api";

export default function BizNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  useFocusEffect(useCallback(() => {
    api<{ notifications: any[] }>("/notifications").then((r) => setItems(r.notifications)).catch(() => {});
  }, []));

  const open = (n: any) => {
    api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.event_id) router.push(`/business/events/${n.event_id}`);
  };

  return (
    <BizShell title="Notifications">
      <BizCard>
        {items.length === 0 ? <Text style={st.empty}>Attendee activity, reviews, verification and subscription updates appear here — shared with the mobile app.</Text> :
          items.map((n) => (
            <Pressable key={n.id} onPress={() => open(n)} style={[st.row, !n.read && st.unread]}>
              <Text style={st.title}>{n.title}</Text>
              <Text style={st.body}>{n.body}</Text>
              <Text style={st.time}>{new Date(n.created_at).toLocaleString()}</Text>
            </Pressable>
          ))}
      </BizCard>
    </BizShell>
  );
}

const st = StyleSheet.create({
  empty: { color: colors.textTertiary, fontSize: font.sm, lineHeight: 19 },
  row: { paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 8 },
  unread: { backgroundColor: colors.cobaltSoft },
  title: { color: colors.text, fontWeight: "800", fontSize: font.base },
  body: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2 },
  time: { color: colors.textTertiary, fontSize: 11, marginTop: 3 },
});

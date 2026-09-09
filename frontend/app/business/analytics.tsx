import React, { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import BizShell, { BizCard, BizStat } from "@/src/business/BizShell";
import { colors, spacing, font } from "@/src/theme";
import { getBusinessAnalytics } from "@/src/services/businessService";

export default function BizAnalytics() {
  const [a, setA] = useState<any | null>(null);
  useFocusEffect(useCallback(() => { getBusinessAnalytics().then(setA).catch(() => {}); }, []));
  return (
    <BizShell title="Analytics">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg }}>
        <BizStat label="Profile Views" value={a?.profile_views} icon="storefront-outline" />
        <BizStat label="Event Impressions" value={a?.event_impressions} icon="radio-outline" />
        <BizStat label="Event Detail Views" value={a?.event_views} icon="eye-outline" />
        <BizStat label="People Going" value={a?.people_going} icon="people-outline" />
        <BizStat label="Completed Events" value={a?.completed_events} icon="checkmark-done-outline" />
        <BizStat label="Review Count" value={a?.review_count} icon="chatbox-outline" />
        <BizStat label="Average Rating" value={a?.average_rating != null ? `${a.average_rating} ★` : "—"} icon="star-outline" />
        <BizStat label="Events Hosted" value={a?.events_hosted} icon="calendar-outline" />
      </View>
      {a?.strongest_category && (
        <BizCard><Text style={{ color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" }}>Strongest Event category</Text>
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: 4 }}>{a.strongest_category}</Text></BizCard>
      )}
      {a?.top_event && (
        <BizCard><Text style={{ color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" }}>Highest-performing Event</Text>
          <Text style={{ color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: 4 }}>{a.top_event.title}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: font.sm, marginTop: 2 }}>{a.top_event.views} views · {a.top_event.category}</Text></BizCard>
      )}
      <Text style={{ color: colors.textTertiary, fontSize: font.sm }}>Aggregate analytics only — private identities are never exposed.</Text>
    </BizShell>
  );
}

import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { getActiveMeetup, stopTemporaryLocationSharing, cancelMeetup } from "@/src/services/meetupService";
import { api } from "@/src/lib/api";
import { trackMeetupEnded } from "@/src/services/analyticsService";
import { DEMO_LOCATION } from "@/src/services/locationService";
import MeetupMap from "@/src/components/MeetupMap";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

type Meetup = {
  id: string;
  expires_at: string;
  user: { id: string; name: string; age: number; photo_url: string | null } | null;
  distance: number;
  bearing: number;
};

export default function MeetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { coords } = useApp();
  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState<number>(15 * 60);
  const [arrived, setArrived] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [endedMsg, setEndedMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const CANCEL_REASONS = [
    "I changed my mind",
    "Timing no longer works",
    "I feel uncomfortable",
    "They did not show",
    "Other",
  ];

  const doCancel = async (reason: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (meetup) cancelMeetup(meetup.id, reason).catch(() => {});
    trackMeetupEnded();
    if (reason === "I feel uncomfortable" && meetup?.user) {
      const other = meetup.user;
      setEndedMsg("Meetup ended. Location sharing stopped.");
      Alert.alert("You're in control", "What would you like to do?", [
        { text: "Just end meetup", onPress: () => router.replace("/feedback") },
        {
          text: "Hide from this person",
          onPress: async () => {
            await api("/hide", { method: "POST", body: { user_id: other.id } }).catch(() => {});
            router.replace("/feedback");
          },
        },
        {
          text: "Report user",
          style: "destructive",
          onPress: () => router.replace({ pathname: "/report", params: { userId: other.id, name: other.name } }),
        },
      ]);
      return;
    }
    setEndedMsg("Meetup ended. Location sharing stopped.");
    setTimeout(() => router.replace("/feedback"), 1800);
  };

  useEffect(() => {
    const c = coords || DEMO_LOCATION;
    getActiveMeetup(c)
      .then((res) => {
        setMeetup(res.meetup);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [coords]);

  const finish = useCallback(
    async (message: string) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setEndedMsg(message);
      if (meetup) stopTemporaryLocationSharing(meetup.id).catch(() => {});
      trackMeetupEnded();
      setTimeout(() => router.replace("/feedback"), 1800);
    },
    [meetup, router]
  );

  useEffect(() => {
    if (!meetup) return;
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(meetup.expires_at).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        finish("Meetup ended. Location sharing stopped.");
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meetup, finish]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  if (!meetup) {
    return (
      <View style={[styles.center, { paddingHorizontal: spacing.xl }]}>
        <Text style={styles.noneTitle}>No active meetup</Text>
        <SecondaryButton title="Back to Radar" onPress={() => router.replace("/(tabs)")} style={{ marginTop: spacing.lg, alignSelf: "stretch" }} />
      </View>
    );
  }

  const walkMins = Math.max(1, Math.round(meetup.distance / 80));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <Text style={styles.title}>Meetup in progress</Text>
      <View style={styles.timerRow} testID="meetup-timer">
        <Ionicons name="time" size={16} color={colors.orange} />
        <Text style={styles.timerText}>
          Location sharing ends in {mm}:{ss}
        </Text>
      </View>

      <MeetupMap
        meUri={user?.photo_url}
        meName={user?.name}
        otherUri={meetup.user?.photo_url}
        otherName={meetup.user?.name}
        bearing={meetup.bearing}
      />

      {endedMsg ? (
        <View style={[styles.bottomCard, shadow.card]} testID="meetup-ended-msg">
          <Text style={styles.arrivedText}>{endedMsg}</Text>
        </View>
      ) : cancelling ? (
        <View style={[styles.bottomCard, shadow.card]} testID="meetup-cancel-options">
          <Text style={styles.nearbyTitle}>Why are you cancelling?</Text>
          {CANCEL_REASONS.map((r) => (
            <Pressable key={r} testID={`cancel-reason-${r.replace(/[^a-zA-Z]+/g, "-")}`} style={styles.cancelRow} onPress={() => doCancel(r)}>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              <Text style={styles.cancelText}>{r}</Text>
            </Pressable>
          ))}
          <SecondaryButton title="Back" onPress={() => setCancelling(false)} style={{ marginTop: spacing.sm, borderWidth: 0, minHeight: 40 }} />
        </View>
      ) : arrived ? (
        <View style={[styles.bottomCard, shadow.card]} testID="meetup-arrived-msg">
          <Text style={styles.arrivedText}>{"You've arrived. Say hello 👋"}</Text>
          <PrimaryButton
            testID="meetup-end-after-arrive"
            title="End meetup"
            color={colors.teal}
            onPress={() => finish("Meetup ended. Location sharing stopped.")}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        <View style={[styles.bottomCard, shadow.card]}>
          <Text style={styles.nearbyTitle}>{"You're nearby"}</Text>
          <Text style={styles.nearbySub}>
            {`You're ${walkMins} min away · ${meetup.distance}m walking distance`}
          </Text>
          <View style={styles.btnRow}>
            <PrimaryButton
              testID="meetup-im-here"
              title="I'm here"
              color={colors.teal}
              onPress={() => setArrived(true)}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              testID="meetup-end"
              title="Cancel meetup"
              color={colors.pink}
              onPress={() => setCancelling(true)}
              style={{ flex: 1, borderColor: colors.pink + "55" }}
            />
          </View>
          <SecondaryButton
            testID="meetup-report-issue"
            title="Report issue"
            onPress={() =>
              router.push({
                pathname: "/report",
                params: { userId: meetup.user?.id || "", name: meetup.user?.name || "" },
              })
            }
            style={{ marginTop: spacing.sm, borderWidth: 0, minHeight: 40 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  noneTitle: { color: colors.text, fontSize: font.xl, fontWeight: "700" },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs, marginBottom: spacing.lg },
  timerText: { color: colors.orange, fontSize: font.base, fontWeight: "700" },
  bottomCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  nearbyTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  nearbySub: { color: colors.textSecondary, fontSize: font.base, marginTop: 4, marginBottom: spacing.lg },
  btnRow: { flexDirection: "row", gap: spacing.md },
  arrivedText: { color: colors.text, fontSize: font.xl, fontWeight: "700", textAlign: "center" },
  cancelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.text, fontSize: font.base, fontWeight: "600", flex: 1 },
});

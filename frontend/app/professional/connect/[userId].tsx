import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import StatusBadge from "@/src/components/StatusBadge";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

const MAX_MESSAGE = 300;

/** Structured connection-request screen — the only path into professional messaging. */
export default function ProfessionalConnectScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pro, setPro] = useState<any>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (userId) api(`/professional/profile/${userId}`).then(setPro).catch(() => {});
  }, [userId]);

  if (!pro) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
        <Header onBack={() => router.back()} title="Connect" />
      </View>
    );
  }

  // request categories from the professional's real specialisations + broad category
  const options: string[] = Array.from(
    new Set([
      ...(pro.specialties || []),
      ...(pro.verified_categories || []).map((c: string) => `${c} Advice`),
      "Other",
    ])
  ).slice(0, 8);

  const send = async () => {
    if (!category) {
      showAlert("Pick a category", "Choose what you need help with first.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<any>("/professional/connect", {
        method: "POST",
        body: { professional_user_id: userId, category, message: message.trim() },
      });
      if (res.status === "connected") {
        router.replace(`/professional/session/${res.session_id}`);
        return;
      }
      setSent(true);
    } catch (e: any) {
      showAlert("Couldn't send request", e.message || "Try again.");
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="request-sent-state">
        <Header onBack={() => router.back()} title="Request Sent" />
        <View style={styles.sentWrap}>
          <View style={styles.sentIcon}>
            <Ionicons name="paper-plane" size={30} color={colors.teal} />
          </View>
          <Text style={styles.sentTitle}>Request sent to {pro.name}</Text>
          <Text style={styles.sentText}>
            Your request will be sent to the professional. Messaging becomes available only after they accept.
          </Text>
          {!!pro.response_time && <Text style={styles.sentMeta}>{pro.response_time}</Text>}
          <PrimaryButton
            testID="request-sent-done"
            title="Done"
            color={colors.teal}
            onPress={() => router.back()}
            style={{ alignSelf: "stretch", marginTop: spacing.lg }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="pro-connect-screen">
        <Header onBack={() => router.back()} title={`Connect with ${pro.name}`} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.proRow}>
            <Avatar uri={pro.photo_url} name={pro.name} size={52} ringColor={colors.teal} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.proName}>{pro.name}</Text>
              <Text style={styles.proMeta}>{pro.profession}</Text>
              {pro.verified_by_intro && <StatusBadge icon="shield-checkmark" label="IntroYu Verified" />}
            </View>
          </View>

          <Text style={styles.question}>What do you need help with?</Text>
          <View style={styles.chipsWrap}>
            {options.map((o) => {
              const active = category === o;
              return (
                <Pressable
                  key={o}
                  testID={`connect-cat-${o.replace(/[^a-zA-Z0-9]+/g, "-")}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(o)}
                >
                  <Text style={[styles.chipText, active && { color: "#FFF" }]}>{o}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Add a short message (optional)</Text>
          <TextInput
            testID="connect-message"
            style={styles.input}
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, MAX_MESSAGE))}
            placeholder="Briefly describe what you need…"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
          <Text style={styles.counter}>
            {message.length}/{MAX_MESSAGE}
          </Text>

          {!!pro.response_time && (
            <View style={styles.responseRow}>
              <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.responseText}>{pro.response_time}</Text>
            </View>
          )}

          <PrimaryButton testID="connect-send" title="Send Request" color={colors.teal} loading={busy} onPress={send} />

          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={14} color={colors.teal} />
            <Text style={styles.privacyText}>
              Your request will be sent to the professional. Messaging becomes available only after they accept.
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable testID="connect-back" onPress={onBack} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: font.lg, fontWeight: "800" },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  proRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  proName: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  proMeta: { color: colors.textSecondary, fontSize: font.sm },
  question: { color: colors.text, fontSize: font.lg, fontWeight: "800", marginTop: spacing.sm },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  label: { color: colors.text, fontSize: font.base, fontWeight: "700", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    minHeight: 100,
    color: colors.text,
    fontSize: font.base,
    textAlignVertical: "top",
  },
  counter: { color: colors.textTertiary, fontSize: font.sm, textAlign: "right" },
  responseRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  responseText: { color: colors.textSecondary, fontSize: font.sm },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1, lineHeight: 18 },
  sentWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl, gap: spacing.sm },
  sentIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.tealSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  sentTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800", textAlign: "center" },
  sentText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", lineHeight: 21 },
  sentMeta: { color: colors.textTertiary, fontSize: font.sm },
});

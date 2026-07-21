import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import Avatar from "@/src/components/Avatar";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

/** Professional session conversation — unlocked only after request acceptance. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, m] = await Promise.all([api<any>(`/professional/sessions/${id}`), api<any>(`/professional/sessions/${id}/messages`)]);
      setSession(s);
      setMessages(m.messages || []);
    } catch {}
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 4000);
      return () => clearInterval(t);
    }, [load])
  );

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await api(`/professional/sessions/${id}/messages`, { method: "POST", body: { text: body } });
      setMessages((m) => [...m, msg]);
      setText("");
    } catch (e: any) {
      showAlert("Couldn't send", e.message || "Try again.");
    }
    setSending(false);
  };

  const setStatus = async (status: string) => {
    try {
      await api(`/professional/sessions/${id}`, { method: "PUT", body: { status } });
      await load();
      if (status === "completed" && session?.i_am === "requester") setShowReview(true);
    } catch (e: any) {
      showAlert("Couldn't update session", e.message || "Try again.");
    }
  };

  const openMenu = () => {
    const other = session?.other;
    const buttons: any[] = [];
    if (session?.status === "active") buttons.push({ text: "Mark follow-up needed", onPress: () => setStatus("follow_up") });
    if (session?.status === "follow_up") buttons.push({ text: "Mark active", onPress: () => setStatus("active") });
    if (session?.status === "active" || session?.status === "follow_up") {
      buttons.push({ text: "Complete session", onPress: () => setStatus("completed") });
      buttons.push({ text: "Cancel session", style: "destructive", onPress: () => setStatus("cancelled") });
    }
    buttons.push({
      text: "Report",
      style: "destructive",
      onPress: () => router.push({ pathname: "/report", params: { userId: other?.id, name: other?.name } } as any),
    });
    buttons.push({
      text: "Block",
      style: "destructive",
      onPress: async () => {
        try {
          await api("/blocks", { method: "POST", body: { user_id: other?.id } });
          showAlert("Blocked", "You will no longer see each other.");
          router.back();
        } catch (e: any) {
          showAlert("Couldn't block", e.message || "Try again.");
        }
      },
    });
    buttons.push({ text: "Close", style: "cancel" });
    showAlert("Session options", "", buttons);
  };

  const pro = session?.professional;
  const closed = session && session.status !== "active" && session.status !== "follow_up";
  const canReview = session?.status === "completed" && session?.i_am === "requester" && !session?.review;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]} testID="pro-session-screen">
        {/* header */}
        <View style={styles.header}>
          <Pressable testID="session-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Avatar uri={session?.other?.photo_url} name={session?.other?.name} size={38} ringColor={pro?.verified_by_intro ? colors.teal : undefined} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {session?.other?.name || "Session"}
              </Text>
              {pro?.verified_by_intro && session?.i_am === "requester" && (
                <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
              )}
            </View>
            <Text style={styles.headerMeta} numberOfLines={1}>
              {session?.i_am === "requester"
                ? [pro?.profession, pro?.rating != null ? `★ ${pro.rating}` : null, pro?.availability].filter(Boolean).join(" · ")
                : [session?.category, "Requester"].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Pressable testID="session-menu" onPress={openMenu} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </Pressable>
        </View>

        {/* status banner */}
        {session && (
          <View style={[styles.statusBanner, closed && { backgroundColor: colors.card }]}>
            <Text style={styles.statusBannerText}>
              {session.status === "active" && `Active session · ${session.category}`}
              {session.status === "follow_up" && `Follow-up needed · ${session.category}`}
              {session.status === "completed" && "Session completed"}
              {session.status === "cancelled" && "Session cancelled"}
            </Text>
          </View>
        )}

        {/* messages */}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.msgList} showsVerticalScrollIndicator={false}>
          {messages.map((m) => {
            const mine = session && m.from_user_id !== session.other?.id;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && { color: "#FFF" }]}>{m.text}</Text>
              </View>
            );
          })}
          {messages.length === 0 && session && !closed && (
            <Text style={styles.emptyHint}>Conversation unlocked. Say hello and describe what you need.</Text>
          )}

          {canReview && !showReview && (
            <Pressable testID="open-review" style={styles.reviewPrompt} onPress={() => setShowReview(true)}>
              <Ionicons name="star" size={15} color={colors.warning} />
              <Text style={styles.reviewPromptText}>Rate this session</Text>
            </Pressable>
          )}
          {session?.review && (
            <View style={styles.reviewDone}>
              <Text style={styles.reviewDoneText}>
                You rated this session {session.review.rating}/5{session.review.recommend ? " · Recommended" : ""}
              </Text>
            </View>
          )}
          {(canReview && showReview) && <ReviewForm sessionId={String(id)} onDone={() => { setShowReview(false); load(); }} />}
        </ScrollView>

        {/* composer */}
        {!closed ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TextInput
              testID="session-input"
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Write a message…"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <Pressable testID="session-send" style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]} onPress={send}>
              <Ionicons name="send" size={16} color="#FFF" />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.closedBar, { paddingBottom: insets.bottom + spacing.sm }]}>
            <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
            <Text style={styles.closedText}>Messaging is closed for this session.</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ReviewForm({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!rating) {
      showAlert("Add a rating", "Tap the stars to rate this session.");
      return;
    }
    setBusy(true);
    try {
      await api(`/professional/sessions/${sessionId}/review`, {
        method: "POST",
        body: { rating, review: review.trim(), recommend },
      });
      onDone();
    } catch (e: any) {
      showAlert("Couldn't submit review", e.message || "Try again.");
    }
    setBusy(false);
  };

  return (
    <View style={styles.reviewCard} testID="review-form">
      <Text style={styles.reviewTitle}>How was your session?</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} testID={`review-star-${n}`} onPress={() => setRating(n)} hitSlop={6}>
            <Ionicons name={n <= rating ? "star" : "star-outline"} size={28} color={colors.warning} />
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="review-text"
        style={styles.reviewInput}
        value={review}
        onChangeText={(t) => setReview(t.slice(0, 600))}
        placeholder="Share a short review (optional)"
        placeholderTextColor={colors.textTertiary}
        multiline
      />
      <Text style={styles.recommendLabel}>Would you recommend this professional?</Text>
      <View style={styles.recommendRow}>
        <Pressable
          testID="review-recommend-yes"
          style={[styles.recBtn, recommend === true && { backgroundColor: colors.tealSoft, borderColor: colors.teal }]}
          onPress={() => setRecommend(true)}
        >
          <Text style={[styles.recBtnText, recommend === true && { color: colors.teal }]}>Yes</Text>
        </Pressable>
        <Pressable
          testID="review-recommend-no"
          style={[styles.recBtn, recommend === false && { backgroundColor: colors.card, borderColor: colors.textSecondary }]}
          onPress={() => setRecommend(false)}
        >
          <Text style={styles.recBtnText}>No</Text>
        </Pressable>
      </View>
      <PrimaryButton testID="review-submit" title="Submit Review" color={colors.teal} loading={busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  headerMeta: { color: colors.textSecondary, fontSize: font.sm },
  statusBanner: {
    backgroundColor: colors.tealSoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.xl,
  },
  statusBannerText: { color: colors.text, fontSize: font.sm, fontWeight: "700", textAlign: "center" },
  msgList: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.teal, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: font.base, lineHeight: 20 },
  emptyHint: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.xl },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    maxHeight: 110,
    color: colors.text,
    fontSize: font.base,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  closedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closedText: { color: colors.textTertiary, fontSize: font.sm },
  reviewPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFF8EB",
    borderRadius: radius.md,
    minHeight: 44,
    marginTop: spacing.md,
  },
  reviewPromptText: { color: colors.warning, fontSize: font.base, fontWeight: "800" },
  reviewDone: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  reviewDoneText: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", fontWeight: "600" },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  reviewTitle: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  starsRow: { flexDirection: "row", gap: spacing.sm },
  reviewInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 70,
    color: colors.text,
    fontSize: font.base,
    textAlignVertical: "top",
  },
  recommendLabel: { color: colors.text, fontSize: font.base, fontWeight: "700" },
  recommendRow: { flexDirection: "row", gap: spacing.sm },
  recBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recBtnText: { color: colors.text, fontSize: font.base, fontWeight: "700" },
});

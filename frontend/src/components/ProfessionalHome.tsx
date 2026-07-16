import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { acceptPing, declinePing } from "@/src/services/pingService";
import { timeAgo, distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import RadarView from "@/src/components/RadarView";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

const AMBER = "#F59E0B";

export default function ProfessionalHome() {
  const { user, setUser } = useAuth();
  const { coords, vibeMap, requestLocation } = useApp();
  const [role, setRole] = useState<string | null>(user?.professional_role || null);

  useEffect(() => {
    if (!coords) requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickRole = async (r: "need_help" | "can_help") => {
    setRole(r);
    api("/users/me/mode", { method: "PUT", body: { professional_role: r } }).catch(() => {});
    if (user) setUser({ ...user, professional_role: r } as any);
  };

  if (!role) {
    return (
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} testID="professional-landing">
        <Text style={styles.h1}>Professional</Text>
        <Text style={styles.sub}>Find trusted help nearby or offer your expertise.</Text>
        <Pressable testID="role-need-help" style={[styles.roleCard, shadow.card]} onPress={() => pickRole("need_help")}>
          <View style={[styles.roleIcon, { backgroundColor: colors.orangeSoft || colors.card }]}>
            <Ionicons name="help-buoy" size={26} color={colors.orange} />
          </View>
          <Text style={styles.roleTitle}>I Need Help</Text>
          <Text style={styles.roleText}>Post a request and connect with someone qualified nearby.</Text>
        </Pressable>
        <Pressable testID="role-can-help" style={[styles.roleCard, shadow.card]} onPress={() => pickRole("can_help")}>
          <View style={[styles.roleIcon, { backgroundColor: colors.tealSoft }]}>
            <Ionicons name="briefcase" size={26} color={colors.teal} />
          </View>
          <Text style={styles.roleTitle}>I Can Help</Text>
          <Text style={styles.roleText}>Create a professional profile and respond to nearby requests.</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return role === "need_help" ? (
    <NeedHelpHome onSwitch={() => pickRole("can_help")} />
  ) : (
    <CanHelpHome onSwitch={() => pickRole("need_help")} coords={coords} vibeMap={vibeMap} me={user} />
  );
}

function RoleHeader({ title, switchLabel, onSwitch }: { title: string; switchLabel: string; onSwitch: () => void }) {
  return (
    <View style={styles.roleHeader}>
      <Text style={styles.h2}>{title}</Text>
      <Pressable testID="switch-role" onPress={onSwitch} hitSlop={8}>
        <Text style={styles.switchText}>{switchLabel}</Text>
      </Pressable>
    </View>
  );
}

function NeedHelpHome({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [pros, setPros] = useState<any[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { coords } = useApp();
  const active = requests.find((r) => r.status === "active" || r.status === "paused");

  const load = useCallback(async () => {
    try {
      const mine = await api<any[]>("/help-requests/mine");
      setRequests(mine);
      const act = mine.find((r: any) => r.status === "active" || r.status === "paused");
      if (act) setOffers(await api<any[]>(`/help-requests/${act.id}/offers`));
      else setOffers([]);
      if (coords) {
        const p = await api<any>(`/professionals?lat=${coords.lat}&lng=${coords.lng}${verifiedOnly ? "&verified_only=true" : ""}`);
        setPros(p.professionals);
      }
    } catch {}
  }, [coords, verifiedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string) => {
    if (!active) return;
    if (action === "delete") {
      showAlert("Delete this request?", "Professionals will no longer see it.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await api(`/help-requests/${active.id}`, { method: "DELETE" }); load(); } },
      ]);
      return;
    }
    await api(`/help-requests/${active.id}`, { method: "PUT", body: { status: action } });
    load();
  };

  const respond = async (offer: any, accept: boolean) => {
    try {
      if (accept) {
        await acceptPing(offer.id);
        showAlert("You're connected 🎉", `${offer.professional.name} can now see your private details and discuss.`);
      } else {
        await declinePing(offer.id);
      }
      load();
    } catch (e: any) {
      showAlert("Something went wrong", e.message || "Please try again.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      testID="need-help-home"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.teal} />}
    >
      <RoleHeader title="I Need Help" switchLabel="Switch to I Can Help" onSwitch={onSwitch} />
      {active ? (
        <View style={[styles.card, shadow.card]} testID="my-request-card">
          <View style={styles.rowBetween}>
            <Text style={styles.cardBadge}>{active.category}</Text>
            <Text style={[styles.statusChip, { color: active.status === "active" ? colors.success : colors.textTertiary }]}>
              {active.status === "active" ? `Active · expires ${timeAgo(active.expires_at).replace(" ago", "")}` : "Paused"}
            </Text>
          </View>
          <Text style={styles.cardTitle}>{active.public_summary}</Text>
          <Text style={styles.cardMeta}>{active.payment} · {active.expiry}</Text>
          <View style={styles.actionsRow}>
            <Pressable testID="req-edit" style={styles.smallBtn} onPress={() => router.push("/professional/need-help")}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </Pressable>
            <Pressable testID="req-pause" style={styles.smallBtn} onPress={() => act(active.status === "active" ? "paused" : "active")}>
              <Text style={styles.smallBtnText}>{active.status === "active" ? "Pause" : "Reactivate"}</Text>
            </Pressable>
            <Pressable testID="req-delete" style={styles.smallBtn} onPress={() => act("delete")}>
              <Text style={[styles.smallBtnText, { color: colors.pink }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable testID="create-request" style={[styles.card, shadow.card, { alignItems: "center" }]} onPress={() => router.push("/professional/need-help")}>
          <Ionicons name="add-circle" size={30} color={colors.orange} />
          <Text style={styles.cardTitle}>Post a help request</Text>
          <Text style={styles.cardMeta}>Describe what you need — nearby professionals can offer to help.</Text>
        </Pressable>
      )}

      {offers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>OFFERS TO HELP</Text>
          {offers.map((o) => (
            <View key={o.id} style={[styles.card, shadow.card]} testID={`offer-${o.id}`}>
              <View style={styles.proRow}>
                <Avatar uri={o.professional.photo_url} name={o.professional.name} size={46} ringColor={colors.teal} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text style={styles.proName}>{o.professional.name} would like to help</Text>
                  </View>
                  {o.professional.verified_by_intro && (
                    <View style={styles.badge}><Ionicons name="shield-checkmark" size={11} color={colors.teal} /><Text style={styles.badgeText}>Verified by INTRO</Text></View>
                  )}
                  <Text style={styles.cardMeta}>
                    {o.professional.profession} · {o.professional.years_experience} yrs{o.professional.distance != null ? ` · ${distLabel(o.professional.distance)}` : ""}
                  </Text>
                </View>
              </View>
              {o.status === "new" ? (
                <View style={styles.actionsRow}>
                  <Pressable testID={`offer-accept-${o.id}`} style={[styles.smallBtn, { backgroundColor: colors.teal }]} onPress={() => respond(o, true)}>
                    <Text style={[styles.smallBtnText, { color: "#FFF" }]}>Accept</Text>
                  </Pressable>
                  <Pressable testID={`offer-decline-${o.id}`} style={styles.smallBtn} onPress={() => respond(o, false)}>
                    <Text style={styles.smallBtnText}>Decline</Text>
                  </Pressable>
                  <Pressable testID={`offer-view-${o.id}`} style={styles.smallBtn} onPress={() => router.push(`/professional/profile/${o.professional.user_id}`)}>
                    <Text style={styles.smallBtnText}>View Profile</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={[styles.statusChip, { marginTop: spacing.sm, color: o.status === "accepted" ? colors.success : colors.textTertiary }]}>
                  {o.status === "accepted" ? "Connected 🎉" : "Declined"}
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>PROFESSIONALS NEARBY</Text>
        <Pressable testID="verified-only-toggle" onPress={() => setVerifiedOnly(!verifiedOnly)} style={styles.filterChip}>
          <Ionicons name={verifiedOnly ? "checkbox" : "square-outline"} size={13} color={colors.teal} />
          <Text style={styles.filterChipText}>Verified only</Text>
        </Pressable>
      </View>
      {pros.map((p) => (
        <Pressable key={p.user_id} testID={`pro-row-${p.user_id}`} style={[styles.card, shadow.card]} onPress={() => router.push(`/professional/profile/${p.user_id}`)}>
          <View style={styles.proRow}>
            <Avatar uri={p.photo_url} name={p.name} size={46} ringColor={p.verified_by_intro ? colors.teal : colors.border} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.proName}>{p.name}</Text>
              {p.verified_by_intro && (
                <View style={styles.badge}><Ionicons name="shield-checkmark" size={11} color={colors.teal} /><Text style={styles.badgeText}>Verified by INTRO</Text></View>
              )}
              <Text style={styles.cardMeta}>{p.profession} · {p.primary_category}{p.distance != null ? ` · ${distLabel(p.distance)}` : ""}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
        </Pressable>
      ))}
      <View style={styles.privacyNote}>
        <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
        <Text style={styles.privacyText}>Approximate locations only. Exact locations are never shared.</Text>
      </View>
    </ScrollView>
  );
}

function CanHelpHome({ onSwitch, coords, vibeMap, me }: any) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>({ status: "Not Submitted" });
  const [requests, setRequests] = useState<any[]>([]);
  const [payment, setPayment] = useState<string | null>(null);
  const [freshOnly, setFreshOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const mine = await api<any>("/professional/profile/me");
      setProfile(mine.profile);
      setVerification(mine.verification);
      if (coords && mine.profile) {
        let q = `/professional/requests?lat=${coords.lat}&lng=${coords.lng}`;
        if (payment) q += `&payment=${encodeURIComponent(payment)}`;
        if (freshOnly) q += "&max_age_hours=4";
        const res = await api<any>(q);
        setRequests(res.requests);
      }
    } catch {}
  }, [coords, payment, freshOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const reqUsers = requests.map((r) => ({
    id: `req:${r.id}`,
    name: r.category,
    age: 0,
    photo_url: null,
    vibe: "opportunity",
    intent: r.public_summary,
    distance: r.distance,
    bearing: r.bearing,
    compatible: true,
    active_now: true,
    verified: false,
    score: 6,
    vibe_details: { opportunity_type: "Need help", category: r.category },
  }));

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      testID="can-help-home"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.teal} />}
    >
      <RoleHeader title="I Can Help" switchLabel="Switch to I Need Help" onSwitch={onSwitch} />
      {profile ? (
        <View style={[styles.card, shadow.card]} testID="pro-profile-card">
          <View style={styles.proRow}>
            <Avatar uri={me?.photo_url} name={me?.name} size={46} ringColor={verification.status === "Approved" ? colors.teal : colors.border} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.proName}>{profile.profession}</Text>
              <Text style={styles.cardMeta}>{profile.primary_category}{profile.additional_categories?.length ? ` +${profile.additional_categories.length}` : ""}</Text>
              {verification.status === "Approved" ? (
                <View style={styles.badge}><Ionicons name="shield-checkmark" size={11} color={colors.teal} /><Text style={styles.badgeText}>Verified by INTRO</Text></View>
              ) : (
                <Text style={[styles.statusChip, { color: verification.status === "Pending Review" ? colors.orange : colors.textTertiary }]}>
                  Verification: {verification.status}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Pressable testID="edit-pro-profile" style={styles.smallBtn} onPress={() => router.push("/professional/can-help")}>
              <Text style={styles.smallBtnText}>Edit Profile</Text>
            </Pressable>
            <Pressable testID="go-verification" style={[styles.smallBtn, verification.status !== "Approved" && { backgroundColor: colors.teal }]} onPress={() => router.push("/professional/verification")}>
              <Text style={[styles.smallBtnText, verification.status !== "Approved" && { color: "#FFF" }]}>
                {verification.status === "Approved" ? "Verification" : "Get Verified"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable testID="create-pro-profile" style={[styles.card, shadow.card, { alignItems: "center" }]} onPress={() => router.push("/professional/can-help")}>
          <Ionicons name="briefcase" size={30} color={colors.teal} />
          <Text style={styles.cardTitle}>Create your professional profile</Text>
          <Text style={styles.cardMeta}>Set your profession and categories to see matching requests nearby.</Text>
        </Pressable>
      )}

      {profile && (
        <>
          <Text style={styles.sectionTitle}>MATCHING REQUESTS NEARBY</Text>
          <View style={styles.filtersRow}>
            {["Open to paying", "Free advice"].map((p) => (
              <Pressable key={p} testID={`filter-pay-${p.replace(/\s+/g, "-")}`} style={[styles.filterChip, payment === p && styles.filterChipOn]} onPress={() => setPayment(payment === p ? null : p)}>
                <Text style={[styles.filterChipText, payment === p && { color: "#FFF" }]}>{p}</Text>
              </Pressable>
            ))}
            <Pressable testID="filter-fresh" style={[styles.filterChip, freshOnly && styles.filterChipOn]} onPress={() => setFreshOnly(!freshOnly)}>
              <Text style={[styles.filterChipText, freshOnly && { color: "#FFF" }]}>Last 4h</Text>
            </Pressable>
          </View>
          {reqUsers.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <RadarView
                users={reqUsers as any}
                vibeMap={vibeMap}
                onSelect={(u: any) => router.push(`/professional/request/${u.id.slice(4)}`)}
                meUri={me?.photo_url}
                meName={me?.name}
                radiusSetting={me?.radius || 50}
                coords={coords}
              />
            </View>
          )}
          {requests.length === 0 && (
            <View style={[styles.card, { alignItems: "center" }]}>
              <Text style={styles.cardMeta}>No matching requests in your categories right now. Pull to refresh.</Text>
            </View>
          )}
          {requests.map((r) => (
            <Pressable key={r.id} testID={`request-row-${r.id}`} style={[styles.card, shadow.card]} onPress={() => router.push(`/professional/request/${r.id}`)}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardBadge, { color: AMBER }]}>{r.category}</Text>
                <Text style={styles.cardMeta}>{distLabel(r.distance)}</Text>
              </View>
              <Text style={styles.cardTitle}>{r.public_summary}</Text>
              <Text style={styles.cardMeta}>{r.payment} · posted {timeAgo(r.created_at)}</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 120, gap: spacing.md },
  h1: { color: colors.text, fontSize: font.xxl, fontWeight: "800", marginTop: spacing.md },
  h2: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginBottom: spacing.md },
  roleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  roleIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  roleTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  roleText: { color: colors.textSecondary, fontSize: font.base, lineHeight: 20 },
  roleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  switchText: { color: colors.teal, fontSize: font.sm, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  cardBadge: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  cardTitle: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  cardMeta: { color: colors.textSecondary, fontSize: font.sm },
  statusChip: { fontSize: font.sm, fontWeight: "700" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  smallBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 34,
    justifyContent: "center",
  },
  smallBtnText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  sectionTitle: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "800", letterSpacing: 1, marginTop: spacing.md },
  proRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proName: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.tealSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.teal, fontSize: 10, fontWeight: "800" },
  filtersRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.sm },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  filterChipOn: { backgroundColor: colors.teal },
  filterChipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1 },
});

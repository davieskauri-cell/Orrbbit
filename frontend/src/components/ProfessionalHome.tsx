import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal, Animated as RNAnimated, PanResponder, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/lib/api";
import { showAlert } from "@/src/lib/alert";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { acceptPing, declinePing } from "@/src/services/pingService";
import { requestConnection } from "@/src/services/matchingService";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { timeAgo, distLabel } from "@/src/lib/format";
import Avatar from "@/src/components/Avatar";
import RadarView from "@/src/components/RadarView";
import StatusBadge from "@/src/components/StatusBadge";
import SectionHeader from "@/src/components/SectionHeader";
import PillChip from "@/src/components/PillChip";
import HorizontalCategoryChipList from "@/src/components/HorizontalCategoryChipList";
import SegmentedControl from "@/src/components/SegmentedControl";
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

  return (
    <View style={{ flex: 1 }}>
      <SegmentedControl
        testID="pro-role-switch"
        options={[
          { value: "need_help", label: "I Need Help", testID: "role-seg-need", accessibilityLabel: "I need help" },
          { value: "can_help", label: "I Can Help", testID: "role-seg-can", accessibilityLabel: "I can help" },
        ]}
        value={role}
        onChange={(v) => pickRole(v)}
        style={{ marginTop: 0, marginBottom: spacing.xs }}
      />
      {role === "need_help" ? (
        <NeedHelpHome vibeMap={vibeMap} coords={coords} me={user} />
      ) : (
        <CanHelpHome coords={coords} vibeMap={vibeMap} me={user} />
      )}
    </View>
  );
}

function NeedHelpHome({ vibeMap, coords, me }: any) {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [pros, setPros] = useState<any[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [availableNow, setAvailableNow] = useState(false);
  const [search, setSearch] = useState("");
  const [maxDist, setMaxDist] = useState<number | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const active = requests.find((r) => r.status === "active" || r.status === "paused");

  useEffect(() => {
    api<any>("/config").then((c) => setCategories(c.pro_categories || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const mine = await api<any[]>("/help-requests/mine");
      setRequests(mine);
      const act = mine.find((r: any) => r.status === "active" || r.status === "paused");
      if (act) setOffers(await api<any[]>(`/help-requests/${act.id}/offers`));
      else setOffers([]);
      if (coords) {
        let q = `/professionals?lat=${coords.lat}&lng=${coords.lng}`;
        if (category) q += `&category=${encodeURIComponent(category)}`;
        if (availableNow) q += "&available_now=true";
        const p = await api<any>(q);
        setPros(p.professionals);
      }
    } catch {}
  }, [coords, category, availableNow]);

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
        showAlert("You're connected", `${offer.professional.name} can now see your private details and discuss.`);
      } else {
        await declinePing(offer.id);
      }
      load();
    } catch (e: any) {
      showAlert("Something went wrong", e.message || "Please try again.");
    }
  };

  const q = search.trim().toLowerCase();
  const shown = pros.filter(
    (p: any) =>
      (!maxDist || (p.distance ?? 0) <= maxDist) &&
      (!q ||
        [p.name, p.profession, p.primary_category, ...(p.specialties || []), ...(p.verified_categories || [])]
          .join(" ")
          .toLowerCase()
          .includes(q))
  );
  const newOffers = offers.filter((o) => o.status === "new").length;

  return (
    <View style={{ flex: 1 }} testID="need-help-home">
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          testID="pro-search"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search professionals or services"
          placeholderTextColor={colors.textTertiary}
        />
      </View>
      <HorizontalCategoryChipList
        testID="ch-filter-row"
        items={[{ key: "__available" }, { key: "__d250" }, { key: "__d500" }, ...categories.map((c: string) => ({ key: c }))]}
        renderChip={(item) => {
          if (item.key === "__available")
            return <PillChip testID="filter-available-now" label="Available now" active={availableNow} onPress={() => setAvailableNow(!availableNow)} />;
          if (item.key === "__d250" || item.key === "__d500") {
            const d = item.key === "__d250" ? 250 : 500;
            return <PillChip testID={`filter-dist-${d}`} label={`≤ ${d}m`} active={maxDist === d} onPress={() => setMaxDist(maxDist === d ? null : d)} />;
          }
          const c = item.key;
          return <PillChip testID={`nh-cat-filter-${c.replace(/[^a-zA-Z0-9]+/g, "-")}`} label={c} active={category === c} onPress={() => setCategory(category === c ? null : c)} />;
        }}
      />

      <View style={{ flex: 1, justifyContent: "flex-start" }}>
        <RadarView
          users={shown.map((p: any) => ({
            id: `pro:${p.user_id}`,
            name: p.name,
            age: 0,
            photo_url: p.photo_url,
            vibe: "opportunity",
            pro: true,
            intent: p.about,
            distance: p.distance,
            bearing: p.bearing ?? ((p.user_id?.charCodeAt(0) || 7) * 37) % 360,
            compatible: true,
            active_now: p.availability === "Available now",
            verified: true,
            score: 6,
            vibe_details: { opportunity_type: "Professional", category: p.primary_category },
          })) as any}
          vibeMap={vibeMap}
          onSelect={(u: any) => setPreview(shown.find((x: any) => `pro:${x.user_id}` === u.id) || null)}
          meUri={me?.photo_url}
          meName={me?.name}
          radiusSetting={me?.radius || 50}
          coords={coords}
        />
        <Pressable testID="fab-post-request" style={styles.fab} onPress={() => router.push("/professional/need-help")}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.fabText}>{active ? "My Request" : "Post Request"}</Text>
        </Pressable>
      </View>

      <MapSheet
        testID="pro-sheet"
        collapsedLabel={`${shown.length} professional${shown.length === 1 ? "" : "s"} nearby${newOffers ? ` · ${newOffers} new offer${newOffers === 1 ? "" : "s"}` : ""}`}
        onRefresh={load}
        refreshing={refreshing}
        setRefreshing={setRefreshing}
      >
        {active && (
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
        )}

        {offers.length > 0 && (
          <>
            <SectionHeader title="Offers to help" />
            {offers.map((o) => (
              <View key={o.id} style={[styles.card, shadow.card]} testID={`offer-${o.id}`}>
                <View style={styles.proRow}>
                  <Avatar uri={o.professional.photo_url} name={o.professional.name} size={46} ringColor={colors.teal} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.proName}>{o.professional.name} would like to help</Text>
                    {o.professional.verified_by_intro && <StatusBadge icon="shield-checkmark" label="Verified by INTRO" />}
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
                    {o.status === "accepted" ? "Connected" : "Declined"}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        <SectionHeader title="Verified professionals nearby" />
        {shown.length === 0 && (
          <View style={[styles.card, { alignItems: "center" }]} testID="no-pros-empty">
            <Text style={styles.cardTitle}>No verified professionals found nearby</Text>
            <Text style={[styles.cardMeta, { textAlign: "center" }]}>Try increasing your distance or selecting another category.</Text>
          </View>
        )}
        {shown.map((p: any) => (
          <Pressable key={p.user_id} testID={`pro-row-${p.user_id}`} style={[styles.card, shadow.card]} onPress={() => setPreview(p)}>
            <View style={styles.proRow}>
              <Avatar uri={p.photo_url} name={p.name} size={46} ringColor={colors.teal} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.proName}>{p.name}</Text>
                {p.verified_by_intro && <StatusBadge icon="shield-checkmark" label="INTRO Verified" />}
                <Text style={styles.cardMeta}>{p.profession} · {p.primary_category}{p.distance != null ? ` · ${distLabel(p.distance)}` : ""}</Text>
                {!!p.specialties?.length && <Text style={styles.verCats} numberOfLines={1}>✓ {p.specialties.join(" · ")}</Text>}
                <Text style={styles.cardMeta}>
                  {[p.availability, p.response_time, p.years_experience ? `${p.years_experience} yrs experience` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </View>
          </Pressable>
        ))}
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
          <Text style={styles.privacyText}>Approximate locations only. Exact locations are never shared.</Text>
        </View>
      </MapSheet>

      {preview && <ProPreview p={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function CanHelpHome({ coords, vibeMap, me }: any) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>({ status: "Not Submitted" });
  const [requests, setRequests] = useState<any[]>([]);
  const [payment, setPayment] = useState<string | null>(null);
  const [freshOnly, setFreshOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verRequired, setVerRequired] = useState(false);

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
        setVerRequired(!!res.verification_required);
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

  const mapMode = !!profile && !verRequired;
  const Wrapper: any = mapMode ? View : ScrollView;
  const wrapperProps: any = mapMode
    ? { style: { flex: 1 } }
    : {
        contentContainerStyle: styles.body,
        showsVerticalScrollIndicator: false,
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.teal} />,
      };
  return (
    <Wrapper testID="can-help-home" {...wrapperProps}>
      {profile && mapMode ? (
        <View style={styles.compactProfileRow} testID="pro-profile-card">
          <Avatar uri={me?.photo_url} name={me?.name} size={34} ringColor={colors.teal} />
          <View style={{ flex: 1 }}>
            <Text style={styles.proName} numberOfLines={1}>{profile.profession}</Text>
            <StatusBadge icon="shield-checkmark" label="Verified by INTRO" />
          </View>
          <Pressable testID="edit-pro-profile" style={styles.smallBtn} onPress={() => router.push("/professional/can-help")}>
            <Text style={styles.smallBtnText}>Edit</Text>
          </Pressable>
          <Pressable testID="go-verification" style={styles.smallBtn} onPress={() => router.push("/professional/verification")}>
            <Text style={styles.smallBtnText}>Verification</Text>
          </Pressable>
        </View>
      ) : profile ? (
        <View style={[styles.card, shadow.card]} testID="pro-profile-card">
          <View style={styles.proRow}>
            <Avatar uri={me?.photo_url} name={me?.name} size={46} ringColor={verification.status === "Approved" ? colors.teal : colors.border} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.proName}>{profile.profession}</Text>
              <Text style={styles.cardMeta}>{profile.primary_category}{profile.additional_categories?.length ? ` +${profile.additional_categories.length}` : ""}</Text>
              {verification.status === "Approved" ? (
                <StatusBadge icon="shield-checkmark" label="Verified by INTRO" />
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

      {profile && verRequired && (
        <Pressable testID="verification-required-card" style={[styles.card, shadow.card, { alignItems: "center" }]} onPress={() => router.push("/professional/verification")}>
          <Ionicons name="shield-half" size={28} color={colors.orange} />
          <Text style={styles.cardTitle}>Verification required</Text>
          <Text style={[styles.cardMeta, { textAlign: "center" }]}>
            You need to be Professionally Verified before you can see and respond to requests. Existing conversations stay active.
          </Text>
          <Text style={{ color: colors.teal, fontWeight: "800", fontSize: font.sm }}>Start verification →</Text>
        </Pressable>
      )}

      {profile && !verRequired && (
        <>
          <HorizontalCategoryChipList
            testID="nh-filter-row"
            items={[{ key: "Open to paying" }, { key: "Free advice" }, { key: "__fresh" }]}
            renderChip={(item) => {
              if (item.key === "__fresh")
                return <PillChip testID="filter-fresh" label="Last 4h" active={freshOnly} onPress={() => setFreshOnly(!freshOnly)} />;
              const p = item.key;
              return <PillChip testID={`filter-pay-${p.replace(/\s+/g, "-")}`} label={p} active={payment === p} onPress={() => setPayment(payment === p ? null : p)} />;
            }}
          />
          <View style={{ flex: 1 }}>
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
          <MapSheet
            testID="req-sheet"
            collapsedLabel={`${requests.length} matching request${requests.length === 1 ? "" : "s"} nearby`}
            onRefresh={load}
            refreshing={refreshing}
            setRefreshing={setRefreshing}
          >
            {requests.length === 0 && (
              <View style={[styles.card, { alignItems: "center" }]} testID="no-requests-empty">
                <Text style={styles.cardTitle}>No matching help requests nearby</Text>
                <Text style={[styles.cardMeta, { textAlign: "center" }]}>New requests will appear here when they match your verified categories.</Text>
              </View>
            )}
            {requests.map((r) => (
              <Pressable key={r.id} testID={`request-row-${r.id}`} style={[styles.card, shadow.card]} onPress={() => router.push(`/professional/request/${r.id}`)}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardBadge, { color: AMBER }]}>{r.category}</Text>
                  <Text style={styles.cardMeta}>{distLabel(r.distance)}</Text>
                </View>
                <Text style={styles.cardTitle}>{r.public_summary}</Text>
                <Text style={styles.cardMeta}>{r.payment} · posted {timeAgo(r.created_at)} · expires {timeAgo(r.expires_at).replace(" ago", "")}</Text>
              </Pressable>
            ))}
          </MapSheet>
        </>
      )}
    </Wrapper>
  );
}

function MapSheet({ collapsedLabel, children, testID, onRefresh, refreshing, setRefreshing }: any) {
  const [expanded, setExpanded] = useState(false);
  const H = Math.round(Dimensions.get("window").height * 0.52);
  const anim = useRef(new RNAnimated.Value(56)).current;
  const toggle = (open: boolean) => {
    setExpanded(open);
    RNAnimated.spring(anim, { toValue: open ? H : 56, useNativeDriver: false, friction: 10 }).start();
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) toggle(true);
        else if (g.dy > 24) toggle(false);
      },
    })
  ).current;
  return (
    <RNAnimated.View style={[styles.sheet, { height: anim }]} testID={testID}>
      <Pressable style={styles.sheetHeader} onPress={() => toggle(!expanded)} testID={`${testID}-header`} {...pan.panHandlers}>
        <View style={styles.sheetHandle} />
        <View style={styles.rowBetween}>
          <Text style={styles.sheetLabel}>{collapsedLabel}</Text>
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={16} color={colors.textSecondary} />
        </View>
      </Pressable>
      {expanded && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }}
                tintColor={colors.teal}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      )}
    </RNAnimated.View>
  );
}

function ProPreview({ p, onClose }: { p: any; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const requestHelp = async () => {
    setBusy(true);
    try {
      const res = await requestConnection(p.user_id);
      if (res.status === "connected") showAlert("You're already connected", `Head to Pings to continue with ${p.name}.`);
      else setSent(true);
    } catch (e: any) {
      showAlert("Couldn't send request", e.message || "Try again.");
    }
    setBusy(false);
  };
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.previewOverlay} onPress={onClose}>
        <Pressable style={styles.previewSheet} onPress={() => {}} testID="pro-preview-sheet">
          <View style={styles.sheetHandle} />
          <View style={styles.proRow}>
            <Avatar uri={p.photo_url} name={p.name} size={54} ringColor={colors.teal} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.previewName}>{p.name}</Text>
              <Text style={styles.cardMeta}>{p.profession}</Text>
              {p.verified_by_intro && <StatusBadge icon="shield-checkmark" label="INTRO Verified" />}
            </View>
          </View>
          {!!p.verified_categories?.length && (
            <Text style={styles.verCats}>✓ {p.verified_categories.join(" · ")}</Text>
          )}
          <Text style={styles.cardMeta}>
            {[p.distance != null ? distLabel(p.distance) : null, p.availability, p.response_time, p.years_experience ? `${p.years_experience} yrs experience` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {!!p.about && <Text style={styles.cardMeta} numberOfLines={3}>{p.about}</Text>}
          <Text style={styles.previewLock}>Private details stay locked until you both accept.</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <SecondaryButton testID="preview-view-profile" title="View Profile" onPress={() => { onClose(); router.push(`/professional/profile/${p.user_id}`); }} style={{ flex: 1, minHeight: 48 }} />
            <PrimaryButton testID="preview-request-help" title={sent ? "Request Sent ✓" : "Request Help"} onPress={requestHelp} loading={busy} disabled={sent} style={{ flex: 1, minHeight: 48 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: spacing.lg, minHeight: 44, marginBottom: spacing.sm },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 8 },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.lg + 56, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: spacing.lg, minHeight: 48, shadowColor: "#FF5A1F", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fabText: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.border, shadowColor: "#0F172A", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 8, overflow: "hidden" },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: spacing.sm, gap: 6 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" },
  sheetLabel: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  compactProfileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  previewOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  previewSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxl },
  previewName: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  previewLock: { color: colors.textTertiary, fontSize: font.sm, marginTop: 2 },

  body: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.md },
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
    gap: spacing.sm,
  },
  cardBadge: { color: colors.teal, fontSize: font.sm, fontWeight: "800" },
  verCats: { color: colors.success, fontSize: 11, fontWeight: "600" },
  cardTitle: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  cardMeta: { color: colors.textSecondary, fontSize: font.sm },
  statusChip: { fontSize: font.sm, fontWeight: "700" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  smallBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: "center",
  },
  smallBtnText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  proRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proName: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  filtersRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.sm },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.tealSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  privacyText: { color: colors.text, fontSize: font.sm, flex: 1 },
});

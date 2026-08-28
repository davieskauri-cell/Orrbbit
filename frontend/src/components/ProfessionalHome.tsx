import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Dimensions, FlatList, Animated as RNAnimated, PanResponder } from "react-native";
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
import RadiusSheet from "@/src/components/RadiusSheet";
import StatusBadge from "@/src/components/StatusBadge";
import SectionHeader from "@/src/components/SectionHeader";
import SegmentedControl from "@/src/components/SegmentedControl";
import ProfessionalFilterSheet from "@/src/components/professional/ProfessionalFilterSheet";
import ProfessionalPreviewSheet from "@/src/components/professional/ProfessionalPreviewSheet";
import ProCarouselCard, { CARD_WIDTH, CARD_GAP, categoryIcon } from "@/src/components/professional/ProCarouselCard";
import { ProFilters, getProFilters, setProFilters, activeFilterCount, proFiltersToQuery } from "@/src/state/proFilters";
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
        onChange={(v) => pickRole(v as "need_help" | "can_help")}
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
  const [filters, setFilters] = useState<ProFilters>(getProFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [quick, setQuick] = useState<{ online: boolean; availableNow: boolean; verified: boolean; topRated: boolean; category: string | null }>({
    online: false,
    availableNow: false,
    verified: false,
    topRated: false,
    category: null,
  });
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
        const p = await api<any>(`/professionals?lat=${coords.lat}&lng=${coords.lng}${proFiltersToQuery(filters)}`);
        setPros(p.professionals);
      }
    } catch {}
  }, [coords, filters]);

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
      !q ||
      [p.name, p.profession, p.primary_category, ...(p.specialties || []), ...(p.verified_categories || [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
  );
  const filterCount = activeFilterCount(filters);

  const applyFilters = (f: ProFilters) => {
    setProFilters(f);
    setFilters(f);
    setShowFilters(false);
  };

  const availState = (p: any) =>
    p.active_now && p.availability === "Available now" ? "available" : !p.active_now ? "offline" : "busy";

  // instant quick-filters for the nearby carousel
  const carouselShown = shown.filter(
    (p: any) =>
      (!quick.online || p.active_now) &&
      (!quick.availableNow || (p.active_now && p.availability === "Available now")) &&
      (!quick.verified || p.verified_by_intro) &&
      (!quick.topRated || p.top_rated) &&
      (!quick.category || p.primary_category === quick.category)
  );

  const sheetLabel = `${shown.length} professional${shown.length === 1 ? "" : "s"} nearby`;
  const [mapAreaH, setMapAreaH] = useState(0);

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

      {/* Radius + Filters render on the map — same components & size as the People Radar.
          The radar fills all remaining vertical space (measured, not fixed) so no blank
          gap appears between the map and the bottom sheet on any screen height. */}
      <View style={{ flex: 1, justifyContent: "flex-start" }} onLayout={(e) => setMapAreaH(Math.round(e.nativeEvent.layout.height))}>
        <RadarView
          height={mapAreaH || undefined}
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
            avail_state: availState(p),
            top_rated: !!p.top_rated,
            score: 6,
            vibe_details: { opportunity_type: "Professional", category: p.primary_category },
          })) as any}
          vibeMap={vibeMap}
          onSelect={(u: any) => setPreview(shown.find((x: any) => `pro:${x.user_id}` === u.id) || null)}
          meUri={me?.photo_url}
          meName={me?.name}
          radiusSetting={me?.radius || 250}
          coords={coords}
          onRadiusPress={() => setShowRadius(true)}
          onFilters={() => setShowFilters(true)}
          filterCount={filterCount}
        />
        <Pressable testID="fab-post-request" style={styles.fab} onPress={() => router.push("/professional/need-help")}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.fabText}>{active ? "My Request" : "Post Request"}</Text>
        </Pressable>
      </View>

      <MapSheet
        testID="pro-sheet"
        collapsedLabel={sheetLabel}
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
                    {o.professional.verified_by_intro && <StatusBadge icon="shield-checkmark" label="Verified by Orrbbit" />}
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

        <View style={styles.nearbyHeader}>
          <Text style={styles.nearbyTitle}>Nearby Professionals</Text>
          <Text style={styles.nearbyCount} testID="nearby-count">
            {carouselShown.length} professional{carouselShown.length === 1 ? "" : "s"} nearby
          </Text>
        </View>

        {/* quick filters — instant */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickRow}
        >
          <QuickChip testID="qf-online" icon="ellipse" iconColor={colors.success} label="Online" active={quick.online} onPress={() => setQuick({ ...quick, online: !quick.online })} />
          <QuickChip testID="qf-available" icon="flash" iconColor={colors.warning} label="Available Now" active={quick.availableNow} onPress={() => setQuick({ ...quick, availableNow: !quick.availableNow })} />
          <QuickChip testID="qf-verified" icon="shield-checkmark" iconColor={colors.teal} label="Verified" active={quick.verified} onPress={() => setQuick({ ...quick, verified: !quick.verified })} />
          <QuickChip testID="qf-top-rated" icon="star" iconColor={colors.purple} label="Top Rated" active={quick.topRated} onPress={() => setQuick({ ...quick, topRated: !quick.topRated })} />
          {categories.slice(0, 8).map((c: string) => (
            <QuickChip
              key={c}
              testID={`qf-cat-${c.replace(/[^a-zA-Z0-9]+/g, "-")}`}
              icon={categoryIcon(c)}
              iconColor={colors.textSecondary}
              label={c}
              active={quick.category === c}
              onPress={() => setQuick({ ...quick, category: quick.category === c ? null : c })}
            />
          ))}
        </ScrollView>

        {carouselShown.length === 0 ? (
          <View style={[styles.card, { alignItems: "center" }]} testID="no-pros-empty">
            <Text style={styles.cardTitle}>No professionals match</Text>
            <Text style={[styles.cardMeta, { textAlign: "center" }]}>Try clearing a quick filter or increasing your radius.</Text>
          </View>
        ) : (
          <FlatList
            testID="pro-carousel"
            horizontal
            data={carouselShown}
            keyExtractor={(p: any) => p.user_id}
            renderItem={({ item }) => (
              <ProCarouselCard
                p={item}
                onPress={() => setPreview(item)}
                onConnect={() => router.push(`/professional/connect/${item.user_id}`)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
          />
        )}
        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
          <Text style={styles.privacyText}>Approximate locations only. Exact locations are never shared.</Text>
        </View>
      </MapSheet>

      {preview && (
        <ProfessionalPreviewSheet
          p={preview}
          onClose={() => setPreview(null)}
          onConnect={() => {
            const id = preview.user_id;
            setPreview(null);
            router.push(`/professional/connect/${id}`);
          }}
          onViewProfile={() => {
            const id = preview.user_id;
            setPreview(null);
            router.push(`/professional/profile/${id}`);
          }}
        />
      )}
      <RadiusSheet visible={showRadius} onClose={() => setShowRadius(false)} onChanged={load} />
      <ProfessionalFilterSheet
        visible={showFilters}
        categories={categories}
        value={filters}
        onClose={() => setShowFilters(false)}
        onApply={applyFilters}
      />
    </View>
  );
}

function CanHelpHome({ coords, vibeMap, me }: any) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [verification, setVerification] = useState<any>({ status: "Not Submitted" });
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verRequired, setVerRequired] = useState(false);
  const [showRadius, setShowRadius] = useState(false);
  const [showCanHelpFilters, setShowCanHelpFilters] = useState(false);
  const [payment, setPayment] = useState<string | null>(null);
  const [freshOnly, setFreshOnly] = useState(false);
  const [mapAreaH, setMapAreaH] = useState(0);

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
      {profile && mapMode ? null : profile ? (
        <View style={[styles.card, shadow.card]} testID="pro-profile-card">
          <View style={styles.proRow}>
            <Avatar uri={me?.photo_url} name={me?.name} size={46} ringColor={verification.status === "Approved" ? colors.teal : colors.border} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.proName}>{profile.profession}</Text>
              <Text style={styles.cardMeta}>{profile.primary_category}{profile.additional_categories?.length ? ` +${profile.additional_categories.length}` : ""}</Text>
              {verification.status === "Approved" ? (
                <StatusBadge icon="shield-checkmark" label="Verified by Orrbbit" />
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
          {/* Radar fills all remaining vertical space (measured) — the requests sheet
              overlays its bottom edge like a modern map app, never a blank gap. */}
          <View style={{ flex: 1 }} onLayout={(e) => setMapAreaH(Math.round(e.nativeEvent.layout.height))}>
            <RadarView
              height={mapAreaH || undefined}
              users={reqUsers as any}
              vibeMap={vibeMap}
              onSelect={(u: any) => router.push(`/professional/request/${u.id.slice(4)}`)}
              meUri={me?.photo_url}
              meName={me?.name}
              radiusSetting={me?.radius || 250}
              coords={coords}
              onRadiusPress={() => setShowRadius(true)}
              onFilters={() => setShowCanHelpFilters(true)}
              filterCount={(payment ? 1 : 0) + (freshOnly ? 1 : 0)}
            />
          </View>
          <MapSheet
            testID="req-sheet"
            collapsedLabel={`${requests.length} matching request${requests.length === 1 ? "" : "s"} nearby`}
            collapsedHint={requests.length === 0 ? "Increase your radius or adjust filters to find more" : undefined}
            onRefresh={load}
            refreshing={refreshing}
            setRefreshing={setRefreshing}
          >
            <View style={styles.proHeaderTop}>
              <Avatar uri={me?.photo_url} name={me?.display_name || me?.name} size={44} ringColor={colors.teal} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.proName} numberOfLines={1}>{me?.display_name || me?.name}</Text>
                <StatusBadge icon="shield-checkmark" label="Verified by Orrbbit" />
              </View>
            </View>
            <View style={[styles.proHeaderActions, { marginBottom: spacing.md }]}>
              <Pressable testID="edit-pro-profile" style={styles.smallBtn} onPress={() => router.push("/professional/can-help")}>
                <Text style={styles.smallBtnText}>Edit Profile</Text>
              </Pressable>
              <Pressable testID="view-pro-profile" style={styles.smallBtn} onPress={() => me?.id && router.push(`/professional/profile/${me.id}` as any)}>
                <Text style={styles.smallBtnText}>View Profile</Text>
              </Pressable>
              <Pressable testID="go-verification" style={styles.smallBtn} onPress={() => router.push("/professional/verification")}>
                <Text style={styles.smallBtnText}>Verification</Text>
              </Pressable>
            </View>
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
          <RadiusSheet visible={showRadius} onClose={() => setShowRadius(false)} onChanged={load} />
          {showCanHelpFilters && (
            <Pressable style={styles.filterOverlay} onPress={() => setShowCanHelpFilters(false)}>
              <Pressable style={[styles.previewSheet]} onPress={() => {}}>
                <View style={styles.sheetHandle} />
                <Text style={styles.cardTitle}>Filter requests</Text>
                {["Open to paying", "Free advice"].map((p) => (
                  <Pressable key={p} testID={`filter-pay-${p.replace(/\s+/g, "-")}`} style={styles.filterRow} onPress={() => setPayment(payment === p ? null : p)}>
                    <Text style={styles.cardMeta}>{p}</Text>
                    <Ionicons name={payment === p ? "checkmark-circle" : "ellipse-outline"} size={20} color={payment === p ? colors.teal : colors.border} />
                  </Pressable>
                ))}
                <Pressable testID="filter-fresh" style={styles.filterRow} onPress={() => setFreshOnly(!freshOnly)}>
                  <Text style={styles.cardMeta}>Posted in the last 4 hours</Text>
                  <Ionicons name={freshOnly ? "checkmark-circle" : "ellipse-outline"} size={20} color={freshOnly ? colors.teal : colors.border} />
                </Pressable>
                <Pressable style={styles.smallBtn} onPress={() => setShowCanHelpFilters(false)}>
                  <Text style={styles.smallBtnText}>Done</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          )}
        </>
      )}
    </Wrapper>
  );
}

function QuickChip({ icon, iconColor, label, active, onPress, testID }: any) {
  return (
    <Pressable testID={testID} style={[qcStyles.chip, active && qcStyles.chipActive]} onPress={onPress}>
      <Ionicons name={icon} size={12} color={active ? "#FFF" : iconColor} />
      <Text style={[qcStyles.text, active && { color: "#FFF" }]}>{label}</Text>
    </Pressable>
  );
}

const qcStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  text: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600" },
});

function MapSheet({ collapsedLabel, collapsedHint, children, testID, onRefresh, refreshing, setRefreshing }: any) {
  const [expanded, setExpanded] = useState(false);
  const H = Math.round(Dimensions.get("window").height * 0.52);
  const COLLAPSED = collapsedHint ? 76 : 56;
  const anim = useRef(new RNAnimated.Value(COLLAPSED)).current;
  useEffect(() => {
    if (!expanded) anim.setValue(COLLAPSED);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [COLLAPSED]);
  const toggle = (open: boolean) => {
    setExpanded(open);
    RNAnimated.spring(anim, { toValue: open ? H : COLLAPSED, useNativeDriver: false, friction: 10 }).start();
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
        <View style={[styles.rowBetween, { justifyContent: "flex-start", gap: 6 }]}>
          <Text style={styles.sheetLabel}>{collapsedLabel}</Text>
          <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={16} color={colors.textSecondary} />
        </View>
        {!!collapsedHint && !expanded && (
          <Text style={styles.sheetHint} numberOfLines={1}>{collapsedHint}</Text>
        )}
      </Pressable>
      {expanded && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg }}
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

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: spacing.lg, minHeight: 44, marginBottom: spacing.md },
  topRatedChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.purple, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  nearbyHeader: { gap: 2, marginTop: spacing.xs },
  nearbyTitle: { color: colors.text, fontSize: font.lg, fontWeight: "600" },
  nearbyCount: { color: colors.textSecondary, fontSize: font.sm },
  quickScroll: { flexGrow: 0, marginHorizontal: -spacing.lg },
  quickRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  carousel: { flexGrow: 0, marginHorizontal: -spacing.lg },
  carouselContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  topRatedChipText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  ratingLine: { color: colors.warning, fontSize: font.sm, fontWeight: "700" },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base, paddingVertical: 8 },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.lg + 56, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: spacing.lg, minHeight: 48, shadowColor: "#FF5A1F", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fabText: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: colors.border, shadowColor: "#0F172A", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -6 }, elevation: 8, overflow: "hidden" },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: spacing.sm, gap: 6 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" },
  sheetLabel: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  sheetHint: { color: colors.textSecondary, fontSize: font.sm, marginTop: -2 },
  compactProfileRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  proHeaderCard: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  proHeaderTop: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.sm },
  proHeaderActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-end", zIndex: 40 },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
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

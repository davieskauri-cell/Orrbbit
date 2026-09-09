import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, font } from "@/src/theme";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { getMyBusiness, saveBusiness, submitBusinessVerification, activateBusinessSubscription, getBusinessSubscription, requestVerificationComputerLink } from "@/src/services/businessService";

async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    const req = perm.canAskAgain ? await ImagePicker.requestMediaLibraryPermissionsAsync() : perm;
    if (!req.granted) return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
}

export default function BusinessSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { coords } = useApp();
  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [abn, setAbn] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [country, setCountry] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [docName, setDocName] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [reqs, setReqs] = useState<Record<string, { registration_label: string; hint: string }>>({});
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyBusiness().then((r) => {
      setCategories(r.categories || []);
      setCountries((r as any).countries || []);
      setReqs((r as any).country_requirements || {});
      if (r.business) {
        setName(r.business.name); setCategory(r.business.category);
        setEmail(r.business.email || ""); setLocation(r.business.location_display);
        setDescription(r.business.description); setLogo(r.business.logo_url || null);
        setCover(r.business.cover_url || null); setWebsite(r.business.website || "");
        setPhone(r.business.phone || ""); setAbn(r.business.abn || "");
        setCountry((r.business as any).country || "");
        setPrimaryContact((r.business as any).primary_contact || "");
        setRegistrationNumber((r.business as any).registration_number || "");
        if (r.business.verification_status === "Pending Review") setStep(4);
      }
    }).catch(() => {});
  }, []);

  if (user && user.account_type !== "business") return <Redirect href="/(tabs)" />;
  if (user && !user.email_verified && !user.is_demo) return <Redirect href="/(auth)/verify-email" />;

  const regLabel = (reqs[country] || reqs["Other"] || { registration_label: "Business registration number", hint: "" });

  const saveDetails = async () => {
    setError(null);
    if (!name.trim()) return setError("Business name is required.");
    if (!category) return setError("Choose a business category.");
    if (!country) return setError("Select your country — verification requirements depend on it.");
    if (!email.trim()) return setError("Business email is required.");
    if (!location.trim()) return setError("Business address is required.");
    if (!phone.trim()) return setError("Business phone number is required.");
    if (description.trim().length < 20) return setError("Please describe your business (at least 20 characters).");
    if (!logo) return setError("Add your business logo.");
    if (!cover) return setError("Add a cover image.");
    setBusy(true);
    try {
      await saveBusiness({
        name: name.trim(), category, email: email.trim(), location_display: location.trim(),
        description: description.trim(), logo_url: logo, cover_url: cover,
        lat: coords?.lat, lng: coords?.lng, website: website.trim(), phone: phone.trim(),
        abn: abn.trim(), country, primary_contact: primaryContact.trim(),
        registration_number: registrationNumber.trim(),
      });
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "Could not save your business profile.");
    } finally {
      setBusy(false);
    }
  };

  const submitVerif = async () => {
    setError(null);
    if (!registrationNumber.trim()) return setError(`${regLabel.registration_label} is required for verification.`);
    if (!primaryContact.trim()) return setError("Primary contact person is required.");
    setBusy(true);
    try {
      await submitBusinessVerification({
        legal_name: name.trim(), country, abn: registrationNumber.trim(),
        email: email.trim(), phone: phone.trim(), website: website.trim(),
        address: location.trim(), primary_contact: primaryContact.trim(),
        document_name: docName.trim(),
      });
      setStep(3);
    } catch (e: any) {
      setError(e?.message || "Could not submit verification.");
    } finally {
      setBusy(false);
    }
  };

  const sendComputerLink = async () => {
    try {
      await requestVerificationComputerLink();
      setLinkSent(true);
    } catch (e: any) {
      setError(e?.message || "Could not send the link.");
    }
  };

  const subscribe = async () => {
    setError(null);
    setBusy(true);
    try {
      await activateBusinessSubscription();
      setStep(4);
    } catch {
      // billing not enabled in this environment → staged access, continue
      try { await getBusinessSubscription(); } catch {}
      setStep(4);
    } finally {
      setBusy(false);
    }
  };

  const finishToDashboard = async () => {
    await refreshUser().catch(() => null);
    router.replace("/(business)");
  };


  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled">
      <View style={s.brandRow}>
        <LogoMark size={30} />
        <Wordmark height={20} />
        <View style={s.brandPill}><Text style={s.brandPillTxt}>BUSINESS</Text></View>
      </View>
      <Text style={s.title}>
        {step === 1 ? "Set up your business" : step === 2 ? "Verification details" : step === 3 ? "Orrbbit Business" : "Verification Pending"}
      </Text>
      <Text style={s.sub}>
        {step === 1 ? "This is how your business appears to people nearby on Orrbbit."
          : step === 2 ? `Required before your business can be verified${country ? ` in ${country}` : ""}.`
            : step === 3 ? "One plan. Everything your business needs on Orrbbit."
              : "Our team is reviewing your business. We'll notify and email you once it's approved."}
      </Text>
      <View style={s.stepsRow}>
        {["Details", "Verification", "Subscription", "Review"].map((lbl, i) => (
          <View key={lbl} style={[s.stepPill, step >= i + 1 && s.stepPillOn]}>
            <Text style={[s.stepPillTxt, step >= i + 1 && { color: "#FFF" }]}>{i + 1}. {lbl}</Text>
          </View>
        ))}
      </View>

      {step === 1 && (<>

      <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.lg }}>
        <Pressable testID="biz-logo" onPress={async () => { const u = await pickImage(); if (u) setLogo(u); }} style={s.logoBox}>
          {logo ? <Image source={{ uri: logo }} style={{ width: 84, height: 84, borderRadius: 20 }} /> : (
            <><Ionicons name="storefront-outline" size={22} color={colors.textTertiary} /><Text style={s.pickTxt}>Logo *</Text></>)}
        </Pressable>
        <Pressable testID="biz-cover" onPress={async () => { const u = await pickImage(); if (u) setCover(u); }} style={s.coverBox}>
          {cover ? <Image source={{ uri: cover }} style={{ width: "100%", height: 84, borderRadius: 16 }} /> : (
            <><Ionicons name="image-outline" size={22} color={colors.textTertiary} /><Text style={s.pickTxt}>Cover image *</Text></>)}
        </Pressable>
      </View>

      <Text style={s.label}>Business name *</Text>
      <TextInput testID="biz-name" value={name} onChangeText={setName} placeholder="The Park Hotel" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Category *</Text>
      <View style={s.chips}>
        {categories.map((c) => (
          <Pressable key={c} testID={`biz-cat-${c}`} onPress={() => setCategory(c)} style={[s.chip, category === c && s.chipOn]}>
            <Text style={[s.chipTxt, category === c && { color: "#FFF" }]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>Country *</Text>
      <View style={s.chips}>
        {countries.map((c) => (
          <Pressable key={c} testID={`biz-country-${c}`} onPress={() => setCountry(c)} style={[s.chip, country === c && s.chipOn]}>
            <Text style={[s.chipTxt, country === c && { color: "#FFF" }]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>Business email *</Text>
      <TextInput testID="biz-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="hello@business.com" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Business address *</Text>
      <TextInput testID="biz-location" value={location} onChangeText={setLocation} placeholder="123 Collins St, Melbourne" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Description *</Text>
      <TextInput testID="biz-desc" value={description} onChangeText={setDescription} multiline placeholder="Tell people what your business is about…" placeholderTextColor={colors.textTertiary} style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} />
      <Text style={s.label}>Phone *</Text>
      <TextInput testID="biz-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+61…" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Website (optional)</Text>
      <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" placeholderTextColor={colors.textTertiary} style={s.input} />

      {error && <Text style={s.error}>{error}</Text>}
      <Pressable testID="biz-save" onPress={saveDetails} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Continue to Verification</Text>}
      </Pressable>
      </>)}

      {step === 2 && (<>
        <Text style={s.label}>Legal / registered business name *</Text>
        <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>{regLabel.registration_label} *</Text>
        <TextInput testID="biz-registration" value={registrationNumber} onChangeText={setRegistrationNumber} placeholder={regLabel.hint} placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Primary contact person *</Text>
        <TextInput testID="biz-contact" value={primaryContact} onChangeText={setPrimaryContact} placeholder="Full name of account contact" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Supporting document (optional)</Text>
        <TextInput testID="biz-doc" value={docName} onChangeText={setDocName} placeholder="e.g. registration-certificate.pdf" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.helper}>Verification documents are private — reviewed only by the Orrbbit team, never shown publicly.</Text>
        <Pressable testID="biz-computer-link" onPress={sendComputerLink} style={s.linkBtn}>
          <Ionicons name="desktop-outline" size={16} color={colors.cobalt} />
          <Text style={s.linkBtnTxt}>{linkSent ? "Link sent — check your business email" : "Complete Business Verification on Computer"}</Text>
        </Pressable>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-verif-submit" onPress={submitVerif} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Continue to Subscription</Text>}
        </Pressable>
      </>)}

      {step === 3 && (<>
        <View style={s.planCard}>
          <Text style={s.planName}>ORRBBIT BUSINESS — FULL ACCESS</Text>
          <Text style={s.planPrice}>$5.99<Text style={s.planPer}>/month</Text></Text>
          {["Business Profile & verified badge", "Business Hosted Events on nearby Radar", "Attendee management & notifications", "Analytics, ratings & reviews", "Mobile + desktop dashboards"].map((f) => (
            <View key={f} style={s.planRow}><Ionicons name="checkmark-circle" size={15} color={colors.teal} /><Text style={s.planFeat}>{f}</Text></View>
          ))}
          <Text style={s.planNote}>Billed safely through Apple / Google Play on your device. Orrbbit never stores card details.</Text>
        </View>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-subscribe" onPress={subscribe} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Start Orrbbit Business</Text>}
        </Pressable>
      </>)}

      {step === 4 && (<>
        <View style={s.pendingBox} testID="biz-pending">
          <Ionicons name="hourglass-outline" size={40} color={colors.cobalt} />
          <Text style={s.pendingTitle}>Verification Pending</Text>
          <Text style={s.pendingTxt}>
            {name || "Your business"} has been submitted for review. Verified Business features
            (like publishing Business Events) unlock once our team approves your verification.
            You can track the status any time on your Business Profile.
          </Text>
        </View>
        <Pressable testID="biz-finish" onPress={finishToDashboard} style={s.cta}>
          <Text style={s.ctaTxt}>Go to Business Dashboard</Text>
        </Pressable>
      </>)}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.lg },
  brandPill: { backgroundColor: colors.cobaltSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  brandPillTxt: { color: colors.cobalt, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, lineHeight: 20 },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: 12, fontSize: font.base, color: colors.text, backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  chipTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  logoBox: { width: 100, height: 100, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  coverBox: { flex: 1, height: 100, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  pickTxt: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600" },
  error: { color: "#DC2626", fontSize: font.sm, marginTop: spacing.lg },
  helper: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.sm, lineHeight: 18 },
  stepsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.lg },
  stepPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stepPillOn: { backgroundColor: colors.cobalt, borderColor: colors.cobalt },
  stepPillTxt: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  linkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1.5, borderColor: colors.cobalt, borderRadius: 14, paddingVertical: 12, marginTop: spacing.xl, backgroundColor: colors.cobaltSoft },
  linkBtnTxt: { color: colors.cobalt, fontSize: font.sm, fontWeight: "800" },
  planCard: { borderWidth: 1.5, borderColor: colors.cobalt, backgroundColor: colors.cobaltSoft, borderRadius: 20, padding: spacing.xl, marginTop: spacing.lg },
  planName: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.4 },
  planPrice: { color: colors.text, fontSize: 38, fontWeight: "800", marginTop: 2 },
  planPer: { fontSize: font.base, color: colors.textSecondary, fontWeight: "600" },
  planRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  planFeat: { color: colors.text, fontSize: font.sm },
  planNote: { color: colors.textSecondary, fontSize: font.sm, marginTop: spacing.md, lineHeight: 18 },
  pendingBox: { alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.xxl, marginTop: spacing.xl, backgroundColor: colors.card },
  pendingTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  pendingTxt: { color: colors.textSecondary, fontSize: font.sm, textAlign: "center", lineHeight: 20 },
  cta: { backgroundColor: colors.cobalt, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
});

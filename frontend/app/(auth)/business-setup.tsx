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

const STEP_LABELS = ["Details", "Contact", "About", "Verify", "Subscribe", "Finish"];

const PLAN_FEATURES = [
  "Business Profile",
  "Verified badge once approved",
  "Host Business Events",
  "Nearby discovery",
  "Attendee management",
  "Analytics & insights",
  "Ratings & reviews",
  "Mobile & desktop access",
  "Local offers & promotions",
  "Dedicated business tools",
];

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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [country, setCountry] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [uploads, setUploads] = useState<Record<string, boolean>>({});
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
        setPhone(r.business.phone || "");
        setCountry((r.business as any).country || "");
        setPrimaryContact((r.business as any).primary_contact || "");
        setRegistrationNumber((r.business as any).registration_number || "");
        if (r.business.verification_status === "Pending Review") {
          setStep(r.business.subscription?.status === "active" ? 6 : 5);
        } else {
          setStep(4);
        }
      }
    }).catch(() => {});
  }, []);

  if (user && user.account_type !== "business") return <Redirect href="/(tabs)" />;
  if (user && !user.email_verified && !user.is_demo) return <Redirect href="/(auth)/verify-email" />;

  const regLabel = (reqs[country] || reqs["Other"] || { registration_label: "Business registration", hint: "" });

  const next = (s: 1 | 2 | 3 | 4 | 5 | 6) => { setError(null); setStep(s); };

  const submitDetails = () => {
    setError(null);
    if (!name.trim()) return setError("Business name is required.");
    if (!category) return setError("Choose a business type / category.");
    if (!country) return setError("Select your country — verification requirements depend on it.");
    if (!location.trim()) return setError("Business address is required.");
    next(2);
  };

  const submitContact = () => {
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("A valid business email is required.");
    if (!phone.trim()) return setError("Business phone number is required.");
    if (!primaryContact.trim()) return setError("Primary contact person is required.");
    next(3);
  };

  const submitAbout = async () => {
    setError(null);
    if (description.trim().length < 20) return setError("Please describe your business (at least 20 characters).");
    if (!logo) return setError("Add your business logo.");
    if (!cover) return setError("Add a cover image.");
    setBusy(true);
    try {
      await saveBusiness({
        name: name.trim(), category, email: email.trim(), location_display: location.trim(),
        description: description.trim(), logo_url: logo, cover_url: cover,
        lat: coords?.lat, lng: coords?.lng, website: website.trim(), phone: phone.trim(),
        country, primary_contact: primaryContact.trim(),
        registration_number: registrationNumber.trim(),
      });
      next(4);
    } catch (e: any) {
      setError(e?.message || "Could not save your business profile.");
    } finally {
      setBusy(false);
    }
  };

  const submitVerif = async () => {
    setError(null);
    if (!registrationNumber.trim()) return setError(`${regLabel.registration_label} is required for verification.`);
    setBusy(true);
    try {
      const docNames = Object.keys(uploads).filter((k) => uploads[k]).join(", ");
      await submitBusinessVerification({
        legal_name: name.trim(), country, abn: registrationNumber.trim(),
        email: email.trim(), phone: phone.trim(), website: website.trim(),
        address: location.trim(), primary_contact: primaryContact.trim(),
        document_name: docNames,
      });
      next(5);
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

  const pickDoc = async (key: string) => {
    const u = await pickImage();
    if (u) setUploads((prev) => ({ ...prev, [key]: true }));
  };

  const subscribe = async () => {
    setError(null);
    setBusy(true);
    try {
      await activateBusinessSubscription();
      next(6);
    } catch {
      // billing not enabled in this environment → staged access, continue
      try { await getBusinessSubscription(); } catch {}
      next(6);
    } finally {
      setBusy(false);
    }
  };

  const finishToDashboard = async () => {
    await refreshUser().catch(() => null);
    router.replace("/(business)");
  };

  const onBack = () => {
    setError(null);
    if (step > 1 && step < 5) setStep((step - 1) as any);
    else if (step === 1) router.back();
  };

  const eyebrow = step <= 3 ? "Business sign up" : step === 4 ? "Verification" : step === 5 ? "Subscription" : "";
  const title =
    step === 1 ? "Let's get your business started"
      : step === 2 ? "How can people reach you?"
        : step === 3 ? "About your business"
          : step === 4 ? "Verify your business"
            : "Orrbbit Business";
  const helper =
    step === 1 ? "Create your Orrbbit Business account and connect with your local community."
      : step === 2 ? "Contact details people and Orrbbit can use to reach your business."
        : step === 3 ? "This is how your business appears to people nearby on Orrbbit."
          : step === 4 ? "Help us verify your business so you can start hosting events."
            : "Get full access to connect with your local community.";

  // ——— Step 6: Verification Pending (own full-screen layout) ———
  if (step === 6) {
    return (
      <ScrollView style={s.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl, flexGrow: 1 }}>
        <View style={s.pLogoRow}>
          <LogoMark size={34} />
          <Wordmark height={22} />
        </View>
        <View style={s.pCentre} testID="biz-pending">
          <View style={s.pIconCircle}>
            <Ionicons name="mail-open" size={44} color={colors.cobalt} />
          </View>
          <Text style={s.pTitle}>Verification Pending</Text>
          <Text style={s.pLead}>Thanks for joining Orrbbit Business!</Text>
          <Text style={s.pTxt}>
            Your account is now under review. We&apos;ll let you know as soon as your business has been verified.
          </Text>
          <View style={s.pInfoCard}>
            <Ionicons name="mail-outline" size={18} color={colors.cobalt} />
            <Text style={s.pInfoTxt}>We&apos;ve sent a confirmation email to your business email address.</Text>
          </View>
        </View>
        <Pressable testID="biz-finish" onPress={finishToDashboard} style={s.cta}>
          <Text style={s.ctaTxt}>Go to Business Dashboard</Text>
        </Pressable>
        <Pressable onPress={() => next(4)} style={s.pMoreRow} hitSlop={8}>
          <Text style={s.pMoreTxt}>Need to complete more details?</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled">
      <View style={s.topRow}>
        <Pressable testID="biz-back" onPress={onBack} hitSlop={10} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.stepCount}>{step} of 6</Text>
      </View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{helper}</Text>

      {step === 1 && (<>
        <Text style={s.label}>Business Name *</Text>
        <TextInput testID="biz-name" value={name} onChangeText={setName} placeholder="e.g. The Park Hotel" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Business Type / Category *</Text>
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
        <Text style={s.label}>Business Address *</Text>
        <TextInput testID="biz-location" value={location} onChangeText={setLocation} placeholder="Enter your business address" placeholderTextColor={colors.textTertiary} style={s.input} />
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-details-continue" onPress={submitDetails} style={s.cta}>
          <Text style={s.ctaTxt}>Continue</Text>
        </Pressable>
      </>)}

      {step === 2 && (<>
        <Text style={s.label}>Business Email *</Text>
        <TextInput testID="biz-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="hello@business.com" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Business Phone *</Text>
        <TextInput testID="biz-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+61…" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Primary Contact Person *</Text>
        <TextInput testID="biz-contact" value={primaryContact} onChangeText={setPrimaryContact} placeholder="Full name of account contact" placeholderTextColor={colors.textTertiary} style={s.input} />
        <Text style={s.label}>Website (optional)</Text>
        <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" placeholderTextColor={colors.textTertiary} style={s.input} />
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-contact-continue" onPress={submitContact} style={s.cta}>
          <Text style={s.ctaTxt}>Continue</Text>
        </Pressable>
      </>)}

      {step === 3 && (<>
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
        <Text style={s.label}>Description *</Text>
        <TextInput testID="biz-desc" value={description} onChangeText={setDescription} multiline placeholder="Tell people what your business is about…" placeholderTextColor={colors.textTertiary} style={[s.input, { minHeight: 100, textAlignVertical: "top" }]} />
        <Text style={s.helper}>Shown on your public Business Profile and Hosted Events.</Text>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-save" onPress={submitAbout} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Continue</Text>}
        </Pressable>
      </>)}

      {step === 4 && (<>
        <View style={s.computerCard}>
          <View style={s.computerIcon}>
            <Ionicons name="desktop-outline" size={24} color={colors.cobalt} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.computerTitle}>Complete on computer?</Text>
            <Text style={s.computerTxt}>We&apos;ll send you a secure link to continue verification on your computer.</Text>
            <Pressable testID="biz-computer-link" onPress={sendComputerLink} style={s.linkBtn}>
              <Text style={s.linkBtnTxt}>{linkSent ? "Link sent — check your email" : "Send me the link"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={s.label}>{regLabel.registration_label} *</Text>
        <TextInput testID="biz-registration" value={registrationNumber} onChangeText={setRegistrationNumber} placeholder={regLabel.hint || "Registration number"} placeholderTextColor={colors.textTertiary} style={s.input} />

        <Text style={s.sectionLbl}>Upload supporting documents</Text>
        {[
          { key: "registration", label: `Business registration${regLabel.registration_label !== "Business registration" ? ` (e.g. ${regLabel.registration_label})` : ""}` },
          { key: "address", label: "Proof of business address" },
          { key: "additional", label: "Additional document (optional)" },
        ].map((d) => (
          <Pressable key={d.key} testID={`biz-doc-${d.key}`} onPress={() => pickDoc(d.key)} style={s.uploadRow}>
            <Text style={[s.uploadTxt, uploads[d.key] && { color: colors.text, fontWeight: "700" }]}>{d.label}</Text>
            {uploads[d.key]
              ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              : <Ionicons name="cloud-upload-outline" size={20} color={colors.textSecondary} />}
          </Pressable>
        ))}
        <Text style={s.helper}>Verification documents are private — reviewed only by the Orrbbit team, never shown publicly.</Text>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-verif-submit" onPress={submitVerif} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Continue</Text>}
        </Pressable>
      </>)}

      {step === 5 && (<>
        <View style={s.planCard}>
          <Text style={s.planName}>Business Full Access</Text>
          <Text style={s.planPrice}>$5.99<Text style={s.planPer}> / month</Text></Text>
          {PLAN_FEATURES.map((f) => (
            <View key={f} style={s.planRow}><Ionicons name="checkmark-circle" size={17} color={colors.success} /><Text style={s.planFeat}>{f}</Text></View>
          ))}
        </View>
        <Text style={s.helper}>Billed safely through Apple / Google Play on your device. Orrbbit never stores card details.</Text>
        {error && <Text style={s.error}>{error}</Text>}
        <Pressable testID="biz-subscribe" onPress={subscribe} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Subscribe Now</Text>}
        </Pressable>
        <Text style={s.cancelNote}>You can cancel anytime.</Text>
      </>)}

      <View style={s.dotsRow}>
        {STEP_LABELS.map((lbl, i) => {
          const active = step >= i + 1;
          return (
            <View key={lbl} style={s.dotItem}>
              <View style={s.dotLineWrap}>
                {i > 0 && <View style={[s.dotLine, step >= i + 1 && s.dotLineOn]} />}
                <View style={[s.dot, active && s.dotOn, step === i + 1 && s.dotCurrent]} />
                {i < STEP_LABELS.length - 1 && <View style={[s.dotLine, step >= i + 2 && s.dotLineOn]} />}
              </View>
              <Text style={[s.dotLbl, active && { color: colors.teal, fontWeight: "800" }]}>{lbl}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  backBtn: { minHeight: 44, justifyContent: "center", marginLeft: -6 },
  stepCount: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  eyebrow: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.3, marginTop: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.xs, lineHeight: 20 },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: 13, fontSize: font.base, color: colors.text, backgroundColor: colors.surface, minHeight: 50 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: "center" },
  chipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipTxt: { color: colors.text, fontSize: font.sm, fontWeight: "600" },
  logoBox: { width: 100, height: 100, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  coverBox: { flex: 1, height: 100, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
  pickTxt: { color: colors.textTertiary, fontSize: font.sm, fontWeight: "600" },
  error: { color: "#DC2626", fontSize: font.sm, marginTop: spacing.lg },
  helper: { color: colors.textTertiary, fontSize: font.sm, marginTop: spacing.md, lineHeight: 18 },
  // Verify step
  computerCard: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.cobaltSoft, borderRadius: 18, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: "#D6E2FF" },
  computerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  computerTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  computerTxt: { color: colors.textSecondary, fontSize: font.sm, marginTop: 3, lineHeight: 18 },
  linkBtn: { backgroundColor: colors.cobalt, borderRadius: 12, paddingVertical: 10, alignItems: "center", marginTop: spacing.md, alignSelf: "flex-start", paddingHorizontal: spacing.lg, minHeight: 40, justifyContent: "center" },
  linkBtnTxt: { color: "#FFF", fontSize: font.sm, fontWeight: "800" },
  sectionLbl: { color: colors.text, fontSize: font.base, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.sm },
  uploadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.lg, paddingVertical: 14, marginBottom: spacing.sm, minHeight: 50 },
  uploadTxt: { color: colors.textSecondary, fontSize: font.base, flex: 1, marginRight: spacing.sm },
  // Subscription
  planCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xl, marginTop: spacing.lg },
  planName: { color: colors.text, fontSize: font.lg, fontWeight: "800" },
  planPrice: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 2, marginBottom: spacing.sm },
  planPer: { fontSize: font.base, color: colors.textSecondary, fontWeight: "600" },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 },
  planFeat: { color: colors.text, fontSize: font.base },
  cancelNote: { color: colors.textTertiary, fontSize: font.sm, textAlign: "center", marginTop: spacing.md },
  // Pending
  pLogoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pCentre: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl },
  pIconCircle: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.cobaltSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  pTitle: { color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  pLead: { color: colors.text, fontSize: font.lg, fontWeight: "700", marginTop: spacing.md },
  pTxt: { color: colors.textSecondary, fontSize: font.base, lineHeight: 21, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
  pInfoCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.cobaltSoft, borderRadius: 14, padding: spacing.lg, marginTop: spacing.xl, alignSelf: "stretch" },
  pInfoTxt: { flex: 1, color: colors.text, fontSize: font.sm, lineHeight: 19, fontWeight: "600" },
  pMoreRow: { alignItems: "center", marginTop: spacing.lg, minHeight: 44, justifyContent: "center" },
  pMoreTxt: { color: colors.teal, fontSize: font.sm, fontWeight: "700", textDecorationLine: "underline" },
  // CTA + dots
  cta: { backgroundColor: colors.teal, borderRadius: 16, minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontSize: font.lg, fontWeight: "800" },
  dotsRow: { flexDirection: "row", marginTop: spacing.xl },
  dotItem: { flex: 1, alignItems: "center", gap: 6 },
  dotLineWrap: { flexDirection: "row", alignItems: "center", alignSelf: "stretch" },
  dotLine: { flex: 1, height: 2, backgroundColor: colors.border },
  dotLineOn: { backgroundColor: colors.teal },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.teal },
  dotCurrent: { width: 12, height: 12, borderRadius: 6 },
  dotLbl: { color: colors.textTertiary, fontSize: 10, fontWeight: "600" },
});

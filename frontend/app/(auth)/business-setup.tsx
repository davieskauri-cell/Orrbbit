import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image } from "react-native";
import { useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { getMyBusiness, saveBusiness } from "@/src/services/businessService";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyBusiness().then((r) => {
      setCategories(r.categories || []);
      if (r.business) {
        setName(r.business.name); setCategory(r.business.category);
        setEmail(r.business.email || ""); setLocation(r.business.location_display);
        setDescription(r.business.description); setLogo(r.business.logo_url || null);
        setCover(r.business.cover_url || null); setWebsite(r.business.website || "");
        setPhone(r.business.phone || ""); setAbn(r.business.abn || "");
      }
    }).catch(() => {});
  }, []);

  if (user && user.account_type !== "business") return <Redirect href="/(tabs)" />;
  if (user && !user.email_verified && !user.is_demo) return <Redirect href="/(auth)/verify-email" />;

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Business name is required.");
    if (!category) return setError("Choose a business category.");
    if (!email.trim()) return setError("Business email is required.");
    if (!location.trim()) return setError("Business location is required.");
    if (description.trim().length < 20) return setError("Please describe your business (at least 20 characters).");
    if (!logo) return setError("Add your business logo.");
    if (!cover) return setError("Add a cover image.");
    setBusy(true);
    try {
      await saveBusiness({
        name: name.trim(), category, email: email.trim(), location_display: location.trim(),
        description: description.trim(), logo_url: logo, cover_url: cover,
        lat: coords?.lat, lng: coords?.lng, website: website.trim(), phone: phone.trim(), abn: abn.trim(),
      });
      await refreshUser().catch(() => null);
      router.replace("/(business)");
    } catch (e: any) {
      setError(e?.message || "Could not save your business profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, paddingHorizontal: spacing.xl }} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Set up your business</Text>
      <Text style={s.sub}>This is how your business appears to people nearby on Orrbbit.</Text>

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
      <Text style={s.label}>Business email *</Text>
      <TextInput testID="biz-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="hello@business.com" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Business location *</Text>
      <TextInput testID="biz-location" value={location} onChangeText={setLocation} placeholder="123 Collins St, Melbourne" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Description *</Text>
      <TextInput testID="biz-desc" value={description} onChangeText={setDescription} multiline placeholder="Tell people what your business is about…" placeholderTextColor={colors.textTertiary} style={[s.input, { minHeight: 90, textAlignVertical: "top" }]} />
      <Text style={s.label}>Website (optional)</Text>
      <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" placeholder="https://" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>Phone (optional)</Text>
      <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+61…" placeholderTextColor={colors.textTertiary} style={s.input} />
      <Text style={s.label}>ABN / registration number (optional)</Text>
      <TextInput value={abn} onChangeText={setAbn} placeholder="12 345 678 901" placeholderTextColor={colors.textTertiary} style={s.input} />

      {error && <Text style={s.error}>{error}</Text>}
      <Pressable testID="biz-save" onPress={save} disabled={busy} style={[s.cta, busy && { opacity: 0.6 }]}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.ctaTxt}>Continue to Business Dashboard</Text>}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
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
  cta: { backgroundColor: colors.cobalt, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: spacing.xl },
  ctaTxt: { color: "#FFF", fontSize: font.base, fontWeight: "800" },
});

import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import { STRINGS } from "@/src/lib/strings";
import { PrimaryButton, SecondaryButton } from "@/src/components/PrimaryButton";
import { colors, spacing, radius, font } from "@/src/theme";

export default function WaitlistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ city?: string; ambassador?: string }>();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email && !user.is_demo ? user.email : "");
  const [city, setCity] = useState(params.city || "");
  const [country, setCountry] = useState("");
  const [ambassador, setAmbassador] = useState(params.ambassador === "1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim() || !email.includes("@")) return setError("Please enter a valid email.");
    if (!city.trim()) return setError("Please enter your city.");
    setError("");
    setBusy(true);
    try {
      await api("/waitlist", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), city: city.trim(), country: country.trim(), ambassador },
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.container, styles.doneWrap, { paddingTop: insets.top }]} testID="waitlist-success">
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={44} color="#FFF" />
        </View>
        <Text style={styles.doneTitle}>{"You're on the list!"}</Text>
        <Text style={styles.doneText}>{STRINGS.waitlistThanks}</Text>
        {ambassador && (
          <Text style={styles.doneText}>
            {"We'll also reach out about becoming an IntroU ambassador in "}{city}.
          </Text>
        )}
        <PrimaryButton testID="waitlist-done" title="Done" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: spacing.xl }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="waitlist-screen"
      >
        <View style={styles.header}>
          <Pressable testID="waitlist-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Join the Waitlist</Text>
        </View>
        <Text style={styles.sub}>
          {"IntroU isn't live in your city yet. Join the waitlist and be first to know when it launches near you."}
        </Text>

        <Text style={styles.label}>Name</Text>
        <TextInput testID="waitlist-name" style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Email</Text>
        <TextInput testID="waitlist-email" style={styles.input} value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>City</Text>
        <TextInput testID="waitlist-city" style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. London" placeholderTextColor={colors.textTertiary} />
        <Text style={styles.label}>Country</Text>
        <TextInput testID="waitlist-country" style={styles.input} value={country} onChangeText={setCountry} placeholder="e.g. United Kingdom" placeholderTextColor={colors.textTertiary} />

        <View style={styles.ambRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ambTitle}>Become an ambassador</Text>
            <Text style={styles.ambText}>Help launch IntroU in your city and host 100m social experiments.</Text>
          </View>
          <Switch testID="waitlist-ambassador-switch" value={ambassador} onValueChange={setAmbassador} trackColor={{ true: colors.teal }} />
        </View>

        {!!error && <Text style={styles.error} testID="waitlist-error">{error}</Text>}

        <PrimaryButton testID="waitlist-submit" title="Join Waitlist" onPress={submit} loading={busy} style={{ marginTop: spacing.lg }} />
        <SecondaryButton testID="waitlist-cancel" title="Cancel" onPress={() => router.back()} style={{ marginTop: spacing.sm, borderWidth: 0 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, lineHeight: 21, marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: font.sm, fontWeight: "700", marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: font.base,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  ambRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  ambTitle: { color: colors.text, fontSize: font.base, fontWeight: "800" },
  ambText: { color: colors.textSecondary, fontSize: font.sm, marginTop: 2, lineHeight: 18 },
  error: { color: colors.pink, fontSize: font.sm, fontWeight: "600", marginTop: spacing.md },
  doneWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  doneTitle: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  doneText: { color: colors.textSecondary, fontSize: font.base, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },
});

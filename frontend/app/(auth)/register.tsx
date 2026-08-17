import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { trackSignup, trackSignupStep, trackAgeGateFailed, trackConsentAccepted } from "@/src/services/analyticsService";
import { openLegal } from "@/src/lib/legalLinks";
import { colors, spacing, radius, font } from "@/src/theme";

const STEPS = ["Account", "Age", "Policies", "Complete"] as const;

const UNDERAGE_MESSAGE =
  "Orrbbit is currently available only to people aged 18 or older. Your account has not been created.";

function isAtLeast18(d: number, m: number, y: number): boolean {
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return new Date(y, m - 1, d) <= cutoff;
}

function validDate(d: number, m: number, y: number): boolean {
  if (!d || !m || !y || y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  return dt <= new Date();
}

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [underage, setUnderage] = useState(false);
  const [acceptPolicies, setAcceptPolicies] = useState(false); // required — unticked by default
  const [marketingOptIn, setMarketingOptIn] = useState(false); // optional — unticked by default
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goToStep = (s: number) => {
    setError(null);
    setStep(s);
    trackSignupStep(STEPS[s].toLowerCase());
  };

  const submitAccount = () => {
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your email.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    goToStep(1);
  };

  const submitAge = () => {
    setError(null);
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!validDate(d, m, y)) return setError("Please enter a valid date of birth.");
    if (!isAtLeast18(d, m, y)) {
      trackAgeGateFailed();
      setUnderage(true);
      return;
    }
    goToStep(2);
  };

  const submitConsent = async () => {
    setError(null);
    if (!acceptPolicies) {
      return setError("Please accept Orrbbit's core policies to create your account.");
    }
    setBusy(true);
    try {
      const dob = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      let locale = "en";
      try {
        locale = Intl.DateTimeFormat().resolvedOptions().locale || "en";
      } catch {}
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        date_of_birth: dob,
        accept_policies: true,
        marketing_opt_in: marketingOptIn,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version || "1.0.0",
        locale,
      });
      trackSignup();
      trackConsentAccepted();
      goToStep(3);
    } catch (e: any) {
      const msg = e.message || "Registration failed";
      if (msg === UNDERAGE_MESSAGE) {
        setUnderage(true);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => {
    setError(null);
    if (underage) {
      setUnderage(false);
      return;
    }
    if (step === 0) router.back();
    else if (step < 3) goToStep(step - 1);
  };

  const renderProgress = () => (
    <View style={styles.progressRow} testID="signup-progress">
      {STEPS.map((label, i) => (
        <View key={label} style={styles.progressItem}>
          <View
            style={[
              styles.progressBar,
              i < step && styles.progressDone,
              i === step && styles.progressCurrent,
            ]}
          />
          <Text style={[styles.progressLabel, i <= step && styles.progressLabelActive]}>{label}</Text>
        </View>
      ))}
    </View>
  );

  if (underage) {
    return (
      <View style={[styles.flex, styles.centerWrap, { paddingTop: insets.top }]}>
        <View style={styles.underageIcon}>
          <Ionicons name="alert-circle" size={40} color={colors.orange} />
        </View>
        <Text style={styles.underageTitle}>We can&apos;t create your account</Text>
        <Text testID="underage-message" style={styles.underageText}>{UNDERAGE_MESSAGE}</Text>
        <PrimaryButton
          testID="underage-back"
          title="Back"
          onPress={() => {
            setUnderage(false);
            setDay(""); setMonth(""); setYear("");
            goToStep(1);
          }}
          style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
        />
        <Pressable onPress={() => router.replace("/(auth)/onboarding")} style={styles.linkRow}>
          <Text style={styles.linkText}>Return to start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {step < 3 && (
          <Pressable testID="register-back" onPress={onBack} style={styles.back} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        {renderProgress()}

        {step === 0 && (
          <>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.sub}>
              Create your Orrbbit account and start discovering people and professionals nearby.
            </Text>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              testID="register-name"
              value={name}
              onChangeText={setName}
              placeholder="Alex Smith"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="register-password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              style={styles.input}
            />
            {error && <Text testID="register-error" style={styles.error}>{error}</Text>}
            <PrimaryButton
              testID="register-continue-account"
              title="Continue"
              onPress={submitAccount}
              style={{ marginTop: spacing.xl }}
            />
            <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.linkRow}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <Text style={[styles.linkText, { color: colors.orange, fontWeight: "700" }]}>Log in</Text>
            </Pressable>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>Your date of birth</Text>
            <Text style={styles.sub}>You must be at least 18 years old to use Orrbbit.</Text>
            <View style={styles.dobRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Day</Text>
                <TextInput
                  testID="register-dob-day"
                  value={day}
                  onChangeText={(t) => setDay(t.replace(/[^0-9]/g, ""))}
                  placeholder="DD"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.input, styles.dobInput]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Month</Text>
                <TextInput
                  testID="register-dob-month"
                  value={month}
                  onChangeText={(t) => setMonth(t.replace(/[^0-9]/g, ""))}
                  placeholder="MM"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.input, styles.dobInput]}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  testID="register-dob-year"
                  value={year}
                  onChangeText={(t) => setYear(t.replace(/[^0-9]/g, ""))}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[styles.input, styles.dobInput]}
                />
              </View>
            </View>
            <View style={styles.dobNote}>
              <Ionicons name="lock-closed" size={14} color={colors.teal} />
              <Text style={styles.dobNoteText}>
                Your date of birth is used to verify your age and is never shown on your profile.
              </Text>
            </View>
            {error && <Text testID="register-error" style={styles.error}>{error}</Text>}
            <PrimaryButton
              testID="register-continue-age"
              title="Continue"
              onPress={submitAge}
              style={{ marginTop: spacing.xl }}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>A safe community for everyone</Text>
            <Text style={styles.sub}>Please review and accept Orrbbit&apos;s core policies to create your account.</Text>

            <Pressable
              testID="register-consent-checkbox"
              style={styles.checkRow}
              onPress={() => setAcceptPolicies(!acceptPolicies)}
            >
              <Ionicons
                name={acceptPolicies ? "checkbox" : "square-outline"}
                size={26}
                color={acceptPolicies ? colors.teal : colors.textTertiary}
              />
              <Text style={styles.checkText}>
                I confirm that I am at least 18 years old and agree to the{" "}
                <Text style={styles.link} onPress={() => openLegal("terms")}>Terms of Service</Text>
                {" "}and{" "}
                <Text style={styles.link} onPress={() => openLegal("community_guidelines")}>Community Guidelines</Text>
                , and acknowledge the{" "}
                <Text style={styles.link} onPress={() => openLegal("privacy")}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            <Pressable
              testID="register-marketing-checkbox"
              style={styles.checkRow}
              onPress={() => setMarketingOptIn(!marketingOptIn)}
            >
              <Ionicons
                name={marketingOptIn ? "checkbox" : "square-outline"}
                size={26}
                color={marketingOptIn ? colors.teal : colors.textTertiary}
              />
              <Text style={styles.checkText}>
                I would like to receive Orrbbit product updates, news and offers.{" "}
                <Text style={styles.optionalTag}>(Optional)</Text>
              </Text>
            </Pressable>

            {error && <Text testID="register-error" style={styles.error}>{error}</Text>}
            <PrimaryButton
              testID="register-submit"
              title="Create account"
              onPress={submitConsent}
              loading={busy}
              disabled={!acceptPolicies}
              style={{ marginTop: spacing.xl, opacity: acceptPolicies ? 1 : 0.5 }}
            />
          </>
        )}

        {step === 3 && (
          <View style={styles.successWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={54} color={colors.teal} />
            </View>
            <Text testID="signup-success-title" style={[styles.title, { textAlign: "center" }]}>Welcome to Orrbbit</Text>
            <Text style={[styles.sub, { textAlign: "center" }]}>Your account has been created successfully.</Text>
            <View style={styles.verifyCard}>
              <Ionicons name="mail-unread-outline" size={22} color={colors.orange} />
              <Text style={styles.verifyText}>
                Please verify your email address to finish setting up your account.
              </Text>
            </View>
            <PrimaryButton
              testID="signup-success-continue"
              title="Continue"
              onPress={() => router.replace("/(auth)/verify-email")}
              style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  centerWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  back: { marginBottom: spacing.md, marginLeft: -6, minHeight: 44, justifyContent: "center" },
  progressRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  progressItem: { flex: 1, alignItems: "center", gap: 6 },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "stretch" },
  progressDone: { backgroundColor: colors.teal },
  progressCurrent: { backgroundColor: colors.orange },
  progressLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
  progressLabelActive: { color: colors.text },
  title: { color: colors.text, fontSize: font.display, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.lg, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 23 },
  label: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "600", marginBottom: spacing.sm, marginTop: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: font.lg,
    minHeight: 52,
  },
  dobRow: { flexDirection: "row", gap: spacing.md },
  dobInput: { textAlign: "center" },
  dobNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  dobNoteText: { flex: 1, color: colors.textSecondary, fontSize: font.sm, lineHeight: 19 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.lg, minHeight: 44 },
  checkText: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "500", lineHeight: 22 },
  link: { color: colors.teal, fontWeight: "700", textDecorationLine: "underline" },
  optionalTag: { color: colors.textTertiary, fontWeight: "400", fontSize: font.sm },
  error: { color: colors.pink, fontSize: font.base, marginTop: spacing.md },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg, paddingVertical: spacing.md, minHeight: 44 },
  linkText: { color: colors.textSecondary, fontSize: font.base },
  successWrap: { alignItems: "center", paddingTop: spacing.xxl },
  successIcon: { marginBottom: spacing.lg },
  verifyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
  verifyText: { flex: 1, color: colors.text, fontSize: font.base, fontWeight: "600", lineHeight: 21 },
  underageIcon: { marginBottom: spacing.lg },
  underageTitle: { color: colors.text, fontSize: font.xl, fontWeight: "800", textAlign: "center" },
  underageText: { color: colors.textSecondary, fontSize: font.lg, textAlign: "center", marginTop: spacing.md, lineHeight: 24 },
});

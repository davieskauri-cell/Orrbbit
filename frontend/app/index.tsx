import { Redirect } from "expo-router";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { LogoMark, Wordmark } from "@/src/components/Logo";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";

export default function Index() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="app-loading">
        <LogoMark size={64} />
        <View style={{ marginTop: spacing.lg }}>
          <Wordmark height={30} />
        </View>
        <Text style={styles.tagline}>Real people. Real moments. Right nearby.</Text>
        <ActivityIndicator color={colors.teal} size="small" style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (!token) return <Redirect href="/(auth)/onboarding" />;
  if (!user?.vibe) return <Redirect href="/(auth)/choose-vibe" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  tagline: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm },
});

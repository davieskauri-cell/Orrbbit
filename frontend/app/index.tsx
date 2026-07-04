import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="app-loading">
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  if (!token) return <Redirect href="/(auth)/onboarding" />;
  if (!user?.vibe) return <Redirect href="/(auth)/choose-vibe" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});

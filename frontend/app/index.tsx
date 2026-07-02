import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="app-loading">
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)" : "/(auth)/onboarding"} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});

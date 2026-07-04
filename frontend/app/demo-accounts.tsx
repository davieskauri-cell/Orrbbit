import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { getDemoAccounts } from "@/src/services/userService";
import Avatar from "@/src/components/Avatar";
import VibePill from "@/src/components/VibePill";
import { colors, spacing, radius, font } from "@/src/theme";

type DemoAccount = {
  email: string;
  name: string;
  age: number;
  vibe: string;
  photo_url: string | null;
  bio: string;
};

export default function DemoAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, demoLogin } = useAuth();
  const { vibeMap, refresh } = useApp();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    getDemoAccounts().then(setAccounts).catch(() => {});
  }, []);

  const switchTo = async (email: string) => {
    setSwitching(email);
    try {
      await demoLogin(email);
      await refresh();
      router.replace("/(tabs)");
    } catch {
      setSwitching(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable testID="demo-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Demo Accounts</Text>
      </View>
      <Text style={styles.sub}>
        Tap an account to experience Intro from their perspective. Password for all: Intro123!
      </Text>

      {accounts.length === 0 && <ActivityIndicator color={colors.teal} style={{ marginTop: spacing.xl }} />}

      {accounts.map((a) => {
        const current = user?.email === a.email;
        const vibe = vibeMap[a.vibe];
        return (
          <Pressable
            key={a.email}
            testID={`demo-account-${a.name.toLowerCase()}`}
            style={[styles.row, current && styles.rowActive]}
            onPress={() => !current && switchTo(a.email)}
          >
            <Avatar uri={a.photo_url} name={a.name} size={52} ringColor={vibe?.color} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.name}>
                {a.name}, {a.age}
              </Text>
              <VibePill vibe={vibe} small />
            </View>
            {switching === a.email ? (
              <ActivityIndicator color={colors.orange} />
            ) : current ? (
              <View style={styles.currentTag}>
                <Text style={styles.currentText}>You</Text>
              </View>
            ) : (
              <Ionicons name="swap-horizontal" size={20} color={colors.textTertiary} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xxl, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  name: { color: colors.text, fontSize: font.lg, fontWeight: "700" },
  currentTag: {
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
  },
  currentText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
});

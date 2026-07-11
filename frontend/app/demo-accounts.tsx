import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { getDemoAccounts } from "@/src/services/userService";
import { api } from "@/src/lib/api";
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
  city: string;
  mode: string;
  verified: boolean;
};

function FilterChips({ label, options, value, onChange, testPrefix }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  testPrefix: string;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {["All", ...options].map((o) => {
          const active = value === o;
          return (
            <Pressable
              key={o}
              testID={`${testPrefix}-${o.replace(/ /g, "-")}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(o)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function DemoAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, demoLogin, setUser } = useAuth();
  const { vibeMap, refresh } = useApp();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [fCity, setFCity] = useState("All");
  const [fVibe, setFVibe] = useState("All");
  const [fMode, setFMode] = useState("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    getDemoAccounts().then(setAccounts).catch(() => {});
  }, []);

  const cities = [...new Set(accounts.map((a) => a.city))];
  const vibes = [...new Set(accounts.map((a) => a.vibe).filter(Boolean))];
  const modes = [...new Set(accounts.map((a) => a.mode).filter(Boolean))];

  const filtered = accounts.filter(
    (a) =>
      (fCity === "All" || a.city === fCity) &&
      (fVibe === "All" || a.vibe === fVibe) &&
      (fMode === "All" || a.mode === fMode) &&
      (!verifiedOnly || a.verified)
  );

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

  const setPlan = async (plan: string) => {
    try {
      const updated = await api("/users/me/state", { method: "PUT", body: { plan } });
      setUser(updated as any);
      refresh();
    } catch {}
  };

  const toggleHighDensity = async () => {
    try {
      const updated = await api("/users/me/state", {
        method: "PUT",
        body: { high_density_demo: !user?.high_density_demo },
      });
      setUser(updated as any);
      refresh();
    } catch {}
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

      <View style={styles.filterBlock}>
        <Text style={styles.filterLabel}>Your plan (demo switch)</Text>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {[
            { key: "free", label: "Free" },
            { key: "plus", label: "Plus" },
            { key: "pro", label: "Pro" },
          ].map((p) => {
            const active = (user?.plan || "free") === p.key;
            return (
              <Pressable
                key={p.key}
                testID={`switch-plan-${p.key}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setPlan(p.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable testID="toggle-high-density" style={styles.verifiedRow} onPress={toggleHighDensity}>
        <Ionicons
          name={user?.high_density_demo ? "checkbox" : "square-outline"}
          size={20}
          color={user?.high_density_demo ? colors.teal : colors.textTertiary}
        />
        <Text style={styles.verifiedText}>High Density Demo</Text>
        <Text style={styles.countText}>142 people within radius</Text>
      </Pressable>

      <FilterChips label="City" options={cities} value={fCity} onChange={setFCity} testPrefix="filter-city" />
      <FilterChips
        label="Vibe"
        options={vibes.map((v) => vibeMap[v]?.label || v)}
        value={fVibe === "All" ? "All" : vibeMap[fVibe]?.label || fVibe}
        onChange={(label) => setFVibe(label === "All" ? "All" : vibes.find((v) => (vibeMap[v]?.label || v) === label) || "All")}
        testPrefix="filter-vibe"
      />
      <FilterChips label="Mode" options={modes} value={fMode} onChange={setFMode} testPrefix="filter-mode" />
      <Pressable
        testID="filter-verified"
        style={styles.verifiedRow}
        onPress={() => setVerifiedOnly((v) => !v)}
      >
        <Ionicons
          name={verifiedOnly ? "checkbox" : "square-outline"}
          size={20}
          color={verifiedOnly ? colors.teal : colors.textTertiary}
        />
        <Text style={styles.verifiedText}>Verified only</Text>
        <Text style={styles.countText} testID="filter-count">{filtered.length} of {accounts.length}</Text>
      </Pressable>

      {accounts.length === 0 && <ActivityIndicator color={colors.teal} style={{ marginTop: spacing.xl }} />}

      {filtered.map((a) => {
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={styles.name}>
                  {a.name}, {a.age}
                </Text>
                {a.verified && <Ionicons name="checkmark-circle" size={15} color={colors.teal} />}
              </View>
              <VibePill vibe={vibe} small />
              <Text style={styles.cityTag}>{a.city} · {a.mode || "Social"}</Text>
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
  cityTag: { color: colors.textTertiary, fontSize: 11, fontWeight: "600" },
  filterBlock: { marginBottom: spacing.sm },
  filterLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 5 },
  chipRow: { gap: spacing.xs },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.textSecondary, fontSize: font.sm, fontWeight: "700" },
  chipTextActive: { color: "#FFF" },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.md },
  verifiedText: { color: colors.text, fontSize: font.sm, fontWeight: "700" },
  countText: { color: colors.textTertiary, fontSize: font.sm, marginLeft: "auto" },
  currentTag: {
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 999,
  },
  currentText: { color: "#FFF", fontSize: font.sm, fontWeight: "700" },
});

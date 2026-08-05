import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/lib/api";
import { useApp } from "@/src/context/AppContext";
import { trackNoticeAck } from "@/src/services/analyticsService";
import { colors, spacing, radius, font } from "@/src/theme";

const STORAGE_KEY = "orrbbit_pro_disclaimer_v1";
const NOTICE_VERSION = "1.0";

/**
 * Shown once before the first meaningful Professional Mode interaction.
 * Acknowledgement is persisted locally and recorded server-side (versioned).
 */
export default function ProfessionalDisclaimerModal() {
  const { setAppMode } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (seen) return;
      try {
        const res = await api<{ acknowledgements: Record<string, any> }>("/users/me/acknowledgements");
        if (res.acknowledgements?.professional_disclaimer) {
          await AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
          return;
        }
      } catch {}
      setVisible(true);
    })();
  }, []);

  const accept = async () => {
    setVisible(false);
    await AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
    api("/consents/acknowledge", {
      method: "POST",
      body: { notice_type: "professional_disclaimer", version: NOTICE_VERSION },
    }).catch(() => {});
    trackNoticeAck("professional_disclaimer");
  };

  const decline = () => {
    setVisible(false);
    setAppMode("people");
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={decline}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="pro-disclaimer-modal">
          <View style={styles.iconWrap}>
            <Ionicons name="briefcase" size={26} color={colors.teal} />
          </View>
          <Text style={styles.title}>Before you use Professional Mode</Text>
          <Text style={styles.text}>
            Professionals on Orrbbit are independent providers. Orrbbit does not employ, endorse or
            guarantee any professional, their qualifications, availability or services.
          </Text>
          <Text style={styles.text}>
            Verification badges mean documents were reviewed — they are not a guarantee of quality or
            outcome. Always use your own judgement, agree on any fees directly, and meet safely.
          </Text>
          <Pressable testID="pro-disclaimer-accept" style={styles.acceptBtn} onPress={accept}>
            <Text style={styles.acceptText}>I understand</Text>
          </Pressable>
          <Pressable testID="pro-disclaimer-decline" style={styles.declineBtn} onPress={decline}>
            <Text style={styles.declineText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(8,26,53,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: "#FFF", borderRadius: radius.card ?? 20, padding: spacing.xl, width: "100%", maxWidth: 380 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E6F7F6", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { color: colors.text, fontSize: font.xl, fontWeight: "800" },
  text: { color: colors.textSecondary, fontSize: font.base, lineHeight: 22, marginTop: spacing.md },
  acceptBtn: { backgroundColor: colors.teal, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: spacing.xl, minHeight: 48, justifyContent: "center" },
  acceptText: { color: "#FFF", fontWeight: "800", fontSize: font.base },
  declineBtn: { alignItems: "center", paddingVertical: 12, marginTop: spacing.sm, minHeight: 44, justifyContent: "center" },
  declineText: { color: colors.textSecondary, fontWeight: "600" },
});

import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { showAlert } from "@/src/lib/alert";

// Canonical customer-facing Orrbbit Business web addresses (never Emergent URLs).
export const BUSINESS_WEB_URL = "https://orrbbit.com/business";
export const BUSINESS_DASHBOARD_URL = "https://orrbbit.com/business/dashboard";

export const openBusinessDashboard = () => {
  Linking.openURL(BUSINESS_DASHBOARD_URL).catch(() => {});
};

export const copyBusinessDashboardLink = async () => {
  try {
    await Clipboard.setStringAsync(BUSINESS_DASHBOARD_URL);
    showAlert("Link copied", BUSINESS_DASHBOARD_URL);
  } catch {
    showAlert("Copy failed", BUSINESS_DASHBOARD_URL);
  }
};

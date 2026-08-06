import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

/**
 * Cross-platform alert. Native uses Alert.alert; web uses window.confirm/alert
 * because react-native-web's Alert is a no-op.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const confirmBtn = buttons.find((b) => b.style !== "cancel") || buttons[buttons.length - 1];
  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b.style !== "cancel");
  if (actions.length >= 2) {
    // Web fallback for 3+ button alerts: offer each action in turn.
    for (const b of actions) {
      if (window.confirm(`${text}\n\n[OK = ${b.text}]`)) {
        b.onPress?.();
        return;
      }
    }
    cancelBtn?.onPress?.();
    return;
  }
  const ok = window.confirm(`${text}\n\n[OK = ${confirmBtn.text}]`);
  if (ok) confirmBtn.onPress?.();
  else cancelBtn?.onPress?.();
}

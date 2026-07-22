// Notifications: Expo Go cannot deliver real push notifications, so IntroYu uses
// its in-app ping modal as the notification surface. This service keeps the
// spec-compatible API so a dev build can swap in expo-notifications later.
export async function requestNotificationPermission(): Promise<boolean> {
  return false; // in-app modal fallback is always used in this MVP
}

export async function sendLocalPing(_title: string, _body: string) {
  // Delivered via the in-app PingModal (AppContext.activePing).
  return;
}

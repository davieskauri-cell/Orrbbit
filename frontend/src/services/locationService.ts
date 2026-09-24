import * as Location from "expo-location";

// Melbourne CBD demo fallback so Orrbbit always works
export const DEMO_LOCATION = { lat: -37.8136, lng: 144.9631 };

export async function requestLocationPermission(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return { granted: true, canAskAgain: current.canAskAgain };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false };
  const req = await Location.requestForegroundPermissionsAsync();
  return { granted: req.granted, canAskAgain: req.canAskAgain };
}

export async function getPermissionGranted(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  return current.granted;
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Adaptive, jitter-filtered location watcher.
 * Samples aggressively from the OS, then decides in JS whether/when to
 * surface an update: ignores GPS accuracy noise (a few metres of drift),
 * and targets ~1-2s cadence while actively moving, ~3s while moving slowly,
 * ~5s while stationary — without forcing GPS polling faster than the
 * device/OS can genuinely provide.
 */
export async function watchUserLocation(
  onUpdate: (coords: { lat: number; lng: number }) => void
): Promise<Location.LocationSubscription> {
  let last: { lat: number; lng: number; t: number } | null = null;
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 1000 },
    (pos) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const now = Date.now();
      if (!last) {
        last = { ...next, t: now };
        onUpdate(next);
        return;
      }
      const movedM = calculateDistanceBetweenUsers(last, next);
      const elapsedMs = now - last.t;
      // GPS drift/accuracy noise — never move the marker for a few metres of jitter
      if (movedM < 4) return;
      const speedMs =
        typeof pos.coords.speed === "number" && pos.coords.speed > 0
          ? pos.coords.speed
          : movedM / Math.max(elapsedMs / 1000, 0.5);
      const minIntervalMs = speedMs > 1.2 ? 1200 : speedMs > 0.3 ? 3000 : 5000;
      if (elapsedMs < minIntervalMs) return;
      last = { ...next, t: now };
      onUpdate(next);
    }
  );
}

export function calculateDistanceBetweenUsers(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ----- Map privacy helpers -----
// Exact GPS is only ever used for the logged-in user themselves.
export const getCurrentUserExactLocation = getCurrentLocation;

// Matching/filtering uses real distance internally — never exposed as coordinates to the UI.
export const calculateDistanceForMatching = calculateDistanceBetweenUsers;

/**
 * Returns a fuzzed, privacy-safe display position for another user.
 * Deterministic per user id so markers stay stable (no live-tracking feel),
 * always clamped inside the selected radius and the 500m absolute cap.
 */
export function getApproximateDisplayLocation(
  u: { id: string; distance: number; bearing: number },
  maxRadius: number = 100
): { distance: number; bearing: number } {
  let h = 0;
  for (let i = 0; i < u.id.length; i++) h = (h * 31 + u.id.charCodeAt(i)) % 9973;
  const bearingJitter = (h % 25) - 12; // ±12°
  const distJitter = ((h >> 3) % 13) - 6; // ±6m
  const cap = Math.min(maxRadius, 500);
  const distance = Math.max(4, Math.min(u.distance + distJitter, cap));
  return { distance, bearing: (u.bearing + bearingJitter + 360) % 360 };
}

/** Markers for the radar map: me = exact (own eyes only), others = approximate. */
export function getMapMarkers(
  me: { photo_url?: string | null; name?: string | null },
  nearby: { id: string; distance: number; bearing: number }[],
  radius: number
) {
  return {
    currentUserMarker: { ...me, exact: true },
    nearbyUserMarkers: nearby.map((u) => ({
      ...u,
      display: getApproximateDisplayLocation(u, radius),
    })),
  };
}

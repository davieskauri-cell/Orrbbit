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

export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export async function watchUserLocation(
  onUpdate: (coords: { lat: number; lng: number }) => void
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 15000 },
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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

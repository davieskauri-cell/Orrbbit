import * as Location from "expo-location";

// Melbourne CBD demo fallback so INTRO always works
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

import { api } from "@/src/lib/api";
import type { NearbyUser } from "@/src/context/AppContext";

export const MAX_RADIUS = 100;

export async function getUsersWithinRadius(coords: { lat: number; lng: number }) {
  const res = await api<{ users: NearbyUser[]; count: number; radius: number }>(
    `/nearby?lat=${coords.lat}&lng=${coords.lng}`
  );
  return res;
}

export const calculateCompatibility = (u: NearbyUser) => u.compatible;

export const getCompatibleUsers = (users: NearbyUser[]) =>
  users.filter((u) => u.compatible);

export const requestConnection = (userId: string, helpRequestId?: string) =>
  api<{ status: "pending" | "connected"; request_id?: string; match?: any }>("/connect/request", {
    method: "POST",
    body: { user_id: userId, help_request_id: helpRequestId },
  });

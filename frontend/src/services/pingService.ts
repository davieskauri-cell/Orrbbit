import { api } from "@/src/lib/api";

export const createPing = (coords: { lat: number; lng: number }) =>
  api<{ ping: any }>(`/pings/generate?lat=${coords.lat}&lng=${coords.lng}`, {
    method: "POST",
  });

export const listPings = () => api<any[]>("/pings");

export const acceptPing = (pingId: string) =>
  api(`/pings/${pingId}/accept`, { method: "POST" });

export const dismissPing = (pingId: string) =>
  api(`/pings/${pingId}/dismiss`, { method: "POST" });

// ---- ping cooldown rules (mirrors backend logic for local checks) ----
const shown: Record<string, number> = {};
const COOLDOWN_MS = 2 * 60 * 1000;

export const recordPingShown = (userId: string) => {
  shown[userId] = Date.now();
};

export const hasPingCooldownExpired = (userId: string) =>
  !shown[userId] || Date.now() - shown[userId] >= COOLDOWN_MS;

export const preventDuplicatePing = (userId: string) => !hasPingCooldownExpired(userId);

export const canSendPing = (user: {
  visible: boolean;
  ghost_mode: boolean;
  paused: boolean;
  quiet_mode: boolean;
  vibe: string | null;
}) =>
  user.visible &&
  !user.ghost_mode &&
  !user.paused &&
  !user.quiet_mode &&
  !!user.vibe &&
  user.vibe !== "busy";

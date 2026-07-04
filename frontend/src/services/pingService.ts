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

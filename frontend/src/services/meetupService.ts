import { api } from "@/src/lib/api";

export const startTemporaryLocationSharing = (userId: string, meetupPoint?: string) =>
  api("/meetups", { method: "POST", body: { user_id: userId, meetup_point: meetupPoint || null } });

export const getActiveMeetup = (coords: { lat: number; lng: number }) =>
  api<{ meetup: any }>(`/meetups/active?lat=${coords.lat}&lng=${coords.lng}`);

export const stopTemporaryLocationSharing = (meetupId: string) =>
  api(`/meetups/${meetupId}/end`, { method: "POST" });

export const cancelMeetup = (meetupId: string, reason: string) =>
  api(`/meetups/${meetupId}/cancel`, { method: "POST", body: { reason } });

export const endMeetup = stopTemporaryLocationSharing;

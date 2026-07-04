import { api } from "@/src/lib/api";

export const startTemporaryLocationSharing = (userId: string) =>
  api("/meetups", { method: "POST", body: { user_id: userId } });

export const getActiveMeetup = (coords: { lat: number; lng: number }) =>
  api<{ meetup: any }>(`/meetups/active?lat=${coords.lat}&lng=${coords.lng}`);

export const stopTemporaryLocationSharing = (meetupId: string) =>
  api(`/meetups/${meetupId}/end`, { method: "POST" });

export const endMeetup = stopTemporaryLocationSharing;

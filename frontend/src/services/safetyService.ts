import { api } from "@/src/lib/api";

export const REPORT_REASONS = [
  "Inappropriate behaviour",
  "Fake profile",
  "Harassment",
  "Unsafe interaction",
  "Spam",
  "Other",
];

export const blockUser = (userId: string) =>
  api("/blocks", { method: "POST", body: { user_id: userId } });

export const reportUser = (userId: string, reason: string, details = "") =>
  api("/reports", { method: "POST", body: { user_id: userId, reason, details } });

export const hideProfile = () =>
  api("/users/me/state", { method: "PUT", body: { visible: false } });

export const endActiveMeetup = async (coords: { lat: number; lng: number }) => {
  const res = await api<{ meetup: any }>(`/meetups/active?lat=${coords.lat}&lng=${coords.lng}`);
  if (res.meetup) await api(`/meetups/${res.meetup.id}/end`, { method: "POST" });
  return !!res.meetup;
};

export const submitSafetyFeedback = (spoke: string, experience: string, comments = "") =>
  api("/feedback", { method: "POST", body: { spoke, experience, comments } });

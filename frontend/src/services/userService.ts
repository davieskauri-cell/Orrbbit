import { api } from "@/src/lib/api";

export const updateProfile = (fields: {
  name?: string;
  age?: number;
  bio?: string;
  interests?: string[];
  photo_url?: string | null;
}) => api("/users/me", { method: "PUT", body: fields });

export const updateVibe = (vibe: string) =>
  api("/users/me/state", { method: "PUT", body: { vibe } });

export const getDemoAccounts = () => api("/demo-accounts");

export const addPhoto = (photo: string) =>
  api("/users/me/photos", { method: "POST", body: { photo_url: photo } });

export const removePhoto = (index: number) =>
  api(`/users/me/photos/${index}`, { method: "DELETE" });

export const getVibes = () => api("/vibes");

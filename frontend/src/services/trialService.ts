import { api } from "@/src/lib/api";

export const getTrialStats = () =>
  api<{ event: any; active: boolean }>("/trial");

export const joinTrialMode = () =>
  api("/users/me/state", { method: "PUT", body: { trial_mode_active: true } });

export const leaveTrialMode = () =>
  api("/users/me/state", { method: "PUT", body: { trial_mode_active: false } });

export const recordTrialPing = () => Promise.resolve();
export const recordTrialMatch = () => Promise.resolve();
export const recordConfirmedConversation = () => Promise.resolve();

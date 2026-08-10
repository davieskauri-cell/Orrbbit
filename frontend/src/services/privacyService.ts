import { api } from "@/src/lib/api";

export const updatePrivacySettings = (settings: {
  radius?: number;
  visible?: boolean;
  ghost_mode?: boolean;
  paused?: boolean;
  quiet_mode?: boolean;
  only_same_vibe?: boolean;
  verified_only?: boolean;
  who_can_see?: string;
  visible_for?: number;
  show_recruiters?: boolean;
  mutual_only?: boolean;
  people_min_age?: number;
  people_max_age?: number;
  people_allow_age_expansion?: boolean;
  relationship_age_prompt_seen?: boolean;
}) => api("/users/me/state", { method: "PUT", body: settings });

export const toggleGhostMode = (on: boolean) =>
  updatePrivacySettings({ ghost_mode: on });

export const toggleVisibility = (on: boolean) =>
  updatePrivacySettings({ visible: on });

// ---- visibility sessions ----
export const startVisibilitySession = (durationMinutes: number) =>
  updatePrivacySettings({ visible: true, visible_for: durationMinutes });

export const endVisibilitySession = () => updatePrivacySettings({ visible: false });

export const isVisibilityExpired = (expiresAt?: string | null) =>
  !!expiresAt && new Date(expiresAt).getTime() <= Date.now();

export const toggleQuietMode = (on: boolean) =>
  updatePrivacySettings({ quiet_mode: on });

export const toggleSameVibeOnly = (on: boolean) =>
  updatePrivacySettings({ only_same_vibe: on });

export const toggleVerifiedOnly = (on: boolean) =>
  updatePrivacySettings({ verified_only: on });

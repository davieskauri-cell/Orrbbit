import { api } from "@/src/lib/api";

export const updatePrivacySettings = (settings: {
  radius?: number;
  visible?: boolean;
  ghost_mode?: boolean;
  paused?: boolean;
  only_same_vibe?: boolean;
  verified_only?: boolean;
  who_can_see?: string;
  visible_for?: number;
}) => api("/users/me/state", { method: "PUT", body: settings });

export const toggleGhostMode = (on: boolean) =>
  updatePrivacySettings({ ghost_mode: on });

export const toggleVisibility = (on: boolean) =>
  updatePrivacySettings({ visible: on });

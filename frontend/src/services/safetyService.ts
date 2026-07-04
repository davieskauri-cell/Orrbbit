import { api } from "@/src/lib/api";

export const REPORT_REASONS = [
  "Inappropriate behaviour",
  "Fake profile",
  "Harassment",
  "Unsafe interaction",
  "Other",
];

export const blockUser = (userId: string) =>
  api("/blocks", { method: "POST", body: { user_id: userId } });

export const reportUser = (userId: string, reason: string, details = "") =>
  api("/reports", { method: "POST", body: { user_id: userId, reason, details } });

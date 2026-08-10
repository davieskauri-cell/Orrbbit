import { api } from "@/src/lib/api";

export const track = (event: string, props?: Record<string, any>) =>
  api("/analytics", { method: "POST", body: props ? { event, props } : { event } }).catch(() => {});

export const trackSignup = () => track("signup");
export const trackSignupStep = (step: string) => track(`signup_step_${step}`);
export const trackAgeGateFailed = () => track("signup_age_gate_failed_client");
export const trackConsentAccepted = () => track("signup_consent_accepted");
export const trackAccountDeleted = () => track("account_delete_requested");
export const trackNoticeAck = (notice: string) => track(`notice_ack_${notice}`);
export const trackVibeSelected = () => track("vibe_selected");
export const trackProfileView = () => track("profile_view");
export const trackPingSent = () => track("ping_sent");
export const trackPingAccepted = () => track("ping_accepted");
export const trackMatchCreated = () => track("match_created");
export const trackMeetupStarted = () => track("meetup_started");
export const trackMeetupEnded = () => track("meetup_ended");
export const trackFeedbackSubmitted = () => track("feedback_submitted");

export const getMetrics = () => api("/metrics");

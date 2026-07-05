import { api } from "@/src/lib/api";

const track = (event: string) =>
  api("/analytics", { method: "POST", body: { event } }).catch(() => {});

export const trackSignup = () => track("signup");
export const trackVibeSelected = () => track("vibe_selected");
export const trackProfileView = () => track("profile_view");
export const trackPingSent = () => track("ping_sent");
export const trackPingAccepted = () => track("ping_accepted");
export const trackMatchCreated = () => track("match_created");
export const trackMeetupStarted = () => track("meetup_started");
export const trackMeetupEnded = () => track("meetup_ended");
export const trackFeedbackSubmitted = () => track("feedback_submitted");

export const getMetrics = () => api("/metrics");

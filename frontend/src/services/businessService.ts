import { api } from "@/src/lib/api";

export type BusinessSubscription = {
  status: string;
  product_id?: string;
  price?: string;
  platform?: string | null;
  renews_at?: string | null;
  billing_mode?: string;
  billing_pending_configuration?: boolean;
  can_publish?: boolean;
};

export type Business = {
  id: string;
  slug?: string;
  name: string;
  category: string;
  secondary_category?: string;
  email?: string;
  description: string;
  location_display: string;
  logo_url?: string | null;
  cover_url?: string | null;
  website?: string;
  phone?: string;
  socials?: string;
  opening_hours?: string;
  abn?: string;
  verified: boolean;
  verification_status?: string;
  verification_note?: string;
  average_rating?: number | null;
  review_count?: number;
  rating_distribution?: Record<string, number>;
  subscription?: BusinessSubscription;
};

export type BizReview = {
  id: string;
  rating: number;
  text: string;
  tags: string[];
  created_at: string;
  reviewer_name: string;
  reviewer_photo?: string | null;
  event_title: string;
  event_id: string;
  status?: string;
};

export type BizOverview = {
  business_name: string;
  verified: boolean;
  verification_status: string;
  active_events: number;
  upcoming_events: number;
  people_going: number;
  event_views: number;
  event_impressions: number;
  profile_views: number;
  average_rating: number | null;
  review_count: number;
  events_hosted: number;
  completed_events: number;
  can_publish: boolean;
  subscription_status: string;
};

export const getMyBusiness = () => api<{ business: Business | null; categories: string[] }>("/business/me");
export const saveBusiness = (body: any) => api<{ business: Business }>("/business/me", { method: "POST", body });
export const submitBusinessVerification = (body: any) =>
  api("/business/me/verification", { method: "POST", body });
export const getBusinessOverview = () => api<BizOverview>("/business/me/overview");
export const getBusinessAnalytics = () =>
  api<BizOverview & { strongest_category?: string | null; top_event?: any }>("/business/me/analytics");
export const getBusinessReviews = () =>
  api<{ average_rating: number | null; review_count: number; distribution: Record<string, number>; reviews: BizReview[] }>("/business/me/reviews");
export const getBusinessSubscription = () => api<BusinessSubscription & { guidance?: string }>("/business/subscription");
export const activateBusinessSubscription = () =>
  api("/business/subscription/activate", { method: "POST", body: { platform: "sandbox" } });
export const cancelBusinessSubscription = () => api("/business/subscription/cancel", { method: "POST" });
export const getPublicBusiness = (ref: string) =>
  api<Business & { upcoming_events: any[]; past_events: any[]; reviews: BizReview[] }>(`/business/public/${ref}`);
export const getReviewEligibility = (eventId: string) =>
  api<{ eligible: boolean; reason: string; event: any; tags: string[] }>(`/events/${eventId}/review/eligibility`);
export const submitReview = (eventId: string, body: { rating: number; text?: string; tags?: string[] }) =>
  api(`/events/${eventId}/review`, { method: "POST", body });
export const reportReview = (reviewId: string, reason: string) =>
  api(`/reviews/${reviewId}/report`, { method: "POST", body: { reason } });
export const requestVerificationComputerLink = () =>
  api<{ ok: boolean; delivery: string }>("/business/me/verification-link", { method: "POST" });

import { api } from "@/src/lib/api";

export type OrbEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  cover_image?: string | null;
  location_display: string;
  location_privacy_type: string;
  visibility_radius: number;
  start_datetime: string;
  end_datetime: string;
  capacity: number | null;
  join_type: string;
  status: string;
  going: number;
  spots_left: number | null;
  distance: number;
  bearing: number;
  host: { id: string; name: string; photo_url?: string | null; verified: boolean; business_id?: string | null };
  host_type?: "personal" | "business";
  business_id?: string | null;
  offer?: string | null;
  is_host: boolean;
  my_status?: string | null;
  location_locked?: boolean;
};

export const EVENT_CATEGORY_ICONS: Record<string, string> = {
  "Coffee / Drinks": "cafe",
  "Fitness": "fitness",
  "Walking / Running": "walk",
  "Sport": "basketball",
  "Social": "people",
  "Networking": "briefcase",
  "Business Networking": "business",
  "Study": "book",
  "Food": "restaurant",
  "Food Deals / Discounts": "pricetag",
  "Happy Hour": "beer",
  "Games": "dice",
  "Outdoor": "leaf",
  "Community": "hand-left",
  "Music": "musical-notes",
  "Live Music": "mic",
  "Wellness": "flower",
  "Gaming": "game-controller",
  "Entertainment": "ticket",
  "Professional Meetup": "people-circle",
  "Workshop": "construct",
  "Classes": "school",
  "Hospitality": "wine",
  "Launch Event": "rocket",
  "Market": "storefront",
  "Promotions": "megaphone",
  "Other": "sparkles",
};

export const nearbyEvents = (lat: number, lng: number, category?: string, hostType?: string, date?: string) =>
  api<{ events: OrbEvent[]; categories: string[] }>(
    `/events/nearby?lat=${lat}&lng=${lng}${category ? `&category=${encodeURIComponent(category)}` : ""}${hostType ? `&host_type=${hostType}` : ""}${date ? `&date=${date}` : ""}`);

export const getEvent = (id: string) => api<OrbEvent>(`/events/${id}`);
export const createEvent = (body: any) => api<OrbEvent>("/events", { method: "POST", body });
export const editEvent = (id: string, body: any) => api<OrbEvent>(`/events/${id}`, { method: "PUT", body });
export const cancelEvent = (id: string) => api(`/events/${id}/cancel`, { method: "POST" });
export const joinEvent = (id: string) => api<{ join_status: string }>(`/events/${id}/join`, { method: "POST" });
export const leaveEvent = (id: string) => api(`/events/${id}/leave`, { method: "POST" });
export const eventAttendees = (id: string) =>
  api<{ attendees: any[]; is_host: boolean }>(`/events/${id}/attendees`);
export const manageAttendee = (id: string, uid: string, action: "accept" | "decline" | "remove") =>
  api(`/events/${id}/requests/${uid}/${action}`, { method: "POST" });
export const reportEvent = (id: string, reason: string, details?: string) =>
  api(`/events/${id}/report`, { method: "POST", body: { reason, details } });
export const myEvents = () => api<{ hosting: OrbEvent[]; joined: OrbEvent[]; past: OrbEvent[] }>("/events/mine");

# INTRO — Product Requirements Document

## Product
INTRO — proximity-based social app. Tagline: "Real people. Real moments." Promise: "See who's open to connecting nearby, right now."
Users pre-signal a social intention ("vibe"). Compatible users physically nearby (≤100m HARD CAP) receive gentle pings, can view each other's profile, and on mutual acceptance unlock temporary (15-minute) approximate meetup location sharing.

## Status: FULL MVP COMPLETE + SAFETY/TRIAL UPDATE (July 2026)
Tested: 22/22 (iteration_2) + 10/10 new backend cases + frontend flows (iteration_3).

## Safety & trial-readiness update (July 2026)
- Positioning: "See who nearby is open to being approached." (consent-based icebreaker)
- Approach Confidence: vibe-based icebreaker openers on Match screen (src/lib/icebreakers.ts)
- Match copy: "You both accepted 🎉" → Continue → Safety Confirmation screen (5-item checklist) → Meetup
- Location explainer: (auth)/how-location-works.tsx between Welcome and Register
- Visibility sessions: visible_for 15/30/60 min (default 30), visibility_expires_at set server-side, auto-expire watcher in AppContext, session chip on radar, "Visibility ended" state + turn back on
- Quiet Mode: stay visible but receive no pings (privacy toggle + backend gate)
- Approximate distances everywhere: distLabel() "About Xm away" / "Within 100m"
- Profile preview: Active now badge, "Intro safety protected" badge, mutual vibe label, verified checkmark, Block + Report buttons
- Report screen (/report): 6 reasons + optional details; Block ends any active meetup with that user (backend)
- Meetup: Report issue button; ending meetup → Feedback screen (spoke/experience/comments → POST /api/feedback)
- Trial Mode (/trial): Southbank Social Trial demo event + stats, join/leave, live banner on radar
- Invite (/invite): QR placeholder + intro.app/southbank-trial link
- Test Metrics (/metrics): 11 live counters from GET /api/metrics (demo accounts only, Profile menu)
- Analytics: POST /api/analytics events (signup, vibe_selected, profile_view, match_created, meetup_started/ended, feedback_submitted)
- Verified placeholder: per-account flags (Sarah/Jake/Liam/Emily unverified), checkmarks in lists/profile
- Improved empty states with Increase radius / Invite people / Change vibe actions; Busy state with Change vibe
- Under-18 message: "INTRO is currently only available for users 18 and older."

## Core rules
- Max distance: 100m — never show/ping/match beyond it (enforced server-side in /api/nearby, state radius clamp 10–100).
- Radius options: 10 / 25 / 50 / 100m, default 50m.
- 8 vibes: open_to_chat (teal), relationship (pink), coffee_drinks (orange), networking (teal), need_advice (purple), gym_buddy (green), exploring (amber), busy (grey, matches no one). Compatibility graph in server.py COMPAT.
- Privacy: opt-in location, visibility/ghost/pause toggles, no exact GPS shown, meetup sharing expires after 15 min, block/report.
- Demo mode: GPS denied → Melbourne CBD fallback; demo users positioned at fixed offsets (Sarah 25m … Emily 94m). Ping generator runs every 20s, 2-min per-person throttle, picks closest compatible user.

## Branding
White bg, Orange #FF5A1F, Teal #20B2AA, Pink #FF2D55, text #111827/#6B7280, card #F8FAFC, border #E5E7EB. Radar-wave logo (src/components/Logo.tsx + generated app icons via /app/scripts/gen_icons.py).

## Architecture
- backend/server.py — FastAPI+Mongo: auth (register 18+/login/demo-login), vibes, demo-accounts, profile/state, nearby (compute_nearby w/ blocks, ghost, only_same_vibe, verified_only filters), pings (generate/list/dismiss/accept), matches, meetups (15-min expiry), encounters, blocks, reports. 10 demo accounts seeded on startup (password Intro123!).
- frontend/app: (auth)/ onboarding|login|register|profile-setup|choose-vibe; (tabs)/ index(Radar)|nearby|pings|encounters|profile; modals: vibe, person/[id], match, meetup, privacy, safety, demo-accounts, edit-profile.
- frontend/src: context (AuthContext w/ session token, AppContext w/ location + nearby 8s poll + ping 20s poll), services (auth/user/location/matching/ping/meetup/privacy/safety/notification per spec), components (RadarView, PingModal, MeetupMap stylised, Avatar w/ initials fallback, VibePicker, UserRow, PrimaryButton, InterestChip, ToggleRow, EmptyState, VibePill, Logo).

## Key endpoints
POST /api/auth/{register,login,demo-login}; GET /api/auth/me, /api/vibes, /api/demo-accounts;
PUT /api/users/me, /api/users/me/state; GET /api/nearby?lat&lng;
POST /api/pings/generate?lat&lng, GET /api/pings, POST /api/pings/{id}/{dismiss,accept};
POST /api/matches; POST /api/meetups, GET /api/meetups/active?lat&lng, POST /api/meetups/{id}/end;
GET /api/encounters; POST /api/blocks, /api/reports.

## Notes / known limitations
- Notifications: in-app PingModal only (Expo Go can't do real push); notificationService is a stub for a future dev build.
- Social sign-in buttons (Apple/Google) are visual placeholders → "coming soon" alert.
- Native map not used — MeetupMap is a stylised custom component (works web + native, spec asked for stylised map).
- Web preview always uses demo location (browser denies GPS in iframe).

## Backlog / next
- Real push notifications via Emergent-managed push (needs dev build + user request).
- Photo upload (currently preset avatar picker).
- Visible-for timer actually expiring visibility (currently stored setting only).
- Verified badge flow.

## Global-Scale & Market-Ready Update (June 2026) — COMPLETE
Backend (server.py):
- Static demo data: CITIES (7, Melbourne "Trial Active"), ZONES (7 Melbourne zones), DEMO_EVENT, DEMO_CAMPUS, COMMUNITIES (12), MODES, AMBASSADOR_DEMO (Kauri), GLOBAL_DEMO_USERS (12 across London/NY/Toronto/Auckland/Singapore, seeded on startup, <=100m in own city).
- Endpoints: GET /api/cities, /api/events/demo, /api/campus, /api/communities, /api/modes, /api/ambassador, /api/trial-report, /api/north-star; POST /api/waitlist. GET /api/metrics extended (waitlist_signups, ambassador_invites, event_joins, signups_by_city). /api/demo-accounts returns city/mode/verified. PUT /api/users/me/state accepts mode/city/country/intent. Nearby is city-scoped (only same-city users appear).
Frontend:
- New screens: /cities (city list + Melbourne zones), /city/[name] (INTRO {CITY} landing template: live stats or waitlist CTA + ambassador CTA), /waitlist (form → POST /api/waitlist, success state, ?city=&ambassador=1 params), /ambassador (stats grid + task checklist + invite), /trial-report (summary + export PDF placeholder alert), /launch-checklist (3-section internal checklist w/ progress), /event-mode, /campus, /networking, /communities, (auth)/intent ("What brings you to Intro?" 6 options after register, saves intent, skippable).
- ModeSelector (src/components/ModeSelector.tsx) on Radar: Social/Networking/Campus/Events/Communities/Dating/Fitness chips; sets user.mode via state API; chips with screens navigate to them.
- Profile: "Intro Worldwide" menu section (Cities, Event Mode, Campus, Networking, Communities, Ambassador Hub, Join Waitlist) + "Trial Tools" for demo users (Test Metrics, Trial Report, Launch Checklist).
- Metrics screen: North Star card (Confirmed Conversations today/week/city/event/total via /api/north-star) + Signups by city list.
- Demo Accounts: filters by City / Vibe / Mode chips + Verified-only checkbox, live count "X of Y".
- strings.ts (src/lib/strings.ts): localization-ready copy constants (English only; partial adoption — new screens use it, older screens still hardcoded = P2 backlog).
Fixes this session:
- session.ts seeds token synchronously from localStorage on web (fixes 401 on direct URL access/refresh of authed screens).
- PingModal auto-dismisses on route change (no longer blocks screens after navigating).
Testing: iteration_4.json — backend 15/15 new + 32 regression pass; frontend ~92% pass, 2 medium issues found & fixed above.

## Backlog / next (updated)
- P2: migrate remaining hardcoded strings in older screens (radar, auth, profile, safety) to strings.ts.
- Refactor: split 945-line server.py into routes/models modules.
- shadow* → boxShadow style migration (web deprecation warnings only).
- Real push notifications (dev build + user request), photo upload, verified badge flow.

## Profile Photos Update (June 2026) — COMPLETE
- Minimum 3 photos (max 6) required on Sign up (profile-setup) and Edit Profile; save/next blocked with "Please add at least 3 photos." until met.
- PhotoGrid component (src/components/PhotoGrid.tsx): gallery picker via expo-image-picker (multi-select, base64 data URIs, quality 0.4), permission contract (pre-explanation → request → Open Settings on permanent denial), remove per-photo, "Main" tag on first photo, count hint.
- Backend: users.photos list; POST /api/users/me/photos (one photo per request — chunked to avoid proxy limits, cap 6), DELETE /api/users/me/photos/{index}; photo_url auto-synced to photos[0]; photos in public_user; ProfileUpdate accepts photos. All demo + global users seeded with 3 photos.
- profile-setup: replaced preset avatar row with PhotoGrid + "Use sample photos" quick link (fills to 3); both screens hydrate form state after async auth restore.
- app.json: NSPhotoLibraryUsageDescription (iOS), READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE (Android). expo-image-picker ~17.0.11 installed.

## Vibe Details / Intent Card Update (June 2026) — COMPLETE
- Every vibe now has optional structured "Vibe Details": intent, context, looking_for, can_offer/can_help_with, tags, visibility (public / after_view / after_accept / hidden, default public), plus vibe-specific fields per the spec (relationship intention+values, coffee setting+time, networking identity/background/industry/experience, Hiring/Recruiter Mode fields, Job Seeker fields, advice need/offer/both with category+urgency+comfort, gym training types, exploring intents, busy settings).
- Form config: src/lib/vibeDetailForms.ts (VIBE_FORMS, conditional showIf for recruiter/job-seeker/advice-offer). Screen: app/vibe-details.tsx ("Add more detail", Skip / Save, sensitive-vibe reminder "Only share what you are comfortable with"). Reached after choose-vibe (auth flow → ?next=tabs), after Change Vibe modal, and via Profile > Vibe Details.
- Backend: PUT /api/users/me/vibe-details; users.vibe_details; detail_score() + mutual_reason() in nearby (sorted score desc then distance); nearby payload adds intent/context/tags/vibe_details/mutual_reason/score; visibility setting respected; busy users hidden unless "Visible but not available"; recruiters hidden when show_recruiters=false (privacy toggle "Show me recruiter profiles" in Privacy screen + state field).
- Pings now carry reason/context/intent (shown in PingModal as orange reason chip + italic context).
- Save for Later: POST/GET/DELETE /api/saved (stores distance_at_save + saved_at, no live tracking); person screen "Save for later" button; /saved screen; Profile > Saved menu item.
- Nearby: rows show intent, quoted context, tags, mutual reason; second filter row (Active now, Verified, Same vibe, Hiring now, Recruiters, Job seekers, Founders, Mentors, Long-term, Coffee now, Career advice, Weights), multi-select AND.
- Person preview: mutual reason banner, intent headline, VibeDetailsCard (hiring box, job-seeker box, chips sections).
- All 10 demo accounts seeded with spec vibe details (Sarah=Need Career Advice/HR burnout, Olivia=Recruiter hiring Frontend Dev+Product Designer, Mia=Long-term, Liam=Weights, etc.). For Kauri, Sarah ranks first (score 10, "Sarah needs career advice and you can help with career").
- PingModal now only appears on discovery tabs (/, /nearby, /pings, /encounters) — fixes recurring overlay-blocking bug.
- Testing: iteration_5.json — backend 11/11 new + full suite 58/58 green (stale asserts fixed); frontend ~95% pass, no new bugs.

## Safety, Trust, Moderation & Launch-Ready Update (June 2026) — COMPLETE
Backend (server.py):
- Report risk levels: classify_risk (low/medium/high by keyword). High → auto-hide reported user (visible=false, admin_status=hidden_pending_review, report status 'User Hidden'); 3rd medium report → auto-hide; medium → admin_status=flagged. Reporter auto-hides reported user (db.hides). Response message: "Thanks. We'll review this report. You will no longer see this person."
- Admin: GET /api/admin/dashboard (overview incl active_by_city/event, pings, accepts, meetups, conversations, reports, blocks, hidden, no_shows, cancellations; reports_queue; blocked_users; safety_incidents by risk; trial_metrics; recruiter_activity), POST /api/admin/reports/{id}/action {hide|warn|ban|dismiss|review} + db.moderationActions log. Hidden/banned users excluded from nearby.
- Anti-creep: POST /api/hide (bidirectional permanent removal + saved cleanup, merged into get_blocked_ids via db.hides), ping per-person cooldown 2→10 min, "Just browsing" users get no auto pings.
- Mutual Only Mode: state field mutual_only; in compute_nearby the user only appears to people matching their compat/verified/same-vibe/recruiter prefs.
- Event codes: EVENT_CODES (INTRO100, FOUNDERNIGHT, CAMPUSCHAT, MELBOURNEBETA, NETWORK100, COFFEECHAT); POST /api/events/join-code (+analytics event_join, invalid→404 'Event code not found.'), /api/events/leave; same-event = +5 score + mutual reason 'You are both at {event}'; event_code/event_name in public_user.
- Availability window + intent strength (vibe_details.availability / intent_strength): in nearby payload, scoring (+6 actively, +3 open, -5/-3 browsing); seeded for Kauri/James/Sarah/Olivia/Jake. confirmed_conversation_count seeded (Kauri 4, James 7, Sarah 1, Olivia 5).
- Meetups: meetup_point stored; POST /api/meetups/{id}/cancel {reason} → db.cancellations; 'They did not show' → db.no_shows + no_show_count inc; message 'Meetup ended. Location sharing stopped.'
- GET /api/users/me/completion (10 items, score, suggestions, friendly message); POST /api/dismissal-feedback (not-interested learning).
Frontend:
- /admin (demo-only via Profile > Trial Tools): overview grid, active-by-city, safety incidents by risk, reports queue with Hide/Warn/Ban/Dismiss actions, blocked users, trial metrics + "N conversations started through Intro tonight", recruiter activity.
- /etiquette (Respectful introductions, 6 rules, 'I understand'): shown at end of signup (vibe-details → etiquette?next=tabs) + Safety screen card.
- /join-event (code input, error copy, Scan QR placeholder, demo codes list, Leave event) + event banner on Radar; Profile menu 'Join Event Code'.
- /meetup-point (10 public options, no private places note) inserted: match → meetup-point → safety-confirm (shows point + 'Keep it simple, respectful and low-pressure.') → meetup.
- meetup.tsx: 'Cancel meetup' with 5 reasons; 'I feel uncomfortable' offers End/Hide from person/Report.
- person/[id]: footer = Not Now (→ optional 'Why not this one?' chips + Skip → /api/dismissal-feedback) / Save for later / Hide / Block / Report.
- Profile: completion card (score bar + suggestions + friendly copy). Privacy: 'Mutual Only Mode' toggle. Vibe Details form: Availability window + intent strength chips for every vibe.
- UserRow shows availability chip; ModeCards on Radar (Networking/Dating/Campus/Fitness count cards); nearby empty state buttons (Increase radius/Change vibe/Join event/Invite/Demo); saved screen shows 'Currently unavailable'.
- Report reasons updated to risk-tiered list incl. Recruiter spam/Stalking concern.
Testing: iteration_6.json — backend 13/13 new pass; frontend all flows verified, no production bugs. Note: reports/hides/blocks persist across restarts (users re-seed).
Known LOW: shadow* deprecation warnings in theme.ts (web only).

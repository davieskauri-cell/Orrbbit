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

## Map Radar Update (June 2026) — COMPLETE
- Radar screen now shows a soft light stylised map behind the existing radar rings/bubbles (src/components/MapBackground.tsx — pure SVG: pale blue river, pale green parks, light grey street grid + diagonal boulevard, minimal labels; no tiles/no real coordinates). Everything else on the screen unchanged.
- RadarView rebuilt (src/components/RadarView.tsx): rounded map card, rings 25/50/75/100m with labels, semi-transparent teal fill inside selected radius, rotating sweep + pulse kept, me-marker = 44px avatar with teal ring + drop pointer (exact position, own eyes only), nearby blips use fuzzed positions.
- Gestures: pinch-to-zoom (1–3x), drag/pan (clamped), double-tap zoom toggle, floating re-centre button (react-native-gesture-handler + reanimated). Zooming never reveals others' exact locations.
- locationService additions: getCurrentUserExactLocation, getApproximateDisplayLocation (deterministic per-id jitter ±12°/±6m, clamped to radius & 100m — stable, no live-tracking feel), getMapMarkers, calculateDistanceForMatching.
- Privacy text extended: "Approximate distance only. Exact location stays hidden. Your exact location is only visible to you."
- Verified: 7 blips at 50m radius (Sarah…Liam), Ryan(78m)/Emily(94m) excluded; radius filtering/pings/matching logic untouched.

## Map Radar v2 (June 2026) — COMPLETE
- Radar map now uses REAL basemap tiles (CARTO Positron light / OpenStreetMap, src/components/MapTiles.tsx) centred on the user's ACTUAL location (GPS when granted; DEMO_LOCATION Melbourne CBD fallback). Stylised SVG (MapBackground) remains as offline/loading fallback layer. Attribution shown.
- Map is edge-to-edge (full screen width, 340h, hairline top/bottom borders, no rounded card).
- Zooming in shrinks all user markers via inverse scale (markers keep constant screen size; markerStyle = 1/scale) — me marker + blips.
- Privacy unchanged: only the current user's real coords are used for tiles; others remain fuzzed approximate positions.

## Freemium Plans, Discovery Limits & Map UI (June 2026) — COMPLETE
Backend (done previous session): PLAN_LIMITS free/plus/pro (max radius 50/100/500m, radius_options per plan), plan+max_radius+radius_options in public_user, PUT /users/me/state validates plan & clamps radius, /nearby capped at MAX_DISCOVERY=100 sorted by relevance (detail score) then distance. Demo plans: kauri/olivia/ryan=pro, james/mia/emily=plus.
Frontend (this session):
- Signup flow: register → /location-privacy?next=setup ("Continue") → /plans?next=setup ("Choose your Intro plan") → (auth)/intent → profile-setup → choose-vibe (unchanged after).
- /plans: 3 plan cards (Free/Plus $6.99/Pro $12.99), Current Plan chip, DEMO-ONLY upgrade (Alert "Payments are not active in this prototype"), privacy note. Reachable from Profile menu (menu-plans) + privacy screen link + locked-radius upgrade alert.
- /location-privacy: 5 privacy cards; Profile menu "How Map Privacy Works" (menu-location-privacy).
- Privacy screen: radius options 10/25/50/100/250/500 with lock icon + 0.7 opacity for options above user's max_radius; tapping locked → Alert "Xm needs Intro Plus/Pro" with "See plans" → /plans; plan hint + "Unlock a bigger radius" link (hidden for Pro).
- Radar top bar redesigned: compact vibe selector pill (VibePill + chevron-down → /vibe) + visibility chip ("Visible · Xm left"/"Hidden", tap toggles, testID visibility-toggle). Eye icon removed from header.
- RadarView: dynamic ring sets per radius (≤50→10/25/50 … 500→125/250/375/500), map tile zoom adapts (18/17/16/15), "Filters" pill on map top-right → /privacy, marker CLUSTERING max 24 (8 bearing sectors × 3 distance bands; >1 in bucket → teal count bubble, tap → Nearby tab).
- Nearby: footer note "Showing the 100 most relevant people nearby" at 100-user cap; Profile card shows plan chip (my-plan-chip).
Testing: iteration_7.json — all 7 frontend flows PASS, no fixes required. MOCKED: plan upgrades (no real payments), Apple/Google sign-in.

## Final Product Update — Spec Completion (June 2026) — COMPLETE
Backend: plan switch applies default radius (free 50/plus 100/pro 250); high_density_demo flag injects up to 142 synthetic profiles (hd-*) into /nearby, still 100-capped & relevance-ranked.
Frontend:
- All "100m maximum" wording removed app-wide (onboarding badge "Starts free within 50m", how-location-works "Radius depends on your plan", privacy points "Bigger radius. Same privacy...", strings.ts, join-event, person/[id]); distLabel supports 500m; getApproximateDisplayLocation cap fixed 100→500 (Pro radii now render correctly).
- Radar: "Radius: Xm ˅" chip on map opens bottom-sheet with plan locks + spec upgrade prompts ("Unlock 100m with Intro Plus" / "Unlock extended discovery with Intro Pro"); marker tap → preview card (name/age/vibe/intent/approx distance/View Profile); privacy pill "🔒 Exact locations hidden…" + Learn more → /location-privacy; extended-radius note ≥250m; high-density card at 100+ w/ "Why limit?"; stats Nearby/Aligned/Radius; See More Nearby CTA; "You" label on me-marker; clusters "+N" + dominant vibe label.
- NEW /plan-confirmed ("You're all set!" + plan copy + mini radar preview + Edit setup) and /review-setup (6 rows w/ Edit + Start using Intro).
- Onboarding back buttons on: how-location-works, location-privacy, plans, intent, profile-setup, choose-vibe, etiquette (canGoBack-guarded); intent/profile-setup/choose-vibe now push (state preserved on back — data persists server-side per step).
- location-privacy rewritten per spec (6 cards incl. "Extended discovery stays private", button "I understand").
- vibe change prompt: "You changed your vibe → Update details / Keep for now".
- demo-accounts: plan switcher chips + High Density Demo toggle (142 people, clusters, best-100).
- Nearby: "100+ people nearby · Showing the best 100…" header + cap footer card w/ Why limit.
- ModeSelector trimmed to Social/Networking/Campus/Events/Fitness.
- CRITICAL FIX: react-native-web Alert.alert is a NO-OP → added src/lib/alert.ts showAlert (native Alert / web window.confirm-alert) and swapped in all 20 screens. Web upgrade flow no longer hangs; prompts work on web preview.
Testing: iteration_8.json 10/11 pass; the 1 flagged issue (HD Nearby tab empty) NOT reproducible — verified working with screenshot (header + 100 profiles render). Vibe prompt + upgrade prompt verified via browser dialogs post alert-fix.
Known LOW: shadow*/pointerEvents deprecation warnings (web only, cosmetic).

## Radar Map Visual Redesign — Premium Bird's-Eye (June 2026) — COMPLETE
Visual-only update to Radar map area (no logic/flow changes elsewhere):
- Map tiles switched CARTO Positron (grey) → CARTO Voyager @2x (colourful: buildings, green parks, blue water) with subtle 3D bird's-eye tilt (perspective+rotateX 9°+scale 1.22 on tile layer only) + soft white vignette gradient.
- Map height now ~50% of screen (clamp 340–480px).
- Controls: Radius chip TOP-LEFT, Filters top-right, zoom +/− and re-centre stacked mid-right (radar-zoom-in/out), privacy pill moved INSIDE map bottom-centre (Learn more → /location-privacy via onLearnMore prop; removed from index.tsx below-map).
- Markers: soft shadows, "me" marker zIndex-top w/ glow, min 40px spacing pass (overlapping avatars offset, clamped to map bounds).
- Clustering rule now exactly per spec: top-24 most relevant (backend order) render as individual avatars, the REST cluster into sector/band bubbles; leftover singleton buckets merge into nearest cluster (24-avatar cap strictly held).
- Nearby Now card now shows "· {context}" after distance.
- Backend demo state: 27 new seeded Melbourne radar demo users (@radar.intro.demo, password Intro123!) incl. Maya (27, Need Advice, Marketing Manager, ~40m, rich vibe_details) + two cluster pockets. Kauri can_help_with += Marketing. Verified: Kauri Pro @500m → exactly 36 nearby, 14 aligned, Maya top compatible with reason "Maya needs marketing advice and you can help with marketing".
Verified via screenshots (web preview): rings 125/250/375/500, 24 avatars + clusters, all controls, stats 36/14/500m.

## INTRO Focus Map — Radar Visual Experience v3 (June 2026) — COMPLETE
Radar-only update (no other flows touched):
- FOCUS VIEW: only top-12 most relevant people get individual markers (hard cap 24 unchanged); rest cluster. "61 nearby · Showing your best 12" summary chip (testID focus-summary) top-left under radius chip.
- RELEVANCE LEVELS: strong match (compatible && score>=6) = 42px avatar + vibe-coloured glow halo; possible match = 38px normal; non-compatible = 34px @ 0.55 opacity.
- CLUSTERS: vibe-coloured bubbles (+N + short label: Chat/Coffee/Advice/Networking/Dating/Gym/Exploring when >=50% share vibe). Tap → Nearby list PRE-FILTERED to dominant vibe (nearby.tsx reads ?vibe= param; added Exploring filter chip).
- SOCIAL HEAT ZONES: clusters >=5 users render soft two-layer semi-transparent vibe-colour circles behind rings (privacy-safe, approximate).
- RINGS SOFTER: selected radius ring strongest (teal 1.5px), inner active rings faint teal, guides light grey.
- CENTRE PULSE: existing teal pulse retained (represents broadcasting; map hidden entirely when invisible).
- STATS MICROCOPY: "48 active now" / "12 strong matches" / "Pro Plan 👑|Plus Plan|Free Plan" sub-lines.
- BEST NEARBY MATCH card (testID best-match-card, was nearby-now-card): only shows when a strong match exists (best = strongMatches[0], no fallback), kicker BEST NEARBY MATCH, button "View".
- NEARBY NOW secondary row (testID nearby-now-row): orange kicker + See More Nearby button + 4-avatar stack + "+57 more".
- DEMO STATE: RADAR_DEMO_USERS rebuilt via _build_radar_demo() → 52 users (10 strong w/ intent_strength "Actively looking now", 12 Chat pocket, 8 Coffee pocket, 6 Advice pocket, 16 scattered). With 9 core accounts: EXACTLY 61 nearby / 47 aligned / 12 strong / ~48 active for Kauri (Pro, radius 500 now in seed). Stale radar users auto-deleted on seed ($nin cleanup). Kauri seed radius=500.
Verified via screenshots: focus chip, vibe-coloured clusters (+14 Chat, +10 Coffee, +7 Advice), heat zones, glows, stats microcopy, BEST NEARBY MATCH, cluster-tap filtering.

## Fix: crisp map zoom (June 2026)
- RadarView now swaps to higher-zoom CARTO tiles while zoomed (tileBoost 0/1/2 at scale >=1.5 / >=2.6): renders 2x/4x-size MapTiles at zoom+1/+2 scaled down, so pixels stay native instead of CSS-upscaled. Boost updates on pinch end, double-tap, +/- buttons and re-centre (runOnJS for gesture callbacks).
- Verified via screenshot at 2.25x: street names crisp.

## Beta Production-Readiness Pass (June 2026) — COMPLETE
User goal: prepare Intro for beta release; no new features.
- DEMO CONTROLS HIDDEN from public users. Private Test Mode: tap "Intro v1.0.0" version text in Profile 7x → unlocks "Test & Trial Tools" (Demo Accounts, Trial Mode, Admin Dashboard, Test Metrics, Trial Report, Launch Checklist) + "Use Demo Account" login button + "Disable Test Mode" row. Flag: AsyncStorage `intro_test_mode` (src/lib/testMode.ts).
- ACCOUNT DELETION (store compliance): DELETE /api/users/me — deletes user + pings/matches/meetups/saved/blocks/hides (reports retained for moderation). Demo accounts → 403. Frontend: Profile → "Delete Account" (testID delete-account-btn) with confirm dialog → signOut → onboarding.
- PRIVACY HARDENING: /api/nearby no longer returns ANY lat/lng for other users (regular, demo, or synthetic HD) — only rounded distance + bearing; frontend fuzzes display positions client-side (unchanged).
- PUSH NOTIFICATIONS: intentionally MOCKED for beta (in-app ping popups via PingModal). notificationService.ts kept structured for later Firebase/Emergent push. Warning item added to Launch Checklist. Real push = post-beta task (needs google-services.json + device builds).
- Testing: iteration_10 (11/11 backend, 8/9 frontend) + iteration_11 retest (all pass). pytest: /app/backend/tests/test_iter10_beta_readiness.py, test_iter11_privacy_fix.py.
- Location permissions: expo-location foreground flow with canAskAgain handling; app.json has iOS infoPlist descriptions + Android ACCESS_FINE/COARSE_LOCATION.

## Opportunity feature + HD Map Zoom (July 2026) — COMPLETE
PART 1 — Opportunity (connection/introduction only, NO marketplace/payments):
- New vibe `opportunity` (amber #F59E0B, sparkles) in VIBES/COMPAT; appears on Choose Vibe + Change Vibe screens; Continue routes to /opportunity-details (generic vibe-details redirects there when vibe=opportunity).
- /opportunity-details: type pills (Need help/Can help/Paid task/Selling something/Collaboration), category pills (Business/HR/Tech/Home/Car/Fitness/Other), Public Summary (80 chars, "Visible to nearby users before you connect."), Private Details (300 chars, "Only shared after mutual connection."), Payment pills, 4-step how-it-works (Choose Opportunity/Add Key Details/See It Nearby/Discuss After Connecting), prohibited-content note, Save Opportunity / Back / Delete Opportunity (clears + reverts vibe to open_to_chat).
- Radar: amber ring + sparkle badge on opportunity markers; amber clusters labelled by dominant type/category (+N Paid Tasks/Help/Business/Opportunities). Marker tap → "Opportunity Nearby" bottom card (category · type, payment, ~distance, public summary, Connect to Discuss, X).
- /opportunity/[id]: public summary card, PRIVATE DETAILS locked card → unlocks in place after Discuss Opportunity (creates match), SHARED BY profile card, Meet Safely / Maybe Later, Report link.
- Backend: GET /api/opportunity/{user_id} (connected flag via active match; private_details only when connected). compute_nearby strips private_details ALWAYS. PUT vibe-details rejects banned terms (weapons/drugs/adult/gambling/investment schemes/medical claims) → 400. Report reasons + risk words extended (Scam/Misleading/Unsafe item/Illegal→high/Payment dispute). 5 seeded Melbourne opportunity demo users (Priya hero @80m + Dev/Sana/Jade/Marco).
PART 2 — HD zoom: base retina tile layer (zoom+1 @2x) ALWAYS mounted + high-detail layer (zoom+2 @2x) stacks on top when scale>=1.5; boost now switches DURING pinch (boostSV threshold in worklet), zoom clamped to CARTO max 20; overlays (avatars/clusters/rings/labels) remain 1x crisp. Privacy unchanged (fuzzed positions, no exact pins).
Fixes: PingModal backdrop now dismisses on tap (was blocking radar); nearby.tsx requests location on direct entry (empty list bug).
Tested: iteration_12 (backend 8/8) + iteration_13 (all frontend flows pass).

## Consent-Based Connection Flow (July 2026) — COMPLETE
Problem fixed: POST /matches instantly marked both users accepted (one-tap "mutual" match; Opportunity private details unlocked without owner consent).
New flow: A sends request (POST /api/connect/request → pending, stored in db.pings kind='request') → B explicitly Accepts (POST /api/pings/{id}/accept → creates match, unlocks messaging + Opportunity private details) or Declines (POST /api/pings/{id}/decline → nothing created, details stay locked). A is notified via Pings tab "Sent Requests" section (Pending/Accepted 🎉/No longer active) and request_status on GET /api/opportunity/{id}.
Guards: blocked both directions/invisible/paused/ghost/banned → 403; deleted/unknown → 404; self → 400; duplicate pending idempotent; reverse-pending = explicit mutual consent → single match (no duplicates, race-safe); legacy POST /matches redirected to consent flow; accept re-checks blocks.
UI: person Connect + Discuss Opportunity → "Request Sent ✓" disabled state; opportunity locked card shows Waiting/No-longer-active states; Pings tab incoming requests have Accept/Decline.
Files: backend/server.py; frontend: pings.tsx, opportunity/[id].tsx, person/[id].tsx, pingService.ts, matchingService.ts, AppContext.tsx.
Tested: backend curl matrix (accept/decline/block/invisible/404/self/duplicate/simultaneous/legacy) + two-account browser E2E (12 steps) — all pass. Note: testing_agent timed out once; validation done by main agent scripts.


## Professional Verification System V2 (June 2026) — DONE
- Profession-specific verification: 17 professions with sub-categories; 4-step wizard (profession → categories → upload docs w/ details+expiry → identity)
- Credential docs (PDF/JPG/PNG, max 10, admin-only visibility, stored in verification_documents)
- Automatic expiry management: reminders 90/60/30 days, auto-expire, statuses Verified/Expiring Soon/Expired
- Hard gate: unverified/expired pros hidden from listings, cannot see requests or offer help (existing conversations remain)
- Category restrictions: verified broad category only (profession_broad map)
- Admin dashboard: profession/categories/docs+expiry, image preview, approve/reject/more_info/suspend/renew/mark_expired, audit history
- Public profile: Professionally Verified card (profession, ✓ categories, verified since, valid until, Verified by Intro)
- In-app notifications (db.notifications) for all verification events — push still MOCKED

## Demo Environment (July 2026) — DONE
- 'Explore Demo' one-tap login (no credentials) into persona demo@intro.demo with full seeded dataset
- ~80 people, 23 professionals across all verification states, 14 help requests, connections/pings/offers/notifications, populated admin dashboard
- DEMO badge on radar + Profile card with Reset Demo Data (POST /api/demo/reset) and Exit Demo Mode
- Production-safe: reset only touches demo-flagged/persona records; non-demo users get 403

## Adaptive People + Professional Radar (July 2026) — DONE
- One shared radar screen; role selector (I Need Help | I Can Help) via shared SegmentedControl below mode switch
- I Need Help: verified professionals on map + list, category/available-now filters, spec empty states
- I Can Help: matching help requests on map (verified categories only), verification-required gate
- Nearby tab follows mode+role; mode/role persist server-side; cluster labels: +N Pros / +N Requests
- Demo persona quick-switching from Profile demo card

## INTRO Control Centre — Phase 1 (June 2026) — DONE
Desktop-first admin web portal at `/control` (Expo web, React Native Web). Master operating portal reusing the existing backend/DB.
- Separate admin auth domain: JWT (token_type=control_access, 8h expiry), bcrypt, login at /control/login, forced password change on first login (min 10 chars), account lockout (5 fails → 15 min), login audit (IP/UA), reauth (POST /auth/reauth, 5-min window) for high-risk actions (ban, delete, create admin) via HTTP 428 → reauth modal
- Secure bootstrap: first Super Admin seeded once from backend/.env (CONTROL_BOOTSTRAP_EMAIL/PASSWORD); never re-runs; no creds in source
- Roles: super_admin, operations, verification, support, moderation, marketing, finance, analytics (ROLE_PERMS in control_center.py); Admin Users page (super admin only, create requires reauth, temp password forces change)
- LIVE/DEMO mode: X-Admin-Mode header; demo = is_demo users (+linked docs via user_id), live = real users; confirmation modal before LIVE (red badge) / DEMO (blue badge); cross-mode user management blocked (400)
- Modules built: Dashboard (15 KPIs, system status, 6 SVG charts), Command Centre (live feed, category+time filters, 10s auto-refresh in Live), Action Required (quick approve/reject/renew), Users (search/pagination/detail/timeline/actions: suspend/unsuspend/ban/force logout/verify email/reset password/delete), Professionals, Verification queues (Pending/Approved/Rejected/Expired/Expiring Soon + decisions with note), Help Requests (close/feature/delete), Reports (warn/suspend/ban/dismiss), Audit Logs (who/what/when/old/new/IP/mode), Global search, Phase 2/3 placeholder pages
- Payments/Subscriptions: intentionally "Not configured" — NO fake financial data in LIVE (per user requirement); full module deferred to Phase 3 as provider-agnostic integration-ready infra
- Files: backend/control_center.py (all admin APIs under /api/control, mounted in server.py), frontend/src/control/{theme,ui,Shell,ControlContext}, frontend/app/control/* 
- QA: iteration_21 — backend 25/26, frontend 100%; test creds in memory/test_credentials.md (qa-admin@intro.control)
- Phase 2 backlog: Connections, Chats moderation, Radar heatmaps, Notifications composer, Analytics, Feature Flags, App Config, Emergency Controls, System Health detail. Phase 3: Marketing, Subscriptions/Payments (provider-agnostic + webhook scaffolding + Payment Integration Settings page), Content Mgmt, Categories, DB Viewer, AI Insights (provider-agnostic via Emergent LLM key), Backups, Exports, Scheduled Jobs, Act-As-User impersonation, 2FA readiness
- Known nits: add testIDs to /control screens for automation; cosmetic expo-router REPLACE warning on login redirect

## INTRO Control Centre — Phase 2 (June 2026) — DONE
- Connections viewer (pending/accepted/rejected/expired tabs, counts, active matches KPI)
- Chats moderation: read-only conversation list from matches; message views audited (chat_viewed); messaging not launched yet (db.messages empty by design)
- People Radar + Professional Radar insight pages (shared src/control/RadarPanel.tsx): stats, by vibe/category, most active areas, sample lists
- Notifications composer: audience targeting (everyone/professionals/people_mode/professional_mode/city/category), scheduling (lazy dispatch on reads), delivery history; push MOCKED — delivered as in-app db.notifications (type announcement, campaign_id); campaigns in db.admin_notifications
- Analytics: DAU/WAU/MAU, 5 daily series, 4-stage conversion funnel, weekly retention cohorts, popular categories/locations; session length not tracked (shown honestly)
- Feature Flags (13 flags, db.feature_flags) with REAL server-side enforcement via feature_gate() in server.py: registration, help_requests creation, connect/request are gated; maintenance_mode 503s all gated endpoints with configurable message; maintenance_mode + registration flag changes require reauth (428)
- Emergency Controls page: 7 one-click kill switches with confirmation + reauth; Settings page: 8 app-config values (db.app_config, super admin only, audited); System Health: latency, disk, memory, collection counts, background jobs, notification queue, failed admin logins
- Backend: /app/backend/control_phase2.py (router included in server.py); ROLE_PERMS extended per role
- QA iteration_22: backend 23/23, frontend 100% (flags restored to defaults after tests); fixed Td text-node warning
- Remaining Phase 3: Marketing, Content Mgmt, Categories, Subscriptions/Payments (provider-agnostic infra + webhook scaffolding + integration settings page, DEMO-only seeded finance data), DB Viewer, AI Insights (provider-agnostic, Emergent LLM key), Backups, Exports (CSV/Excel/PDF), Scheduled Jobs page, Act-As-User impersonation, 2FA readiness

## INTRO Control Centre — Phase 3 (June 2026) — DONE (iteration_23: backend 31/31, frontend 100%)
- Marketing: banners, promo codes, referral campaigns (db.marketing_banners/promo_codes/referral_campaigns), featured professionals/help requests, all audited
- Content Management: 5 editable pages (guidelines/privacy/terms/faq/support) in db.content_pages
- Categories: built-in help categories + professions w/ usage counts (lazy import PRO_CATEGORIES from server), custom categories staged in db.custom_categories
- Subscriptions & Payments: provider-agnostic integration-ready infra. LIVE = "not configured" (null KPIs, no records, refunds 400-blocked). DEMO = seeded is_demo_data records (db.demo_subscriptions/demo_payments) + working demo refunds. Payment Integration Settings page; webhook scaffold POST /api/webhooks/payments (logs+ignores → db.payment_webhook_events). Plans: free/intro_plus/intro_professional. No card data ever stored.
- Database Viewer: super admin, read-only, whitelisted collections, hashed_password/file_base64 redacted, every view audited
- AI Insights: provider-agnostic (db.ai_settings provider/model, PUT super admin), Emergent LLM key (gpt-5.4 via emergentintegrations LlmChat streaming), 13 report types, history (db.ai_reports w/ metrics_snapshot), PDF/CSV export (reportlab/csv), disclaimer, graceful "AI Not Configured" state
- Backups: mongodump to /app/backups, log download, restore via mongorestore --drop (super admin + reauth 428)
- Exports: users/professionals/reports/analytics/revenue/subscriptions in CSV/XLSX(openpyxl)/PDF(reportlab), audited; revenue/subscriptions in LIVE export "not configured" rows
- Act-As-User: super admin + reauth, 30-min impersonation JWT (imp claim), audit + db.impersonation_logs, account deletion blocked during impersonation (server.py get_current_user attaches _impersonated_by; delete_account 403s), red "Impersonating User" modal in user detail
- New deps: openpyxl, reportlab (requirements.txt updated); EMERGENT_LLM_KEY in backend/.env
- Files: backend/control_phase3.py; frontend/app/control/{marketing,content-management,categories,subscriptions,payments,ai-insights,database-viewer,backups,exports}.tsx; download() helper in ControlContext
- ALL 3 PHASES COMPLETE. Control Centre is the master operating portal. Remaining nits: cosmetic REPLACE navigator warning, testIDs for automation. Future: scheduled AI reports automation, 2FA for admins, real payment provider hookup, real push via Firebase.

## UI/UX Design System Audit (June 2026) — DONE (iteration_24: regression-clean, 0 new console errors)
No logic/branding changes — pure consistency polish across the mobile app.
- theme.ts extended: avatarSize (xs32-xl96), controlHeight (buttonLg56/button52/input52/compact44/chip36), touchTarget 44, cardPadding, anim (fast150/base250/slow400/pulse1500), font.micro=10/font.label=11, type.micro, radius.sheet=22
- 8pt-grid sweep: eliminated all off-grid paddings/margins (3→4, 5→4, 7→8, 10→12) across ~20 files; icon-text gaps unified to 6 (dominant convention, 48 prior uses)
- Standardized: bottom sheet radius 22 everywhere (PingModal was 28), sheet handles 40x4, photo tile radius 14, min fonts raised (7/8→9, metrics 9→10), touch targets 40→44 (ProfessionalHome search, profile demo buttons)
- Components migrated to tokens: PrimaryButton, FormField, SegmentedControl, PillChip, Avatar (default avatarSize.md, transition anim.fast), RadarView (anim.pulse), PingModal, VibePill, PhotoGrid, MeetupMap, ModeSelector
- Control Centre untouched (has its own CC token system)
- Pre-existing (not from audit, left as-is): TS type warnings in nearby.tsx/privacy.tsx/PingModal, RN-Web shadow* deprecation warnings on PrimaryButton/AppCard (optional boxShadow migration)

## Targeted UI Layout Correction (June 2026) — DONE
- NEW src/components/HorizontalCategoryChipList.tsx: shared FlatList-based horizontal chip row (natural-width chips, flexShrink 0, 12px ItemSeparator, spacing.xl edge padding, hidden indicator, stable keys, viewability-aware gentle scroll-into-view only when selected chip is partly off-screen, optional renderChip)
- ModeSelector.tsx rewritten to use it (Social/Networking/Campus/Events/Fitness — was ScrollView+gap); ProfessionalHome both filter rows migrated (renderChip=PillChip); chipsRow style removed
- RadarView rightControls: removed marginTop:-66 hack → top:0/bottom:0/justifyContent center (no negative margins)
- (tabs)/index.tsx: vibeSelector + visChip equal minHeight 36 (aligned vertical centres), statBox +paddingHorizontal
- NEW src/components/DemoEnvironmentCard.tsx: compact demo settings card (badge+info header, one-line desc, 3 identical 48px full-width left-aligned action rows, Exit orange accent, ≥700px → 3 equal columns); profile.tsx inline demo card + 5 orphan styles removed; card margins now match settings card/Log Out (marginHorizontal spacing.xl)
- All testIDs preserved (mode-*, demo-env-card, demo-reset-btn, demo-switch-persona, demo-exit-btn, filter-*). Zero logic changes. Verified via screenshots (390px): people radar, category switch (no jumps/gaps), professional radar, profile demo card.

## Professional Mode Redesign — Consent-Based Connection Flow (June 2026) ✅
- Radar: category chips removed → Radius + Filters controls (People-radar style); shared RadiusSheet component now used by both radars.
- ProfessionalFilterSheet: available now, verified only, multi-category, min rating, sort (nearest/rating/response), Clear All/Apply, count badge; persists in Professional Mode only.
- Map markers: availability dot (green/amber/grey), verification check, Top Rated purple badge; ProfessionalPreviewSheet (rating, specialties, bio, Connect + View Full Profile — no direct chat).
- Flow: structured request (/professional/connect/[userId], category + ≤300-char message) → professional accepts in Requests tab → Session created → messaging unlocks (/professional/session/[id]) → complete → review (stars/text/recommend, requester-only, once).
- Mode-aware bottom nav: Professional = Radar/Nearby/Requests/Sessions/Profile with unread badges; People = unchanged Pings/Encounters.
- Backend: /app/backend/professional_flow.py (db.pro_requests/pro_sessions/pro_messages/pro_reviews), rate limits (5 pending/10 per hr), real rating aggregation (top_rated = ≥4.5 & ≥5 reviews), demo-only seeded reviews & sessions.
- Tests: /app/backend/tests/test_iter25_professional_flow.py (26/26), /app/test_reports/iteration_25.json. No booking/payments (not implemented — deliberately omitted).

## INTRO → IntroYu Rebrand (June 2026) ✅
- Brand refresh only, zero UI/flow changes. All user-facing "INTRO/Intro" → "IntroYu" across frontend (app/, src/), backend (server.py, control_*.py, professional_flow.py), plans (IntroYu Plus/Pro), verified badges, Control Centre, notifications, maintenance copy, invite link (introyu.app), export filenames.
- Two-tone wordmark: "Intro" navy + "Yu" teal (Logo.tsx, onboarding, loading screen). Tagline: "Real people. Real moments. Right nearby." (onboarding, loading, API root).
- Assets regenerated from the radar mark (/tmp/gen_brand.py): icon.png (mark only, white), adaptive-icon.png (white bg), favicon, splash-image.png (mark + wordmark + tagline, white). app.json: name=IntroYu, splash/adaptive bg #FFFFFF; web <title>IntroYu</title> (app/+html.tsx).
- Unchanged intentionally: slug/scheme/bundle id (com.introapp.mobile), demo emails (@intro.demo), passwords (Intro123!), DB field verified_by_intro, reviewer id "intro-admin".
- KNOWN GOTCHA: parallel search_replace calls on the SAME file can clobber each other — do same-file edits sequentially.

## IntroYu → IntroU rename (June 2026) ✅
- All "IntroYu"→"IntroU", "introyu"→"introu" across frontend/backend/app.json/+html title. Wordmark split "Intro"+"U" with brand hexes exported from Logo.tsx (BRAND_NAVY #081A35, BRAND_TEAL #16B6B0) used in Logo, onboarding, loading screen. Splash asset regenerated (/tmp script gone; see /tmp/gen_splash_introu.py pattern). App icon/mark unchanged.

## IntroU → Orrbbit rebrand + Forgot Password (June 2026) ✅
- All branding now "Orrbbit" (exact spelling): app copy, header, app.json name, web title, invite link (orrbbit.app), export filenames (orrbbit-*), backend copy. Tagline unchanged.
- Approved orbit logo (user-uploaded PNG) used everywhere: /app/frontend/assets/images/logo.png (transparent, used by LogoMark via expo-image), icon.png, adaptive-icon.png, favicon.png, splash-image.png (logo + navy "Orrbbit" + tagline, white bg). Logo.tsx no longer uses SVG.
- Password reset: /app/backend/password_reset.py — POST /api/auth/forgot-password (6-digit code emailed via Emergent-managed Resend, EMERGENT_EMAIL_KEY + EMAIL_FROM_NAME=Orrbbit in backend/.env, no enumeration, 3 req/hr, 15-min expiry, hashed codes) + POST /api/auth/reset-password (5 attempts max). Frontend: /(auth)/forgot-password 3-step screen; "Forgot your password?" link on login. E2E verified with delivered@resend.dev (email sent, reset worked, old password rejected). Demo accounts silently skip email.

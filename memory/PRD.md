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

## Design System Refinement (June 2026) ✅
- Poppins global: 4 TTFs in /app/frontend/assets/fonts, loaded via expo-font in _layout; /app/frontend/src/lib/global-font.ts patches Text.render by injecting fontFamily into PROPS before original render (fontWeight→family map: 700+Bold/600SemiBold/500Medium/else Regular). CRITICAL LESSON: never cloneElement the OUTPUT of Text.render with array styles — crashes RN-web (CSSStyleDeclaration indexed setter). Explicit fontFamily styles (icon fonts) untouched.
- Professional nearby sheet redesigned: "Nearby Professionals" + live counter, instant quick-filter chips (Online/Available Now/Verified/Top Rated + 8 category chips w/ icons), horizontal snap carousel (ProCarouselCard: CARD_WIDTH 210, spring press scale, status dot, badges, Connect). Old vertical list removed. Preview sheet + connect flow reused.
- Verified: quick filters live-update count (13→9 online), previously crashed routes (/pings /encounters /profile) healthy, computed font = Poppins-Bold on web, zero console errors.

## Wordmark logo + Quicksand font (June 2026) ✅
- User-uploaded "Orrbbit" wordmark (navy, teal dot on i) saved as /app/frontend/assets/images/wordmark.png (transparent, 490x110). Logo component now renders the wordmark image (Wordmark export, ratio 4.45). LogoMark = orbit icon still used on onboarding/loading/forgot screens + app icon.
- Global font switched Poppins → Quicksand (4 static TTFs in assets/fonts from gstatic) matching the wordmark's rounded style; same weight-mapping patch in global-font.ts. Splash regenerated: orbit icon + wordmark image + tagline.

## Iteration 25 Regression Re-Verification (June 2026) ✅
- Re-tested via testing_agent (iteration_26.json): both critical regressions from iteration_25 CONFIRMED FIXED — 0 CSSStyleDeclaration errors on all routes (/pings, /encounters, /profile, /nearby, /, /person/*, /forgot-password, Professional Requests/Sessions views); Quicksand computed fontFamily verified on web (Bold/SemiBold/Regular per weight).
- Full Professional flow re-verified: Explore Demo → Professional → I Need Help → sheet expand → nearby-count + qf-* chips (counter reactivity 13→9→7→1) → pro-carousel → PreviewSheet → connect form. BrandHeader visible on all 5 tabs. Forgot-password nav clean.
- ROUTE MAP NOTE: /requests and /sessions are NOT top-level routes — they are the /pings and /encounters tabs relabelled when appMode=professional ((tabs)/_layout.tsx). Bare URLs 404 correctly; do not treat as a bug.
- Optional backlog: ProfessionalHome.tsx is 728 lines (advisory limit 700) — extract CanHelp branch + QuickChip/MapSheet helpers when convenient.

## BrandHeader revert + radar lockup (June 2026) ✅
- User reverted "logo on every page": BrandHeader.tsx deleted, all injections removed (pings/profile/encounters/nearby/RequestsScreen/SessionsScreen/person/pro-profile restored to pre-BrandHeader state via git checkout of commit 2a33338~1).
- Radar page ((tabs)/index.tsx) header now shows full brand lockup: orbit LogoMark + Orrbbit wordmark side by side (Logo.tsx default export updated), matching original INTRO-era header layout (icon + name + DEMO badge + settings gear).

## Custom Resend secrets (June 2026) ✅
- backend/.env now has user-provided: RESEND_API_KEY, FROM_EMAIL=hello@orrbbit.com, FROM_NAME=ORRBBIT, APP_URL=https://orrbbit.com, SUPPORT_EMAIL=support@orrbbit.com.
- password_reset.py switched from Emergent email proxy to direct Resend API (https://api.resend.com/emails, Bearer key, from "ORRBBIT <hello@orrbbit.com>"); email footer now includes SUPPORT_EMAIL + APP_URL links.
- API key verified valid, BUT Resend returns 403: "orrbbit.com domain is not verified" — user must add/verify DNS records at https://resend.com/domains before reset emails deliver. Endpoint still returns generic ok (no enumeration) and logs the failure.
- Legacy EMERGENT_EMAIL_KEY/EMAIL_FROM_NAME left in .env but no longer referenced in code.

## Production Transactional Email System (June 2026) ✅
- Central registry /app/backend/email_templates.py: 56 templates (33 mandatory / 23 optional / 7 engagement disabled-by-default), one responsive branded layout (navy headings, teal CTA, orange accent, preheader, plain-text version, Privacy/Terms/support footer, unsubscribe+prefs links on optional emails). CTAs = APP_URL + validated same-origin path (no open redirects).
- EmailService /app/backend/email_service.py: Resend delivery (reply-to SUPPORT_EMAIL, 3 retries w/ backoff on 5xx/429/transport), idempotency keys, per-template cooldowns (counts failed sends too), 10/hr rate limit on optional mail, user prefs, suppression list, db.email_events logging (resend_id, failure_reason, redacted ctx — never codes/tokens). Demo accounts (@intro.demo/is_demo/@example.com) never emailed. fire() = non-blocking trigger helper.
- Signed JWT tokens: unsubscribe (90d, per-category) + email verification (7d). GET /api/email/unsubscribe & /api/email/verify render branded HTML pages. PUBLIC_BASE_URL env (preview URL) used for these links until orrbbit.com points at deployment.
- Preferences: users.email_prefs {connections✔,session_reminders✔,professional_activity✔,weekly_summaries✘,product_updates✘,marketing✘}; GET/PUT /api/users/me/email-preferences; POST /api/email/resend-verification. Frontend /email-preferences screen + Profile menu row (menu-email-prefs).
- Triggers wired: register→verify_email+welcome; login→new_device_login (device hash db.known_devices)+suspicious_login (5+ fails/15min, db.login_failures); password reset→password_reset (migrated into EmailService, flow preserved)+password_changed; delete account→account_deletion_completed; reports→report_received/report_outcome/guidelines_warning/account_restricted/account_suspended (both /api/admin and control centre paths, +account_restored on unsuspend); verification submit/decisions→pro_application_received/pro_approved/pro_declined/pro_more_info/pro_restricted/pro_restored/credential_expired; pro flow→help_request_received/help_request_accepted/session_completed/leave_review/review_received/request_cancelled; feedback→feedback_received (60min cooldown). Declined requests intentionally send NO email (in-app only).
- Scheduler /app/backend/email_scheduler.py (asyncio, 300s): unread-message fallback (>=30min unread, batched per conversation, max 1/session/day), unread-request reminder (pending>24h, once), session reminders 24h/1h (fires when pro_sessions.scheduled_at exists — future-proof), credential expiring(<=30d)/expired. All idempotent.
- Admin tools /api/control/email/* (/app/backend/control_email.py, perm "emails" for operations/support/marketing + super_admin): templates list/preview/test-send/enable-toggle (mandatory can't be disabled), events search (user/email/status/template), stats, retry failed (security templates non-retryable), suppressions list/remove. Frontend /control/emails page (Templates/Events/Failures&Bounces tabs, iframe HTML preview + send-test) + Shell nav item.
- Resend webhook POST /api/webhooks/resend: delivered/bounced/complained → delivery status updates + suppression (2 bounces or 1 complaint). Optional svix signature verification via RESEND_WEBHOOK_SECRET env (enforced when set).
- Dormant templates (registered, no trigger yet — by design): email change, account_deletion_requested, booking_confirmed/rescheduled, missed_session, appeal_received/outcome, support_reply/resolved, privacy_security_notice, engagement set.
- TESTED: iteration_26.json — backend 25/25 pass, frontend 100% (prefs screen + all 3 admin tabs). Tests: /app/backend/tests/test_iter26_email_system.py.
- ⚠️ BLOCKER FOR DELIVERY: orrbbit.com still unverified in Resend → all sends fail HTTP 403 (events logged as failed). User must verify DNS at resend.com/domains; system works automatically after.

## Live Resend Production Verification (June 2026) ✅
- ROOT CAUSE of persistent 403: verified Resend domain is the SUBDOMAIN updates.orrbbit.com (apex orrbbit.com NOT verified in workspace). Config fix: FROM_EMAIL=hello@updates.orrbbit.com in backend/.env. Sender = "ORRBBIT <hello@updates.orrbbit.com>", reply-to support@orrbbit.com, APP_URL unchanged (https://orrbbit.com).
- LIVE VERIFIED (owner inbox k97davies@icloud.com): welcome (test + signup, exactly 1 from signup), verify_email (+ link completes → email_verified), password_reset (+ full reset), password_changed, unsubscribe link (marketing pref flipped), pro_approved, help_request_received, booking_confirmed — ALL Resend last_event=delivered. Owner app account created: k97davies@icloud.com / OwnerLive2026#2 (in test_credentials.md).
- email_scheduler.run_cycle now takes a Mongo lease (config key email_scheduler_lease) → no duplicate cycles across multiple backend instances; idempotency keys remain second safety layer.
- testing_agent iteration_27.json: 7/7 pass, 403 gone, scheduler healthy, 56 templates, demo accounts still email-free.
- PUBLIC_BASE_URL=preview URL locally; user must set PUBLIC_BASE_URL as a deployment secret (production backend origin) when publishing. If user later verifies apex orrbbit.com in Resend, FROM_EMAIL can revert to hello@orrbbit.com.

## Email sender change + official logo in shared layout (June 2026) ✅
- FROM_EMAIL=notifications@updates.orrbbit.com (env-only, no hardcoding). Live sender: "ORRBBIT <notifications@updates.orrbbit.com>", reply-to support@orrbbit.com. Domain unchanged (updates.orrbbit.com).
- Official uploaded logo (teal orbit + orange centre + navy wordmark) saved as permanent asset /app/backend/static/email-assets/orrbbit-logo.png (420px retina, 49KB), served at GET /api/email-assets/{file} (immutable cache, traversal-safe). URL built from PUBLIC_BASE_URL, override via EMAIL_LOGO_URL env (preferred later: https://orrbbit.com/email-assets/orrbbit-logo.png).
- render_layout() header: text wordmark replaced by <img> (max-width 210px, alt="ORRBBIT", links to APP_URL, block, left-aligned) — all 56 templates inherit. Plain-text header now "ORRBBIT".
- LIVE VERIFIED to owner inbox: verify_email, welcome, password_reset, pro_approved, help_request_received, booking_confirmed — all delivered, new sender, logo present, no dup wordmark, no localhost/preview leaks beyond PUBLIC_BASE_URL asset link. testing_agent iteration_28: 19/19 pass incl. path traversal + API key non-exposure.
- Note: preview-domain ingress strips the immutable Cache-Control on assets (origin header correct); confirm on production ingress.

## Full E2E Functional Audit (June 2026) ✅
- Restore point: git c55d901 + mongodump /app/memory/audit/db_backup. Inventory (92 screens, 163 routes, 233 buttons): /app/memory/audit/INVENTORY.md. Full report: /app/memory/audit/FINAL_AUDIT_REPORT.md.
- 3 testing rounds (iterations 29 backend 54/56, 30 frontend ~97%, 31 regression 6/6). ~175 tests executed. 10 defects found (0 crit/high, 2 med, 8 low); 9 FIXED: register min 8-char password (backend Field + frontend msg/placeholder/regex email validation), PhotoIn→photo_url, banned-words extended, ping dismiss 404, control login testIDs + IN→OR brand mark, tab testIDs (tabBarButtonTestID), pings days-ago formatting. 1 DEFERRED: DEF-6 console REPLACE warning (cosmetic).
- Verdict: READY FOR INTERNAL DEVICE TESTING. Pre-store checklist: device GPS/permissions field test, push build, host orrbbit.com/privacy + /terms, PUBLIC_BASE_URL secret, remove qa-admin, verify Test Mode gate.

## Internal Device-Testing Preparation (June 2026) ✅
- Restore point commit a65403e + prior mongodump. testing_agent iteration_32: backend 10/10 + frontend 5/5 pass.
- DEF-6 classification: "The action REPLACE with payload {name:index} was not handled" — React Navigation DEV-ONLY console warning (stripped in production builds), no functional/perf impact; emitted during post-login replace to /(tabs) and /control redirects; DOCUMENTED, not fixed (nav-timing change = higher risk than value).
- Scheduled bookings classification: PARTIALLY IMPLEMENTED + OPTIONAL for current chat-first flow. Implemented: cancel, completion, review, reminder scheduler (fires when pro_sessions.scheduled_at exists). NOT implemented: date/time picker UI, timezone storage, booking confirm/reschedule entities, no-show status (template dormant).
- Test Mode hardened: 7-tap version → QA code modal, server-verified POST /api/test-mode/unlock vs TEST_MODE_CODE (backend/.env; value in test_credentials.md). Alert copy fixed to point at Disable row.
- qa-admin password ROTATED (old QaControl!2026x dead; new in test_credentials.md only).
- NEW /diagnostics screen (Profile → Test Mode menu → Device Diagnostics): gated __DEV__||testMode else locked state; shows version/build profile/backend latency/location+photo permissions/GPS accuracy/movement/deep-link base/push status; security-scanned clean (no keys/tokens).
- eas.json created: development/preview(internal APK)/production profiles with EXPO_PUBLIC_BUILD_PROFILE env. Builds themselves happen via Emergent Publish button (BLOCKED on owner action; iOS additionally needs Apple developer account).
- Identifiers (unchanged per instruction): name Orrbbit, slug frontend, version 1.0.0, scheme frontend, iOS bundle com.introapp.mobile, Android package com.introapp.mobile, SDK 54, no EAS projectId/owner set (assigned at publish). NOTE for owner: bundle/package still carry legacy "introapp" — changing is forbidden in this task and risky after store submission; decide BEFORE first store upload.
- Owner checklist: /app/memory/audit/DEVICE_TEST_CHECKLIST.md (82 rows, pass/fail/blocked + evidence fields).
- Environments: this workspace = dev/preview (preview URL + local Mongo test_database, Test Mode available). Production = separate deployment created by Publish (own URL/DB; secrets incl. PUBLIC_BASE_URL/TEST_MODE_CODE must be set as deployment secrets). Frontend .env contains only the backend URL — no secrets in bundle.

## Production URL cutover for email links (June 2026) ✅
- Production is LIVE at https://nearby-connect-93.emergent.host (backend /api 200, logo asset 200, verify/unsubscribe endpoints branded pages).
- Secrets in backend/.env: PUBLIC_BASE_URL=https://nearby-connect-93.emergent.host, EMAIL_LOGO_URL=<prod>/api/email-assets/orrbbit-logo.png, APP_URL=https://orrbbit.com (Privacy/Terms/website links only).
- ROOT CAUSE FIX: platform injects APP_URL=preview-host into process env, beating .env (load_dotenv no-override). email_templates.env_cfg() now prefers .env FILE values (dotenv_values) for APP_URL/SUPPORT_EMAIL/PUBLIC_BASE_URL/EMAIL_LOGO_URL/FROM_NAME/FROM_EMAIL/RESEND_API_KEY. CRITICAL: never rely on os.environ alone for these keys.
- Fallback line in email layout: raw URL replaced with clickable "Open this securely in your browser." (points at the CTA URL; absent when no CTA e.g. password_reset). prefs_url now PUBLIC_BASE_URL/email-preferences.
- LIVE TESTED (owner inbox): verify_email, password_reset, booking_confirmed, help_request_received — no preview/localhost URLs, prod logo, sender ORRBBIT <notifications@updates.orrbbit.com>, reply-to support@orrbbit.com; verify + unsubscribe button clicks work. testing_agent iteration_33: 13/13 pass.
- ⚠️ OWNER ACTION: production still runs pre-cutover code — must REDEPLOY (Publish, free) so production itself sends the corrected emails. Note: cross-env tokens (preview-signed links opened on prod) show the branded "link expired" page because prod has its own DB — expected.

## Native identifier migration + final official logo (June 2026) ✅
- Restore point 07def01 + db_backup_logo mongodump. testing_agent iteration_34: backend 22/22 + frontend all pass.
- IDENTIFIERS: name "ORRBBIT", scheme frontend→orrbbit (orrbbit:// deep links), iOS bundle + Android package com.introapp.mobile→com.orrbbit.mobile. Slug "frontend" INTENTIONALLY unchanged (protected Expo project identity). All future Firebase/Apple/Google service config must use com.orrbbit.mobile.
- FINAL LOGO (transparent master, alpha preserved): regenerated icon.png (1024 opaque, symbol only), adaptive-icon(.png/-bg.png), splash-image.png (symbol+wordmark), notification-icon.png (96 white silhouette + color #16B6B0 in app.json), favicon 32 + web-icon-192/512, logo.png (symbol) + wordmark.png (in-app Logo components inherit; WORDMARK_RATIO=1024/240), orrbbit-logo-full.png. Deleted unreferenced react-logo*/app-image.png.
- EMAIL LOGO cache-busted: static/email-assets/orrbbit-logo-v2.png; EMAIL_LOGO_URL=<prod>/api/email-assets/orrbbit-logo-v2.png (prod 404s on -v2 until owner REDEPLOYS — the redeploy is the activation step).
- INTRO purge: EVENT_CODES INTRO100→ORB100 (server.py + join-event.tsx); diagnostics scheme fallback. Remaining legacy DATA keys kept deliberately: @intro.demo/@intro.control emails, verified_by_intro field, intro_* AsyncStorage keys (not user-facing; renaming would break data).
- ⚠️ OWNER: REDEPLOY required to activate identifiers/assets/email logo in production; native icon/splash verification needs a real build.

## Signup, Legal Consent & Safety Access Update (August 2026) — COMPLETE
- 4-step signup (app/(auth)/register.tsx): Account → Age (DOB, 18+ gate) → Policies (required consent + optional marketing, both unticked) → Complete ("Welcome to Orrbbit" + verify-email prompt). Progress labels Account/Age/Policies/Complete. Exact spec copy incl. underage message. Continue → /location-privacy?next=setup (existing onboarding chain preserved).
- Backend age gate authoritative: register requires date_of_birth (YYYY-MM-DD) + accept_policies; underage → 403 exact message, no account; missing consent → 400. Legacy `age` int contract removed (old pytest files use legacy contract).
- Durable versioned consent: db.consent_records (APPEND-ONLY, retained after deletion & policy changes). Signup record: dob, age_gate_passed, terms/community/privacy versions+timestamps, marketing opt-in/withdrawal, platform/app_version/locale/method. Marketing withdrawal recorded via email-preferences PUT hook.
- Policy registry: backend/legal_consent.py (bind pattern) — env-overridable LEGAL_SITE_BASE/POLICY_VERSION/POLICY_EFFECTIVE_DATE/POLICY_STATUS. GET /api/policies (14 docs, www.orrbbit.com, v1.0 effective 2026-08-04, status effective — verified live, no draft labels).
- New endpoints: GET /users/me/consents, POST /consents/acknowledge (professional_disclaimer | credential_upload_notice | location_notice), GET /users/me/acknowledgements, GET /users/me/data-export (photos omitted for size), GET /blocks, DELETE /blocks/{user_id}.
- Account deletion hardened: DELETE /users/me requires {password, confirmation:"DELETE"}; wrong pwd 401; consent records retained; token invalidated.
- New screens: /legal-safety (14 policy links + Safety Tips + version footer), /account-data (data download, prefs, blocked users, delete w/ password modal), /blocked-users. Profile menu: Account & Data + Legal & Safety rows; old one-tap delete removed (routes to Account & Data).
- Contextual notices: location pre-permission alert (AppContext, native only, once), ProfessionalDisclaimerModal (first Professional Mode use, server-persisted ack), credential-upload notice in professional/verification.tsx before picker.
- Analytics (no PII): signup_step_*, signup_age_gate_failed(+_client), signup_consent_accepted, account_delete(_requested/deleted), notice_ack_*.
- src/lib/legalLinks.ts central link registry. Payments notice NOT implemented (payments disabled).
- Tested: iteration_35 — backend 21/21 pytest (test_iter34_signup_consent.py), frontend flows pass. Real-device GPS/camera/push/accessibility PENDING (not physically tested).

## Demo Experience + Profile-Photo Fix (August 2026) — COMPLETE
- ROOT CAUSE photo bug: frontend sent {photo}, backend PhotoIn requires {photo_url} → 422 on every upload. Fixed in userService.addPhoto.
- Photo pipeline: expo-image-manipulator normalisation (HEIC/HEIF→JPEG, orientation, EXIF/GPS stripped, <=1600px, q0.82, base64 data URI, never raw file/content URIs), duplicate-tap prevention, remove-confirmation, circular avatar-crop preview. Backend _validate_photo_url: only data:image jpeg/png (magic bytes, <=5MB), https://, /api/ paths; rejects file://, gif, non-images. PUT /users/me photos also validated.
- 36 unique AI-generated fictional demo portraits (Gemini Nano Banana) at backend/static/demo-assets, served /api/demo-assets/{id}.jpg (cache 7d). Manifest: /app/memory/demo_assets_manifest.json (source/rights/inspection). Stock randomuser/picsum stripped from ALL demo users (secondary → initials). onboarding hero now bundled generated asset (unsplash removed); 'Use sample photos' feature removed; invite link → www.orrbbit.com.
- backend/demo_mode.py (bind): flags demo_mode_enabled/store_screenshot_mode (db.app_config + env defaults DEMO_MODE_ENABLED/STORE_SCREENSHOT_MODE_ENABLED); GET /api/demo-mode/status; admin GET/PUT /api/control/demo-mode + POST seed/reset/remove/manifest (control-centre auth, audit-logged); Control Centre UI /control/demo-mode. Seed idempotent; remove deletes ONLY demo data.
- Isolation: cross_realm_hidden in compute_nearby (demo never sees real; real sees demo only when enabled), ensure_same_realm 403 in _validate_connect_target, emails already skip demo, analytics tagged demo:true, screenshot mode suppresses ping popups.
- Avatar consistency: src/lib/photo.ts resolvePhotoUri (env-agnostic /api/ paths + stable version cache key) used by Avatar, PhotoGrid, person/[id], control screens, RadarPanel.
- Moderation example: marco@radar.intro.demo photo removed + notification + moderationActions demo_example (idempotent).
- Tested: iteration_36 — 23/23 backend pytest + frontend all pass, 0 bugs. Real-device iOS/Android PENDING.

## Three-Tier Radius Subscription System (August 2026) — COMPLETE (billing not configured)
- Plans: Free (max 250m, options 100/250) / Plus $6.99/mo (max 500m, +500) / Pro $11.99/mo (max 1km, +750/1000). One entitlement covers both People + Professional modes.
- backend/billing.py (bind): BILLING_MODE env (disabled|sandbox|native, current sandbox); db.entitlements records (plan/status/product_id/platform/sandbox/original_transaction_id SANDBOX-*, purchase/renewal/expiration, auto_renew/cancellation/grace/retry/last_verified). Endpoints: GET /billing/config, GET /users/me/subscription, POST /billing/sandbox/{purchase|cancel|expire}, POST /billing/restore, POST /billing/verify (501 until native), admin GET /control/billing + POST /control/billing/demo-entitlement (demo only). Sandbox gated server-side: is_demo OR TEST_MODE_CODE; real users 403 'Subscriptions are coming soon'; no purchase emails; success msgs per spec.
- Product IDs: iOS com.orrbbit.mobile.{plus|pro}.monthly, Android orrbbit_{plus|pro}_monthly; preview prices $6.99/$11.99 until store-localised pricing.
- server.py: PLAN_LIMITS 250/500/1000; register default radius 250; PUT state clamps radius server-side + rejects client paid-plan self-set (403); startup migration radius_tier_migration_v2 clamped over-entitlement radii + radius_migration_notice (one-time alert 'Your Radar is currently set to 250 m…', POST /users/me/radius-notice-seen clears).
- Frontend: /plans rebuilt per uploaded visual (badges Included/Most Popular/Best Reach, teal selected outline, Current plan tag, radius chip preview, CTA matrix Continue with Free/Upgrade to Plus|Pro/Current Plan/Manage Subscription/Coming Soon, purchase confirm modal w/ recurring statement + terms/privacy/refunds + Restore + sandbox TEST label); /subscription screen (Account & Data row); RadiusSheet 100/250/500/750/1km locks + paywall ('Expand your orbit…', preselects required plan, session-dismiss); privacy.tsx chips; copy audit (onboarding/how-location-works/location-privacy/plan-confirmed). Analytics: plan_screen_viewed, *_plan_selected, locked_radius_tapped, purchase_*, subscription_*, radius_changed, radius_paywall_dismissed.
- alert.ts web fallback now supports 3+ button alerts.
- Tested: iteration_37 — backend 15/15 pytest (test_iter37_billing_plans.py) + all 6 frontend flows pass. NATIVE BILLING NOT CONFIGURED: App Store Connect/Play Console products, billing SDK, receipt verification + device sandbox tests pending.

## Radius/Map Fix + Nearby Now Rebuild (August 2026) — COMPLETE
- ROOT CAUSES: (1) RadarView ringSet() capped at [125,250,375,500] for any radius >250 → outer ring stuck at 500m, user placement scaled to 500m even at 1km. (2) Backend compute_nearby had hard `dist > 500` cutoff + `/api/professionals` used raw user.radius without plan clamp → nobody beyond 500m ever returned.
- Fixes: ringSet supports 750 [250,500,750] and 1000 [250,500,750,1000]; outer ring labelled "1 km"; tile zoom 14 for >500m; compute_nearby cap = plan_max (250/500/1000), dist cutoff 1000; professionals radius = min(selected, plan max). Effective radius consistent across query/rings/labels/counts/stats.
- Demo distance band: demo_mode DISTANCE_SPREAD sets demo_dist 540-980m for priya/matilda/rory/sana/theo/oscar/hazel/jasper (startup + seed/reset). Counts now vary: people 23/58/62/66 and pros 3/9/13 at 250/500/750/1000.
- Nearby Now section rebuilt (index.tsx): heading → 5 overlapping avatars (2px surface border) + "+N more" (accessible label) → full-width teal single-line "See More Nearby" (52px, opens Nearby preserving mode/radius/filters) → spacing.xl gap → equal-width Change Vibe/Privacy.
- Tested: iteration_38 frontend 7/7 flows pass + iter37 pytest 15/15 regression. Physical iOS/Android map checks PENDING.

## People Mode Age Preference Filter (August 2026) — COMPLETE
- Free feature for all plans (Free/Plus/Pro) — never paywalled. People Mode only; Professional Mode has no age controls anywhere.
- Backend source of truth: `people_min_age` / `people_max_age` / `people_allow_age_expansion` / `relationship_age_prompt_seen` / `age_preference_updated_at` on the user; enforced in `compute_nearby` (Radar, Nearby and pings all share it). Config constants: AGE_PREF_MIN=18, AGE_PREF_MAX=65 (=65+, no upper bound), AGE_EXPANSION_YEARS=3, AGE_EXPANSION_TRIGGER=5, AGE_EXPANSION_MAX_EXTRA=3.
- Age calculated live from date_of_birth (UTC); under-18 profiles hard-blocked in discovery; full DOB never exposed by any API (audited).
- Default 18–65+ ("any adult"); expansion toggle default ON; out-of-range fallback profiles flagged `outside_age_preference` and shown with "A little outside your age preference" (Nearby rows, radar marker preview, person profile).
- UI: dual-handle AgeRangeSlider (accessible: adjustable role, increment/decrement, min/max announce), AGE section in Filters (/privacy) with Reset + Apply Filters footer; one-time "Who would you like to meet?" prompt on first Relationship vibe selection (Save preference / Not now).
- Existing users migrated silently to 18–65+/expansion-on at startup; demo users seeded with consistent DOBs and ages spanning 20–62.
- Analytics: age_filter_opened/applied/reset, age_range_changed, age_expansion_enabled/disabled, relationship_age_prompt_viewed/saved/skipped with sanitized props (DOB/lat/lng stripped server-side).
- Tests: backend 16/16 (tests/test_iter39_age_filter.py) + regressions green; testing agent frontend flows pass (iteration_39.json). Device (iOS/Android) validation pending.

## Approved Profile Experience Update (August 2026) — COMPLETE (iter40)
- Discoverability gate (People Mode): signup still allows 1 photo; FULL Radar/Nearby discoverability requires 3+ photos (max 6), 40+ char bio (max 500), verified email + existing 18+/consent/safety rules. Incomplete users stay functional and see "Complete your profile" (radar banner + owner-only completion card with %/progress/checklist). Demo realm exempt.
- Edit Profile: Photos (n/6) grid with add/replace/delete/reorder/make-main + below-3 warning; bio counter; About fields (Lives in=city/country, From=home_city manual only, Occupation, Education, Languages); up to 3 conversation prompts (10-prompt library, 180-char answers, add/edit/remove/reorder). Age is DOB-calculated — manual age editing removed (ProfileUpdate no longer accepts age).
- Full profile view: swipeable gallery (counter 1/N, dots, tap-to-expand modal, cached expo-image, broken-image fallback), ABOUT <NAME>, ABOUT rows card, INTERESTS, YOU BOTH LIKE (real intersections from both profiles), ABOUT ME prompt cards, Joined Orrbbit <Month Year>. Radar preview: compact interests line + "You both like X +N" only.
- Backend: fields home_city/occupation/education/languages/prompts (+city/country editable), all free text sanitised (_clean_text strips HTML, hard caps), nearby payload carries photos/about/prompts/mutual_interests/joined/photo_verified, display age calculated from DOB, completion endpoint rewritten (score/checklist/discoverable/missing). photo_verified field reserved (never displayed) for future Photo Verified. Professional: portfolio_photos (≤6, validated) on professional_profiles + public payload — credential documents remain private/separate.
- Demo: 10 core intro.demo accounts now have 3 same-person generated photos (20 new Nano Banana variant images in backend/static/demo-assets, script scripts/gen_demo_photo_variants.py), home_city/occupation/education/languages/prompts, email_verified. demo_mode.apply_demo_photos builds galleries automatically.
- Email: verify-email copy aligned to approved layout ("Verify your email" / "Thanks for joining Orrbbit…"); all transactional emails already share one layout with official logo (orrbbit-logo-v2.png live on production, retina v3 asset shipped for post-deploy). Sender/reply-to unchanged. Brand audit: no user-facing Intro/Orbit/Nearby Connect/Emergent branding found.
- Tests: 69/69 backend pytest (incl. new tests/test_iter40_profile.py); testing agent iteration_40 — all 6 frontend flows pass, 320x568 clean. Native device testing PENDING.

## Master Dashboard Orrbbit Branding (August 2026) — COMPLETE (iter41)
- Official logo (assets/images/logo.png) on login + sidebar (legacy "IN"/"OR" text marks removed). Login: white/light bg, subtle teal radar rings, "Orrbbit Master Dashboard" / "Authorised access only", teal Sign In.
- Tokens (src/control/theme.ts) aligned to official app palette: teal #20B2AA (+soft/dark), orange #FF5A1F (+soft/dark), navy #16294E; generic blue retired (CC.blue aliases to teal). Quicksand (CCF) applied to headings/brand/KPIs.
- Shell: light white sidebar, soft-teal rounded active nav pills + hover; env badges: LIVE · PRODUCTION (green outline) / DEMO (light teal), explicit text; profile menu shows email/role/environment; header-avatar testID added.
- UI kit: primary buttons teal (orange available as accent variant), filter chips teal-soft active, branded empty states with teal icon circle, status pills (active/verified teal, pending orange-soft, demo pill, expired amber).
- Overview: time-based greeting + "Here's what's happening across Orrbbit."; chart palette teal/navy/orange/subtle-teal.
- Users table: explicit DEMO pill on demo accounts. Subscriptions: Orrbbit Free/Plus/Pro with correct radii 250m/500m/1km; legacy intro_plus/intro_professional keys removed from control_phase3.py, demo billing reseeded to orrbbit_plus/orrbbit_pro; LIVE shows Not configured (no fake revenue).
- Tests: testing agent iteration_41 — all 8 flows pass (login, dashboard, mode switch, users, subscriptions, 5-page spot check, 900px responsive, search/signout regression). No production data touched.

## Iter42 — Photo Card, 2-Photo Minimum, Mode Isolation, Credential Annual Review (Aug 2026) — COMPLETE
- Full-profile primary photo: fitted rounded photo-card (inset, radius, cover crop, pager width fixed); circular avatars retained only for compact UI (radar markers, chat, lists).
- People discoverability minimum photos 3 → 2 everywhere (DISCOVERY_MIN_PHOTOS=2, all copy "Add at least 2 photos", PhotoGrid minRequired=2, delete-below-2 warning, onboarding, completion checklist, tests).
- Mode isolation fixed (user-reported bug): pings/generate returns null server-side when app_mode=professional; AppContext poller gated on appMode; activePing cleared on switch; PingModal never renders in Professional Mode. Verified 20/20 API calls + 50s UI watch + reload persistence.
- Credential lifecycle: 12-month annual review cycle + 24-month max validity + real-expiry precedence (_effective_expiry). Fields: credential_verified_at/last_reviewed_at/next_review_at/expiry_date/review_cycle_months/max_validity_months set on approve/renew; new admin action annual_review (both admin APIs); owner sees Reviewed/Next review/Expiry dates; verification notice adds annual-review + 2-year copy; approval email copy updated; annual_review_reminder emails (60/30/7d, idempotent) added to existing scheduler; admin queue tabs: Pending/Verified/Annual Review Due/Expiring Soon/Expired/More Info/Rejected + review_due filter + Complete Annual Review button.
- Admin logo clickable → /control overview (accessible).
- Tests: backend 36/36 (new tests/test_iter42_credentials_mode.py); testing agent iteration_42 — ALL 6 flows PASS, zero regressions.
- Deferred (next phase, low risk): admin Overview KPI tiles for reviews due/overdue; 7-day credential-expiry reminder tier (90/60/30 exist); richer demo credential-state labels.

## Iter43 — Mandatory Email Verification + Resend Branding (Aug 2026) — COMPLETE (Preview; awaiting owner redeploy + real-device QA)
- Hard server-side gate: enforce_email_verification middleware blocks ALL /api product endpoints with 403 EMAIL_VERIFICATION_REQUIRED for unverified non-demo accounts. Exempt allowlist: /auth, /email, /vibes, /legal, /policies, /content, /support, /control, /email-assets, /demo-assets, /analytics, /demo-accounts, /health, /users/me/email-preferences, DELETE /users/me (account deletion always allowed).
- Registration: email_verified:false explicit; branded verify email fire-and-forget; success screen routes to gate (old location-privacy bypass removed).
- Mobile gate (auth)/verify-email.tsx: shows email, Open Email, Resend (60s cooldown), I've verified (refreshUser → /auth/me), Wrong email? Change email, Log out. index.tsx redirects unverified→gate; login routes unverified→gate; demo accounts bypass.
- Resend abuse control: 5 requests/rolling hour per account via db.email_resend_attempts (endpoint-level counter — works even when delivery is skipped for demo/test emails); change-unverified shares the same cap; 429 after limit. Index added.
- Change email: dup-check 400, updates email + resends, never sets verified.
- Branded /api/email/verify HTML pages (success / expired / invalid); no stack traces or secrets leaked.
- Discovery exclusion at query level: People via is_discoverable (email item required); Professionals via _pro_public returning None for unverified non-demo owners.
- Admin: control users Email status column (Verified/Unverified badges), status filters verified_email/unverified_email; /control/email/stats verification_funnel {total_users, verified, unverified, verification_rate, verify_emails_sent, verified_last_7d} + KPI cards on Emails → Failures & Bounces. No tokens exposed.
- Email URLs: PUBLIC_BASE_URL / EMAIL_LOGO_URL / APP_URL env-driven (prod cutover test suite green, logo v2, orrbbit.com links, no preview/localhost leaks). NOTE: verification links resolve on the deployed backend host; pointing a custom domain (e.g. api.orrbbit.com) requires owner DNS action — env vars make it a config-only change.
- Test maintenance: tests/conftest.py verify_email fixture; stale suites revived (DOB/accept_policies contracts, rotated admin password, 58 templates, logo v2, delete reauth body, bootstrap-pw skip, reauth reset). 245 tests green: iter26/26b/27/30/32/33/34/36/37/39/40/42/43 + control_center + email_prod_cutover. Legacy pre-DOB suites (iter4-25, backend_test, new_features) remain stale/out of scope.
- Testing agent iteration_43: FULL PASS — backend 17/17, frontend 5/5 flows, admin verified. No bugs, no regressions.
- Verdict: EMAIL + VERIFICATION COMPLETE — REAL DEVICE QA REQUIRED (email open + orrbbit:// deep link on physical iOS/Android after owner redeploys Production).

## Iter44 — Save Vibe Details fix + full button/CTA audit (Aug 2026) — COMPLETE (Preview; user must redeploy)
- Root cause: substring banned-terms filter ("something" contains "meth", "begun" contains "gun") returned 400; frontend catch{} swallowed it silently. Fixed with word-boundary regex (contains_banned_terms) applied to vibe-details and help-request checks; real banned words still blocked.
- All user-initiated save/submit actions now show visible errors and allow retry (inline error on vibe-details, alerts elsewhere); photo reorder reverts on failure; intent no longer navigates on failure; RadiusSheet stays open on failure; api.ts safe JSON parse + friendly verification-gate message; done() canGoBack fallback.
- Audit result: ~40 empty catches reviewed — user-action silent failures fixed (13 handlers across 10 files); background polls/loads left silent by design; backdrop no-op onPress are intentional tap-eaters; PrimaryButton loading/disabled prevents duplicate submits; chat/pings/connect/verification-upload already had proper handling.
- Tests: tests/test_iter44_buttons.py 7/7; maintained regression 141 green; testing agent iteration_44 full pass, zero regressions.
- Pending: user redeploys to production, then real-device iOS check (keyboard open/closed) on vibe-details.

## Iter45 — Plus/Pro presentation live, payments disabled (Aug 2026) — COMPLETE (Preview; user must redeploy)
- No more "Coming Soon" button: all 3 plan cards selectable/launch-ready (Included / Most Popular / Best Reach), approved pricing kept (Free / $6.99 / $11.99), radius chips per plan (Free 250✓; Plus 250✓500✓ 750🔒1km🔒; Pro all ✓).
- Paid CTA "Choose Plus"/"Choose Pro" → branded "almost ready" sheet (Notify me / Not now). No fake checkout/success/receipt/subscription status.
- Notify me: privacy-safe POST /billing/interest (idempotent per user+plan, no email/marketing storage) + plus_interest/pro_interest analytics. Copy: "We'll let you know when subscriptions are available."
- Entitlement rules unchanged & backend-authoritative (250/500/1000m); public sandbox purchase 403 "Paid subscriptions aren't available yet"; radius clamp intact; demo/QA sandbox purchase modal isolated to is_demo users.
- Subscription page: current plan + Plan comparison rows with "Payments not yet enabled" on paid rows; rows deep-link to /plans.
- Verdict: PLAN EXPERIENCE ACTIVE — PAYMENTS NOT ENABLED. Testing agent iteration_45 all 8 flows pass.

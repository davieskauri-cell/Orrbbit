#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration 7 — Freemium Plans, Map UI, Clustering & Discovery Limits (frontend wiring)
main agent changes:
  - Wired /location-privacy and /plans into signup flow: register → /location-privacy?next=setup → /plans?next=setup → (auth)/intent → profile-setup → choose-vibe
  - Profile menu: added "Intro Plans" (/plans), "How Map Privacy Works" (/location-privacy), plan chip in profile card
  - Privacy screen: radius options now 10/25/50/100/250/500 with locked states (lock icon) based on user.max_radius; tapping locked shows upgrade Alert → "See plans" → /plans; "Unlock a bigger radius" link
  - Radar top bar redesigned: compact vibe selector pill (VibePill + chevron-down, routes /vibe) + visibility chip ("Visible · Xm left" / "Hidden", toggles visibility, testID visibility-toggle)
  - RadarView: dynamic ring sets & map tile zoom per radius (up to 500m), Filters button on map (testID radar-filters → /privacy), marker clustering (max 24 markers: 8 sectors × 3 bands, cluster bubbles show count, tap → nearby tab)
  - Nearby: cap note "Showing the 100 most relevant people nearby" when list hits 100 (backend already caps at 100)
needs_retesting: true (frontend focus; backend plan logic already verified in iteration 6/7 scripts)

## Iteration 8 — Final Product Update (spec completion)
main agent changes:
  Backend:
  - Plan change now applies plan DEFAULT radius (free→50, plus→100, pro→250) in PUT /users/me/state
  - high_density_demo flag (StateUpdate + public_user): when on, compute_nearby injects synthetic profiles up to 142 within radius (ids hd-*), still capped at 100
  Frontend:
  - Wording: removed all "max 100m" copy (onboarding badge now "Starts free within 50m", how-location-works card "Radius depends on your plan", privacy points "Bigger radius. Same privacy...", strings.ts, join-event, person/[id]); distLabel supports up to 500m
  - locationService.getApproximateDisplayLocation cap fixed 100→500 (Pro radii now display)
  - Radar: radius selector chip on map (testID radar-radius-chip) opens bottom-sheet Modal (radius-sheet-10..500) w/ lock tags + spec upgrade prompts ("Unlock 100m with Intro Plus"/"Unlock extended discovery with Intro Pro", Maybe later/Upgrade buttons); marker tap now opens preview card (testID marker-preview: name/age/vibe/intent/approx distance/View Profile/close); privacy pill + "Learn more"→/location-privacy; extended-radius note at >=250m; high-density card at 100+ ("Why limit?" alert); stats labels Nearby/Aligned/Radius; "See More Nearby" CTA (testID see-more-nearby); "You" label under me marker; clusters show "+N" and dominant vibe label
  - location-privacy: new title "You control your location", 6 cards incl. "Extended discovery stays private", button "I understand", back chevron; setup mode pushes /plans
  - plans: back chevron always (canGoBack), success → /plan-confirmed?plan=X(&next=setup) instead of Alert
  - NEW /plan-confirmed: "You're all set!" + plan copy + mini radar preview + Continue (setup→intent) + "Edit setup"→/review-setup
  - NEW /review-setup: Plan/Radius/Vibe/Vibe details/Visibility/Availability rows with Edit buttons + "Start using Intro"→tabs
  - Onboarding back buttons: how-location-works, location-privacy, plans, intent, profile-setup, choose-vibe, etiquette (all canGoBack-guarded); intent/profile-setup/choose-vibe now push (not replace) so back preserves flow
  - vibe.tsx: changing vibe asks "Update details / Keep for now"
  - privacy.tsx: "Plan & radius" label + spec upgrade prompt wording
  - demo-accounts: "Your plan (demo switch)" chips (switch-plan-free/plus/pro) + "High Density Demo" toggle (toggle-high-density)
  - nearby: header shows "100+ people nearby..." at cap; footer cap card w/ "Why limit?"
  - ModeSelector trimmed to Social/Networking/Campus/Events/Fitness
Backend verified via curl: plan defaults OK, HD demo 100-cap OK. needs_retesting: true (frontend flows)

## Iteration 9 — Focus Map (visual, self-verified via screenshots)
- Focus top-12 markers + vibe clusters + heat zones + relevance glow; stats microcopy; BEST NEARBY MATCH card (strong-only); NEARBY NOW row w/ avatar stack; cluster tap → /nearby?vibe=X pre-filter.
- Demo: 61 nearby / 47 aligned / 12 strong for Kauri Pro @500m (seed rebuilt, stale radar users cleaned).
- needs_retesting: false (self-verified end-to-end via browser screenshots)

## Iteration 35 — Signup / Legal Consent / Safety Access (Aug 2026)
main agent changes: 4-step signup (DOB 18+ gate, required+optional consent, success/verify state), backend/legal_consent.py policy registry + consent endpoints, append-only db.consent_records, reauth account deletion (password + typed DELETE), /legal-safety + /account-data + /blocked-users screens, professional disclaimer + credential-upload + location pre-permission notices, marketing withdrawal hook in email prefs.
testing agent: backend 21/21 pytest pass, frontend all flows pass (see /app/test_reports/iteration_35.json). Old pytest files use legacy register contract (age int) — expected failures, superseded.
needs_retesting: false

## Iteration 36 — Photo pipeline fix + Demo Mode + demo photos (Aug 2026)
main agent: root-cause photo upload fix (photo/photo_url 422 mismatch), normalisation pipeline, backend photo validation, 36 unique AI demo portraits + manifest, demo_mode.py (flags, admin seed/reset/remove, realm isolation, screenshot mode), avatar URI resolution, content audit (unsplash hero/sample photos/invite link).
testing agent: 23/23 backend pytest + full frontend pass, 0 bugs (/app/test_reports/iteration_36.json). Demo state left enabled, screenshot mode off.
needs_retesting: false

## Iteration 37 — 3-tier radius subscriptions (Aug 2026)
main agent: billing.py entitlement system (sandbox-gated), PLAN_LIMITS 250/500/1000, radius migration + one-time notice, /plans rebuild per visual, /subscription screen, RadiusSheet locks+paywall, copy audit, alert.ts 3-button web fallback.
testing agent: backend 15/15 pytest + frontend 6/6 flows pass (/app/test_reports/iteration_37.json). Sarah left on free. Verdict: PRICING UI COMPLETE — BILLING NOT CONFIGURED.
needs_retesting: false

## Iteration 38 — radius/map fix + Nearby Now rebuild (Aug 2026)
main agent: ringSet 750/1000 + 1km label, removed backend 500m hard cap (compute_nearby + professionals), effective radius everywhere, demo 500-1000m distance band, Nearby Now full-width teal CTA rebuild.
testing agent: frontend 7/7 pass, no bugs (/app/test_reports/iteration_38.json). Kauri left free/250.
needs_retesting: false

## Iteration 39 — People Mode Age Preference filter (Aug 2026)
main agent: backend age filter in compute_nearby (people_min_age/people_max_age/people_allow_age_expansion; 18–65 where 65="65+"; under-18 hard block from DOB; conservative expansion ±3y, max 3 extra, only when in-range <5, flagged outside_age_preference); StateUpdate validation+clamping; public_user exposes prefs (never DOB); signup defaults 18/65/true; startup migration for existing users; demo seeds get consistent date_of_birth + scatter ages 20–62; analytics props (DOB/lat/lng stripped). Frontend: AgeRangeSlider (dual-handle, PanResponder, a11y adjustable), /privacy AGE section (People mode only) + Reset/Apply Filters footer + hydration re-sync effect, vibe.tsx one-time relationship prompt (Save preference / Not now, relationship_age_prompt_seen), outside-age note in UserRow/radar preview/person profile.
testing: backend 16/16 pytest (tests/test_iter39_age_filter.py) + regression suites green (iter30 stale test updated for DOB contract). testing agent frontend 5/6 pass; hydration bug fixed by main agent then Flow 4 verified visually (60–64 range → Freddie 62 in-range, Barney 58 flagged "A little outside your age preference"). Kauri restored to 18/65/true, visible, radius 500. Report: /app/test_reports/iteration_39.json
needs_retesting: false
NOTE for web automation: localStorage 'auth_token' value is JSON-serialized (store JSON.stringify(token), not the raw token).

## Iteration 40 — Approved Profile Experience (Aug 2026)
main agent: discoverability gate (3 photos/40-char bio/verified email) enforced in compute_nearby via is_discoverable (demo exempt); rich profile fields + sanitisation in update_profile; nearby payload rich data + mutual_interests + calculated age; completion endpoint rewritten; pro portfolio_photos; demo same-person galleries (gen_demo_photo_variants.py, 20 images, all succeeded); verify-email copy update. Frontend: PhotoGrid reorder/make-main, edit-profile About+prompts editor, person/[id] gallery+sections, radar preview interests/mutual, profile completion card, complete-profile banner.
testing: backend 69/69 pytest (iter40+39+37+34+30). testing agent iteration_40: ALL 6 FLOWS PASS, no fixes applied. Kauri restored. Report: /app/test_reports/iteration_40.json
needs_retesting: false
notes: person/[id] needs nearby context (direct URL cold-load shows Out of range); Nearby advice bottom-sheet may need Dismiss; kauri visibility auto-expires — re-PUT visible:true.

## Iteration 41 — Master Dashboard Branding (Aug 2026)
main agent: control theme tokens → official palette, light sidebar + logo, login rebrand, env badges, greeting, DEMO pills, plan rename (intro_* keys removed, demo billing reseeded), chart palette, branded empty states, teal primary buttons.
testing: testing agent iteration_41 — ALL 8 FLOWS PASS at 1440x800 + 900x800; two low findings (avatar testID — fixed by main agent; RN-web shadow* deprecation warnings — pre-existing). Report: /app/test_reports/iteration_41.json
needs_retesting: false

## Iteration 42 — Photo card / 2-photo min / mode isolation / credential annual review (Aug 2026)
main agent: see PRD iter42 section. testing agent iteration_42: ALL 6 FLOWS PASS — mode-bleed bug verified fixed end-to-end (server 20/20 ping:null in professional mode, UI 50s watch + reload), photo card 358x400 r22 verified, 2-photo copy/checklist verified, admin queue tabs + Complete Annual Review verified (Rory demo review → next review +12mo), logo click verified. Kauri restored. needs_retesting: false

## Iteration 43 — Mandatory Email Verification hard gate + Resend branding (Aug 2026)
main agent: server-side gate middleware (enforce_email_verification, _VERIFY_EXEMPT allowlist; DELETE /users/me + email-preferences exempt); registration sets email_verified:false + sends branded verify email; resend rate limit (_resend_guard: 5/hr/account via db.email_resend_attempts, counted at endpoint so demo/test skips still count; change-unverified shares the cap); change-email flow (dup check, never sets verified); branded /api/email/verify result pages (success/expired/invalid, no leaks); discovery exclusion at query level (is_discoverable for People, _pro_public returns None for unverified non-demo owners in /professionals); demo (is_demo) exempt. Frontend: (auth)/verify-email.tsx full-screen gate (resend w/ 60s cooldown, change email, I've-verified refresh, logout), index.tsx redirect, login routes unverified→gate, register success→gate (bypass removed). Admin: control users Email status column + verified_email/unverified_email filters; /control/email/stats verification_funnel + Emails page KPI cards. Test maintenance: tests/conftest.py verify_email fixture; stale fixtures updated (DOB/accept_policies, rotated admin pw, 58 templates, logo v2, delete reauth body) — 245 tests green across iter26–43 + control + prod cutover.
testing agent iteration_43: FULL PASS — backend 17/17 (incl new test_iter43_email_gate_extra.py 10/10), frontend 5/5 flows (signup→gate, cooldown/change-email/stay-on-gate, Mongo verify→choose-vibe, login gate + demo bypass, admin column/filters/funnel). No bugs, no regressions. Report: /app/test_reports/iteration_43.json
needs_retesting: false
notes: real-device email open/deep-link QA still pending (user). Production deploy pending owner approval. PUBLIC_BASE_URL/EMAIL_LOGO_URL env-driven for prod cutover.

## Iteration 44 — Save Vibe Details bug + app-wide button/CTA audit (Aug 2026)
Root cause (user-reported, production iPhone): backend banned-content filter used SUBSTRING matching — innocent text like "looking for something serious" (so-METH-ing) or "begun" (be-GUN) returned 400, and frontend swallowed all save errors with empty catch{} → silent no-op.
Fixes: (1) server.py contains_banned_terms word-boundary regex (both vibe-details + help-request/_check_banned paths), generic message; (2) api.ts safe JSON parse + friendly EMAIL_VERIFICATION_REQUIRED message; (3) surfaced errors on ALL user-initiated saves: vibe-details (inline vd-error), vibe.tsx save + rel-preference (alert), edit-profile save/remove/reorder (setError + reorder revert), opportunity-details delete, privacy save, profile-setup remove/next, choose-vibe, intent (no nav on failure), RadiusSheet (sheet stays open on failure); (4) done() canGoBack fallback in vibe-details + opportunity-details. Background polls/loads intentionally remain silent. Backdrop onPress={()=>{}} tap-eaters intentional.
Tests: new tests/test_iter44_buttons.py (7/7: word-boundary allow/deny, persistence, re-login survival, empty-value stripping, help-request paths). Maintained regression set 141 passed. Testing agent iteration_44: backend 100%, frontend 7/8 flows E2E PASS (flow 2 via curl+code review), no regressions. Report: /app/test_reports/iteration_44.json
needs_retesting: false
notes: iOS-keyboard tap behavior can't be simulated on web (ScrollView already has keyboardShouldPersistTaps="handled") — real-device re-check after user redeploys. Legacy stale suites (iter4-25 pre-DOB) remain out of maintained set.

## Iteration 45 — Plan experience active, payments not enabled (Aug 2026)
main agent: removed "Coming Soon" disabled CTA from /plans. Paid CTA now "Choose Plus"/"Choose Pro" (Free: "Continue with Free"); tapping paid CTA as public user opens branded bottom sheet "Orrbbit Plus/Pro is almost ready" with Notify me / Not now (no fake checkout/success). Notify me → POST /api/billing/interest (new, privacy-safe upsert to db.plan_interest {user_id, plan, timestamps} — no email/marketing) + analytics plus_interest/pro_interest events. Sandbox 403 detail changed "Subscriptions are coming soon" → "Paid subscriptions aren't available yet" (iter37 test assertion updated). Subscription page: added Plan comparison card (3 rows, prices/radius, Current plan marker, "Payments not yet enabled" on paid rows for public users, rows deep-link to /plans?plan=X). Demo/QA sandbox purchase modal unchanged and isolated (sandbox_eligible server-side, demo users only). Entitlements untouched: Free 250m / Plus 500m / Pro 1km, backend authoritative, radius clamp verified. Sheet compacted after testing-agent viewport note (fits 390x844).
tests: new tests/test_iter45_plans.py (8) + iter37 suite → 22 green. Testing agent iteration_45: ALL 8 flows PASS (backend + frontend + demo isolation). Report: /app/test_reports/iteration_45.json
needs_retesting: false

## Iteration 46 — Demo Mode full profile data refresh (Aug 2026)
main agent: rebuilt all 80 demo fixtures to current_profile_v2. Primaries (10 @intro.demo): 3 same-person /api/demo-assets photos, rich varied bios, current_city Melbourne + varied home_city (Auckland/Sydney/Brisbane/Adelaide/Perth/Wellington/Geelong/London/Hobart), occupation/education/languages, 4-6 interests with intentional Kauri overlaps, 1-3 prompts, DOB derived from age (consistent), email_verified. Radar crowd (57): deterministic _demo_enrich (varied interests 3-4 from 21-item pool, varied home cities incl. Vancouver/Singapore/Christchurch, 1 prompt, bio hooks) — legacy ["Coffee","Melbourne"] eliminated. Global crowd (12): city-local bios + enrichment. Intentional incomplete fixtures tagged: ezra=incomplete_profile_a (1 photo, minimal bio), luna=incomplete_profile_b (no home city). Professional annual review fixtures: credential_verified_at/credential_next_review_at seeded — Tom current (+304d), Grace due soon (+14d), Oscar overdue (-31d), Lucas nearing 24-month max (-296d); expiring (Hugo/Callum doc expiry precedence), Expired, Pending, Rejected states intact. demo_schema_version stamped on all 80; demo_fixture tags (primary/radar_crowd/global_crowd/persona). DEMO_ENV_VERSION=4. Idempotent: /api/demo/reset keeps exactly 80 users, no dupes, real users untouched (0 stamped).
tests: new tests/test_iter46_demo_data.py 14/14; 117 maintained regression green. Testing agent iteration_46 (retest run): all 8 browser flows PASS (full profile render, crowd variety, age filter 25-35 strict, professional mode + review states, connections/chat, edit profile, admin detail, reset idempotency). Non-issues noted: GET /api/matches 405 (endpoint is POST-only by design), external-API mode switch needs reload (in-app switch fine).
needs_retesting: false

## Iteration 47 — Final production hardening + developer handover (Aug 2026)
Baseline: restore point 6c6d60a, DB backup /app/memory/backups/iter47_baseline.
Security fixes: (1) public_user renamed own_user with SELF-only contract doc — confirmed NO public email/DOB/coords leak on any other-user surface; (2) distance/bearing quantized 10m/10° for real users (anti-triangulation, demo untouched); (3) token versioning: tv claim, SESSION_REVOKED on mismatch, bumped on password reset + new POST /auth/logout-all; banned accounts → 403 ACCOUNT_BANNED on every request; deleted → 401; impersonation tokens carry tv; (4) GET /people/{id} deep-link profile endpoint reusing full discovery pipeline (privacy-identical) + person/[id].tsx cache-miss fallback with loading state; (5) DISCOVERY BUG FIXED: compute_nearby raw .to_list(500) scan silently dropped users past 500 docs — now query-level city+visible filter (cap 2000); purged 563 accumulated preview test accounts (97 users remain, 80 demo, real untouched); (6) core DB indexes via ensure_core_indexes() startup with query justifications (users id/email unique, pings, matches, blocks, notifications, verification, reports, analytics, login_failures…); (7) analytics unification: legacy analyticsEvents write+read moved to analytics_events (legacy data retained read-only); (8) legacy MAX_RADIUS=100 removed — encounters respect effective plan radius; (9) Alex demo lego avatar → /api/demo-assets/alexdemo.jpg; (10) SECRETS: real RESEND_API_KEY/JWT secrets exist in git history — .env untracked going forward, CREDENTIAL ROTATION REQUIRED flagged in HANDOVER §22.
Deferred deliberately: server.py modularisation (documented plan HANDOVER §3), @intro.demo internal identifier rename (data migration risk).
Tests: new tests/test_iter47_security.py 13/13; maintained regression ~340 green (297 passed full sweep + 43 focused rerun after discovery fix). Testing agent iteration_47: all 6 frontend flows PASS, zero regressions.
Docs: /app/HANDOVER.md (23-section developer handover).
needs_retesting: false

## Iteration 48 — Credential rotation + Pings row layout fix (Aug 2026)
Security: JWT_SECRET, CONTROL_JWT_SECRET, CONTROL_BOOTSTRAP_PASSWORD rotated in backend/.env (32 random bytes, values never displayed/committed; .env untracked). qa-admin test password rotated (DB bcrypt + tests + memory/test_credentials.md). Old-signature tokens 401; fresh logins fine. 112 auth/email/control tests green post-rotation. PENDING USER EXTERNAL ACTIONS: new RESEND_API_KEY from Resend dashboard (create→install→test→revoke-old), owner changes own dashboard password via Control Centre, redeploy so production picks up rotated env (will log out all prod sessions).
Pings bug (user-reported, iPhone): View CTA overlapped meta line. Root cause: metaRow children default flexShrink:0, no wrap → overflow under actions column. Fix in (tabs)/pings.tsx: metaRow flexWrap, headline flexShrink:1, content minWidth:0, actions flexShrink:0. Testing agent iteration_48: bounding-box intersection across 79 rows x 3 viewports (390/375/320) = 0 overlaps incl. long-name stress; View/Dismiss/Accept functional; auth sanity pass. Report /app/test_reports/iteration_48.json.
needs_retesting: false

## Iteration 48c — Production Resend key not used (root cause + fix)
User bug: new RESEND_API_KEY added to Emergent Secrets shows "No activity"; production verification emails not arriving.
Root cause: email_templates.env_cfg resolved config file-first (_FILE_ENV over os.environ, intentionally for URL/branding). The deployed container carries a baked backend/.env with the OLD (now revoked) key, which shadowed the new key injected by the secret store as an OS env var. Preview confirmed: no RESEND_API_KEY in process env (secrets are production-only) and file key returns Resend HTTP 401 "API key is invalid" (old key revoked).
Fix: _PROCESS_ENV_FIRST = {"RESEND_API_KEY"} — secrets resolve process-env-first; APP_URL/branding stay file-first (preview-host pollution guard preserved). Failures confirmed recorded in email_events + admin stats, never swallowed, no key values leaked into stored reasons.
Verification: tests/test_iter48_resend_key.py 4/4 + testing-agent independent suite 9/9 (precedence sentinel, pipeline reach, resend 429, password reset event, admin visibility, sender config notifications@updates.orrbbit.com). Reports: /app/test_reports/iteration_48c.json.
ACTIVATION REQUIRES USER REDEPLOY (production picks up the secret at container start). Preview intentionally left without a valid key per user instruction.
needs_retesting: false

## Iteration 49 — Control Centre production go-live configuration (Aug 2026)
Existing (verified, unchanged): LIVE/DEMO data-mode toggle with server-side realm filters (demo excluded from LIVE metrics/lists, switch-to-live confirmation), RBAC + reauth-428, audit logs, verification funnel.
NEW: (1) persistent deployment-environment banner in Shell.tsx (testID env-banner) — amber "PREVIEW / TEST ENVIRONMENT" vs green "LIVE PRODUCTION", derived from baked backend URL (client) and request host (server), not URL guesswork by admins; (2) GET /api/control/status (admin-only, host-derived environment, db ping, email health + last successful email, active real users 24h, open reports, pending credential reviews excluding demo users, demo_data_excluded flag); (3) Operational Status panel on overview (testID ops-status); (4) destructive-action modal upgraded: DESTRUCTIVE warning, target user+email, reason input persisted to audit (reason survives the 428 reauth path).
Testing agent iteration_49: all 6 flows PASS (banner persistent across pages, ops panel renders, LIVE mode lists zero demo users, control APIs 401 for anonymous + app-user tokens, ban modal + 428 reauth intact). Screenshot smoke confirmed banner + ops panel + reason flow.
Production notes: separate prod DB by design (cross-env actions impossible); banner shows LIVE PRODUCTION after user redeploys; email health may show error until the Resend key fix (iter48c) is deployed.
needs_retesting: false

## Iteration 50-51 — LIVE user sync defect + deployment fingerprint (June 2026)
Iter50 root cause (owner-reported prod bug): Control Centre DATA MODE defaulted to DEMO everywhere (frontend useState('demo') + stored cc_mode restore; backend X-Admin-Mode header default "demo") while the env banner read LIVE PRODUCTION — live users silently hidden by the demo filter. Fix: backend get_mode() defaults LIVE (demo strictly opt-in); production frontend boots LIVE and ignores stored cc_mode (Preview unchanged: defaults demo, honors stored). Tests tests/test_iter50_live_user_sync.py 12/12; testing agent iteration_50 full pass. Iter51: public secret-free GET /api/version {"build","control_mode_default"} + build tag in env banner so the owner can prove which build runs in production (prod /api/version 404 => pre-iter51 build). Stale QA password fixed in iter22/23/29/32 test files.
needs_retesting: false

## Iteration 52 — Admin-session resilience + error-state audit (June 2026)
User-reported: expired/invalid admin sessions could render misleading empty datasets ("0 users") in production Control Centre. Restore point: tag iter51-restore-point (ce726ac).
Fixes: (1) ControlContext.rawReq — network failure -> ApiError(0,'Unable to reach the Orrbbit backend…') + backendOk=false (never empty data); 401 with token -> forced logout + persisted cc_notice "Your admin session has expired. Please log in again." + redirect to login (notice survives layout remount via AsyncStorage — in-memory alone was lost because Guard <Redirect> remounts the control layout); download() same handling. backendOk only set true from a successful AUTHENTICATED response. (2) login screen shows amber session notice (testID session-notice); cleared on successful login. (3) Shell banner now: ENV · BUILD ITER52 · BACKEND: CONNECTED/UNAVAILABLE/CHECKING… · SESSION: ACTIVE. (4) Silent-failure audit across ALL control screens — replaced catch->empty with error state + Retry (new ErrorState component in ui.tsx, testID error-state): users, analytics, chats (list+messages), command-centre, connections, professionals, subscriptions, system-health, help-requests, notifications, reports, verifications, index (dashboard + ActivityPreview), RadarPanel (people/professional radar), legacy app/admin.tsx (error+Retry). Screens already rendering error banners (admins, audit-logs, backups, content-management, database-viewer, emails, emergency-controls, feature-flags, ai-insights, categories, demo-mode, marketing, settings, exports, payments, user/[id]) verified to display errors. (5) APP_BUILD/CC_BUILD bumped iter52.
Tests: tests/test_iter52_admin_session.py 10/10 (valid token loads real users; expired/malformed/forged/wrong-type token 401; no-token 401/403; 401 body leaks nothing; re-login restores data; genuine empty q => 200 []; dashboard expired 401 without zeroed KPIs) + iter50 12/12 + control_center 24/24. Playwright-verified: expired stored token -> login screen with notice -> re-login -> dashboard restored, notice cleared, banner BACKEND: CONNECTED.
No production data touched (preview DB only; probe users cleaned by fixtures).
needs_retesting: false

## Iteration 53 — Control Centre browser admin now targets PRODUCTION (June 2026)
USER CHOICE: EXPO_PUBLIC_CONTROL_BACKEND_URL=https://nearby-connect-93.emergent.host added to frontend/.env (protected vars untouched; a no-trailing-newline append briefly corrupted EXPO_PACKAGER_PROXY_URL and was immediately repaired/verified). ControlContext BASE + Shell IS_PREVIEW_ENV now derive from the override (fallback: EXPO_PUBLIC_BACKEND_URL). Result: the browser page /control at the PREVIEW host is now a desktop admin over LIVE PRODUCTION data (banner shows LIVE PRODUCTION, boots LIVE mode). The product app in preview still uses the preview backend — only /control is overridden. Also fixed: non-string FastAPI 422 error details rendered "[object Object]" — ApiError now falls back to "Request failed (status)".
Verified: login POST from browser /control observed hitting https://nearby-connect-93.emergent.host/api/control/auth/login (422 then 401 "Invalid credentials" for a dummy account — production responded, no lockout risk since account doesn't exist).
!!! WARNING FOR FUTURE TESTING AGENTS !!!
Browser/Playwright tests against /control now hit the LIVE PRODUCTION backend. DO NOT run Control Centre UI test flows (logins, actions) via the preview web URL — QA admin does not exist in production and any actions would target real data. Backend /api/control tests remain safe: they call the preview backend directly via EXPO_PUBLIC_BACKEND_URL. To UI-test the Control Centre against preview data, temporarily comment out EXPO_PUBLIC_CONTROL_BACKEND_URL in frontend/.env, restart expo, test, then restore it.
needs_retesting: false

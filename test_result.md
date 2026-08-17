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

# ORRBBIT — Developer Handover (August 2026)

This document lets an independent senior developer understand, review and release
Orrbbit without relying on prior chat history. Written at iteration 47
(final hardening pass). Companion docs: `/app/memory/PRD.md` (full product history),
`/app/test_result.md` (testing log per iteration).

---

## 1. System architecture

- **Mobile app**: Expo (React Native) + expo-router file-based routing. Served by Metro in
  Preview; production ships via EAS builds (Expo Go QR / TestFlight / Play).
- **Backend**: FastAPI (Python) on `0.0.0.0:8001`. ALL routes prefixed `/api`
  (Kubernetes ingress routes `/api/*` → backend, everything else → Metro/web).
- **Database**: MongoDB via Motor (async). Connection from `backend/.env` (`MONGO_URL`, `DB_NAME`).
- **Admin**: "Control Centre" master dashboard — Expo web routes under `frontend/app/control/*`,
  backend modules `control_center.py`, `control_email.py`, `control_phase2.py`, `control_phase3.py`.
- **Email**: Resend (transactional only) via `email_service.py` / `email_templates.py` /
  `email_scheduler.py` / `email_triggers.py`.
- Environments: **Preview** (dev/testing) and **Production**
  (`https://nearby-connect-93.emergent.host` — deployed by the owner via Emergent "Publish").
  The agent/dev sandbox has no production access; production updates = owner redeploy.

## 2. Frontend architecture

- `frontend/app/` — routes. Key groups: `(auth)/` (welcome, login, register, verify-email,
  onboarding, choose-vibe, profile-setup…), `(tabs)/` (index=Radar, nearby, pings, encounters,
  profile), `person/[id]` (full People profile), `professional/*`, `control/*` (admin),
  plus feature screens (vibe, vibe-details, opportunity-details, plans, subscription,
  privacy, edit-profile, settings…).
- `frontend/src/` — `context/AuthContext.tsx` (session + user), `context/AppContext.tsx`
  (nearby cache, coords, refresh), `lib/api.ts` (fetch wrapper: JSON-safe, friendly
  EMAIL_VERIFICATION_REQUIRED mapping), `lib/session.ts` (token in AsyncStorage,
  JSON-serialized), `components/`, `control/theme.ts` (admin design tokens), `theme.ts`.
- Styling: StyleSheet only, Orrbbit design system (teal/navy, Quicksand).
- `.env` (protected — never edit): `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME`.

## 3. Backend architecture

- `server.py` (~3700 lines) — core: auth, users/profiles, discovery (compute_nearby),
  pings/connections/matches, encounters, safety (blocks/reports), professional discovery,
  verification lifecycle, help requests, demo seeds, admin analytics.
- Modules: `billing.py` (plans/entitlements/sandbox), `demo_mode.py` (demo realm isolation,
  photo mapping, distance spread), `professional_flow.py` (pro requests/sessions/reviews),
  `legal_consent.py`, `password_reset.py`, `email_*.py`, `control_*.py`.
- **Deliberately deferred**: splitting `server.py` into routers. It is large but stable and
  heavily regression-tested; a pre-handover big-bang split was judged higher risk than value.
  Suggested extraction order if you do it: auth → safety → professional → discovery.
  Preserve API contracts and run `backend/tests/` after each step.

## 4. Database collections (main)

users, pings (also connection requests, kind="request"), matches, blocks, hides, saved,
notifications, reports, help_requests, professional_profiles, verification_submissions,
pro_requests, pro_sessions, pro_reviews, pro_messages, meetups, entitlements,
demo_subscriptions/demo_payments (sandbox only), plan_interest, consent_records,
email_events/email_resend_attempts/email_suppressions/email_bounces, analytics_events
(legacy `analyticsEvents` retired — kept read-only), login_failures, password_resets,
known_devices, admin_users, admin_audit_logs, impersonation_logs, feature_flags,
app_config, meta.

## 5. Database indexes

Created idempotently at startup — `ensure_core_indexes()` in `server.py` (justifications
in its docstring). Email indexes in `email_service.ensure_indexes()`. Geospatial: discovery
is city-scoped in-memory haversine over a bounded candidate query (city+visible index);
no 2dsphere required at current scale (~city-level launches). Revisit if a city exceeds
~10k concurrent visible users.

## 6. Authentication / session architecture

- Users: JWT HS256 (`JWT_SECRET`), 30-day expiry, claims `sub`, `tv`, `exp`, `iat`.
- **Token versioning (iter47)**: `users.token_version` — `get_current_user` rejects tokens
  whose `tv` mismatches (401 SESSION_REVOKED). Bumped on password reset and
  `POST /api/auth/logout-all`. Banned accounts → 403 ACCOUNT_BANNED on any request.
  Deleted accounts → 401. Client logout clears the stored token.
- Login brute force: `login_failures` window checks. Registration: DOB 18+ server-enforced,
  `accept_policies` mandatory (consent records persisted).
- Admin: separate JWT (`CONTROL_JWT_SECRET`, hours-long expiry), RBAC roles, must-change-password
  bootstrap, reauth (428) for high-risk actions, brute-force lockouts.
- Impersonation: super-admin only, recent-reauth required, 30-minute token with `imp` claim,
  fully logged (`impersonation_logs` + audit).

## 7. Email verification (mandatory)

- Registration sends branded verify email (Resend). `enforce_email_verification` middleware in
  `server.py` blocks ALL product APIs (403 EMAIL_VERIFICATION_REQUIRED) for unverified,
  non-demo accounts. Exempt allowlist near the middleware (auth, email mgmt, legal/content,
  control, account deletion).
- Mobile gate: `(auth)/verify-email.tsx` (resend w/ cooldown, change-email, refresh).
- Resend abuse control: 5/hour/account via `email_resend_attempts` (endpoint-level — cannot be
  bypassed by client restarts; change-email shares the cap). 429 after limit.
- Verify link → branded HTML pages (success/expired/invalid) served by backend.
- Unverified users are excluded from discovery at query/serializer level.

## 8. Location / privacy model

- Exact GPS (`users.lat/lng`) is stored server-side only, used only for haversine distance.
- **No API ever returns another user's coordinates.** Discovery returns distance + bearing only;
  for REAL users both are quantized (10 m / 10°) to prevent triangulation (demo positions are synthetic).
- Public serializers never include: email, DOB, lat/lng, password hash, tokens, credential docs.
  `own_user()` (`server.py`) is the OWN-ACCOUNT serializer (includes own email) — never use it
  for another user. Regression-locked by `tests/test_iter47_security.py`.
- Cities are user-entered, city-level only.

## 9. Radar / discovery logic

- `compute_nearby()` = single People discovery pipeline: query-level city+visible candidate
  filter → realm isolation (demo vs real) → visibility/ghost/pause → discoverability gate
  (2+ photos, 40+ bio, verified email) → moderation gate → 18+ / age-preference filter
  (with conservative expansion) → vibe compatibility/visibility rules → scoring → cap 100.
- `GET /api/people/{id}` (iter47) reuses this pipeline for deep-link profile loads —
  a profile resolves only if it would legitimately appear in the viewer's discovery.
- Radius entitlements (backend authority, `billing.py`): Free 250 m, Plus 500 m, Pro 1 km.
  Client can never exceed `plan_max_radius`.

## 10. People / Professional separation

- `users.app_mode` (people|professional). People age prefs apply ONLY in People mode.
  Professional discovery (`GET /api/professionals`) lists only actively-verified, email-verified
  professionals; People recommendations are state/query-isolated from Professional mode (iter42).

## 11. Professional credential lifecycle

States: Not Submitted → Pending Review → Approved / Rejected (more info) / Expired.
Annual review: 12-month cycle (`credential_verified_at`, `credential_next_review_at`),
24-month max validity without renewed evidence, actual credential document expiry always
takes precedence (`_effective_expiry` in `server.py`). Scheduler sends reminders.
Credential documents are private (admin review only, RBAC + audit). Demo fixtures cover
every state incl. review-due/overdue (see `tests/test_iter46_demo_data.py`).

## 12. Subscription entitlement architecture

- `billing.py`: `BILLING_MODE` env = disabled | sandbox | native. Production semantics: payments
  NOT enabled; public users cannot purchase (sandbox restricted server-side to demo accounts).
- Plans UI: cards fully selectable; paid CTA opens "almost ready" sheet; `POST /api/billing/interest`
  records privacy-safe interest (plan_interest collection). NO fake checkout anywhere.
- Approved pricing (immutable): Plus $6.99/mo, Pro $11.99/mo.
- Native Apple/Google billing is NOT integrated — future work, requires store products + receipt
  validation; keep backend entitlement authority.

## 13. Demo Mode

- 80 fixtures, all `is_demo: true`, `demo_schema_version: "current_profile_v2"`,
  `demo_fixture` tags (primary / radar_crowd / global_crowd / persona / incomplete_profile_a|b).
- Realm isolation (`demo_mode.py`): demo and real users never see or interact with each other.
  Demo excluded from real analytics/metrics.
- Idempotent seeds at startup (`DEMO_ENV_VERSION` in `server.py`); manual reset:
  `POST /api/demo/reset` (as a demo user). Demo photo assets: `backend/static/demo-assets/`.

## 14. Admin Dashboard (Control Centre)

`/control/*` web routes; Orrbbit-branded (iter41). Covers users (search/filters incl. email
verification status, DEMO badges, detail view, suspend/ban/delete with reauth), reports queue,
credential verification queue (incl. annual review), billing/plans overview, email system
(stats + verification funnel, templates, suppressions), feature flags/maintenance mode,
audit logs, impersonation. RBAC enforced server-side; high-risk actions need recent reauth (428).

## 15. Environment variables (names only — values live in env, never in git)

Backend: MONGO_URL, DB_NAME, JWT_SECRET, CONTROL_JWT_SECRET, CONTROL_BOOTSTRAP_EMAIL,
CONTROL_BOOTSTRAP_PASSWORD, EMERGENT_LLM_KEY, EMERGENT_EMAIL_KEY, RESEND_API_KEY,
FROM_EMAIL, FROM_NAME, EMAIL_FROM_NAME, APP_URL, SUPPORT_EMAIL, PUBLIC_BASE_URL,
EMAIL_LOGO_URL, TEST_MODE_CODE, BILLING_MODE.
Frontend: EXPO_PUBLIC_BACKEND_URL, EXPO_PACKAGER_PROXY_URL, EXPO_PACKAGER_HOSTNAME (platform-managed).

## 16. Third-party services

- **Resend** — transactional email. Verified sender: notifications@updates.orrbbit.com
  (root orrbbit.com is NOT verified — do not switch sender without DNS verification).
- **MongoDB** — platform-managed.
- **Expo/EAS** — builds via the Emergent publish flow.
- No payment processor, no push notification service, no external auth provider.

## 17. Deployment process

Owner clicks "Publish" (Emergent) → backend to K8s + frontend via EAS. Preview changes require
redeploy to reach production. Custom email/link domain (e.g. api.orrbbit.com) would be a
one-line env change (PUBLIC_BASE_URL/EMAIL_LOGO_URL) + owner DNS.

## 18. Test commands

```bash
cd /app/backend
export EXPO_PUBLIC_BACKEND_URL=$(grep EXPO_PUBLIC_BACKEND_URL /app/frontend/.env | cut -d= -f2)
python -m pytest tests/test_iter47_security.py -q          # security/privacy regression
python -m pytest tests/test_iter4{3,4,5,6}* tests/test_iter47_security.py -q
# full maintained regression (~300 tests):
python -m pytest tests/test_iter2{5,6,7}* tests/test_iter3*.py tests/test_iter4*.py \
  tests/test_control_center.py tests/test_email_prod_cutover.py -q
```
Legacy suites `test_iter4/5/6/10-24, backend_test.py, test_new_features.py` are STALE
(pre-DOB-gate contracts) — not part of the maintained set.
Test fixture note: registering test users requires marking them email-verified in Mongo
(`tests/conftest.py::verify_email` fixture).

## 19. Known limitations

- Deep-link profile loads resolve through the discovery pipeline: a profile outside the
  viewer's radius/filters 404s by design (privacy) — connected-user contexts (chat/pings)
  carry their own user payloads.
- Discovery candidate query caps at 2000/city; revisit with growth (see §5).
- Admin analytics endpoints scan the users collection (fine at current scale).
- Bearing/distance quantization is 10 m/10°: raises triangulation cost substantially but a
  radar product inherently discloses approximate position — documented product trade-off.
- `mode` switch via external API doesn't hot-refresh an already-open client (in-app switch fine).

## 20. Remaining technical debt

- `server.py` monolith (see §3 — deferred split plan).
- Legacy test suites stale (above).
- `analyticsEvents` legacy collection retained read-only (historical data).
- `@intro.demo` / `verified_by_intro` internal identifiers retained (renaming = data migration,
  deliberately not done; zero user-facing exposure).
- react-native-web `shadow*` style deprecation warnings (cosmetic, web only).

## 21. Native-device items requiring human validation

- Email verification deep links (`orrbbit://`) on real iOS/Android.
- Photo picker/camera upload on real devices.
- Keyboard behaviour on vibe-details/save flows (iOS keyboard open/closed).
- Location permission flows + real GPS radar behaviour outdoors.
- Expo Go vs production build parity; push notifications are NOT implemented.

## 22. Store-release prerequisites

- Apple Developer + Play Console accounts; identifiers already set: `com.orrbbit.mobile`, scheme `orrbbit://`.
- Privacy policy/terms URLs (exist on orrbbit.com) wired into store listings.
- App privacy questionnaires: location (coarse presentation), photos, email.
- **SECURITY: rotate credentials before/at release** — `backend/.env` (real RESEND_API_KEY,
  JWT_SECRET, CONTROL_JWT_SECRET, bootstrap admin password) appears in git history.
  Rotating JWT secrets logs out all sessions (acceptable pre-launch). If the repository is
  ever pushed to external hosting, purge history first (BFG/filter-repo).
- TestFlight / closed-track testing per §21 checklist.

## 23. What the incoming developer should independently review

1. Security: `tests/test_iter47_security.py` assertions vs their own pen-testing; JWT handling.
2. `server.py` architecture + the deferred modularisation plan (§3).
3. Production env/domain configuration + credential rotation (§22).
4. Real-device QA matrix (§21).
5. Store submission + release sign-off.

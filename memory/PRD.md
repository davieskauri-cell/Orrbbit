# ProximityRadar — PRD

## Original Problem Statement
A proximity-based social radar app revealing users' real-time social availability (Open to Chat, Busy, Looking for a Relationship, Struggling/Need Advice). Uses location to show status only to others within a radius (hard-capped at 50m; selectable 10/25/50m), acting as a real-life icebreaker for organic, face-to-face interactions. Match alerts when complementary statuses cross paths. Privacy: opt-in temporary location, adjustable radius, toggle visibility off.

## Latest updates (June 2026)
- 50m hard cap: backend clamps radius in /api/nearby and /users/me/state (10–50m); public_user caps stored values; mock personas repositioned within 8–49m; frontend defaults 50m.
- Radius selector in You tab: segmented chips 10m / 25m / 50m (replaced 50–300m slider).
- New welcoming light theme: soft teal/mint (#F4FAF7 surface, #14B8A6 brand) with warm orange accent (#FB923C); light map style; light match-alert overlay; dark status bar.
- New "Intro" logo: playful radar/wave mark (react-native-svg, src/components/Logo.tsx) used on onboarding + Radar header; regenerated app icons/splash/favicon via /app/scripts/gen_icons.py; app.json name "Intro", teal adaptive icon bg, mint splash bg.
- Default status colors refreshed: teal/rose/amber/slate.

## User Choices
- Auth: JWT email/password + profile setup
- Proximity: real GPS with mock users seeded nearby
- Views: radar-sweep screen AND live map with pins
- Statuses: 4 defaults + custom vibes
- Visual: agent-designed (6 Glass/Luxe, dark emerald cinematic)

## Architecture
- Backend: FastAPI + MongoDB (Motor), JWT auth (pyjwt), bcrypt (passlib). UUID string ids. Routes under /api.
- Frontend: Expo SDK 54 + expo-router. Contexts: AuthContext (token in secure storage), RadarContext (location via expo-location, status/visibility/radius, nearby polling every 6s, client-side match detection).
- Nearby: 7 mock personas positioned relative to requester (haversine + destination-point math) + real visible users within radius; is_match via complementary status graph.
- Map: react-native-maps native-only, platform-split component (NativeMap.tsx / NativeMap.web.tsx web fallback).

## User Personas
- Social explorers / singles wanting low-pressure real-world connections in cafes, streets, events.

## Core Requirements (static)
- Broadcast availability status; proximity-limited visibility; adjustable radius; visibility toggle; match/icebreaker alerts; face-to-face only (no in-app chat).

## Implemented (2026-07-02)
- JWT register/login/me, profile edit, state update (status/location/visible/radius)
- Default statuses seeded + custom status creation
- Nearby radar API with distance sort + match computation
- Radar sweep screen (animated), Map tab (pins + circle + bottom sheet), Nearby list, You tab (profile + privacy controls)
- Status broadcasting modal, Match "Paths Crossed" alert overlay
- Full testing passed: backend 14/14 pytest; frontend ~95%, no critical bugs

## Backlog (prioritized)
- P1: Filter nearby by `last_active` recency (avoid stale accounts inflating count)
- P1: Avatar upload / selection during profile setup
- P2: Push notifications for match alerts (requires user request + build)
- P2: Status auto-expiry (temporary broadcasting), background location
- P2: Recent "crossed paths" history log

## Next Tasks
- Wire avatar picker; add last_active filtering to /api/nearby.

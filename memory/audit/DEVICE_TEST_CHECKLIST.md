# ORRBBIT — Real-Device Internal Test Checklist (Owner-Facing)

Fill one column per device. Result values: **PASS / FAIL / BLOCKED / N-A**.
Do not mark PASS unless genuinely executed on that physical device.

**Evidence per test:** Device model · OS version · App build number · Tester · Date · Result · Notes · Screenshot/video link · Defect ID (if FAIL)

Recommended devices: 1 real iPhone (iOS 17+) and 1 real Android phone (Android 13+).
Get the app on device: deploy via the Emergent **Publish** button, then install the Android APK / iOS TestFlight build, or scan the Expo Go QR from the deployment panel.
QA tools on device: Profile → tap the version number 7× → enter the QA code (in /app/memory/test_credentials.md) → Test Mode unlocks Demo Accounts, Trial tools and **Device Diagnostics** (live permission/GPS/backend status).

| # | Test | iPhone | Android | Notes / Defect ID |
|---|------|--------|---------|-------------------|
| **INSTALLATION** |
| 1 | Install build | | | |
| 2 | First launch (no crash) | | | |
| 3 | App icon correct (Orrbbit) | | | |
| 4 | Splash screen correct | | | |
| 5 | Cold start < 5s | | | |
| 6 | Warm start (background → resume) | | | |
| 7 | Update/reinstall keeps login | | | |
| **AUTHENTICATION** |
| 8 | Signup (8+ char password enforced) | | | |
| 9 | Verification email received + link works | | | |
| 10 | Welcome email received (exactly one) | | | |
| 11 | Login / wrong-password error | | | |
| 12 | Forgot password → code email → reset | | | |
| 13 | Password-changed email received | | | |
| 14 | Session persists after force-quit | | | |
| 15 | Logout | | | |
| 16 | Protected deep link while logged out → safe | | | |
| **ONBOARDING** |
| 17 | Back/Continue on every onboarding page | | | |
| 18 | Photo-library permission accept flow | | | |
| 19 | Photo-library permission DENY → app still usable, Settings button offered | | | |
| 20 | Photo selection + upload | | | |
| 21 | Location explanation screen | | | |
| 22 | Location permission ACCEPT | | | |
| 23 | Location permission DENY → graceful, retry path | | | |
| 24 | Close app mid-onboarding → progress preserved | | | |
| 25 | Returning user skips onboarding | | | |
| **GPS & RADAR** (use Diagnostics screen for accuracy read-outs) |
| 26 | Initial GPS lock (< 30s outdoors) | | | |
| 27 | GPS accuracy < 50 m (Diagnostics) | | | |
| 28 | Current-location button recentres | | | |
| 29 | Pan map | | | |
| 30 | Pinch zoom | | | |
| 31 | Marker tap opens preview | | | |
| 32 | Cluster tap expands | | | |
| 33 | Nearby list matches radar | | | |
| 34 | Walk 100–300 m → position refreshes | | | |
| 35 | Passenger drive → sensible updates | | | |
| 36 | Background → foreground → radar recovers | | | |
| 37 | Disable device location → clear message | | | |
| 38 | Re-enable location → recovers | | | |
| 39 | Approximate-location permission (iOS precise off) | | | |
| 40 | Second device does NOT see your exact coordinates | | | |
| 41 | Blocked user hidden on both devices | | | |
| **PEOPLE MODE** |
| 42 | Radar / Nearby / Pings / Encounters / Profile tabs | | | |
| 43 | Send connection ping (2 devices) | | | |
| 44 | Accept ping → match | | | |
| 45 | Decline ping | | | |
| 46 | Chat between two devices | | | |
| 47 | Block → hidden both ways | | | |
| 48 | Unblock | | | |
| 49 | Report user flow | | | |
| **PROFESSIONAL MODE** |
| 50 | Switch persona (persists after restart) | | | |
| 51 | Professional radar + filters | | | |
| 52 | Carousel swipe | | | |
| 53 | Professional profile | | | |
| 54 | Need Help request → appears for pro | | | |
| 55 | Can Help flow | | | |
| 56 | Connect request → accept on 2nd device | | | |
| 57 | Chat unlocks only after accept | | | |
| 58 | Unverified pro restrictions enforced | | | |
| **MEDIA** (camera capture not used — library picker only) |
| 59 | Photo-library grant + select + upload | | | |
| 60 | Cancel picker | | | |
| 61 | Large image (>5 MB) uploads or errors cleanly | | | |
| 62 | Images render after app restart | | | |
| **RESPONSIVE UI** |
| 63 | Keyboard never covers inputs | | | |
| 64 | Keyboard dismisses properly | | | |
| 65 | Safe areas respected (notch/home bar) | | | |
| 66 | Long names/titles don't break layout | | | |
| 67 | Small-screen device layout | | | |
| 68 | Large-screen device layout | | | |
| **NETWORK** |
| 69 | Wi-Fi ↔ mobile data switch | | | |
| 70 | Airplane mode → clear error, no crash | | | |
| 71 | Back online → retry works | | | |
| 72 | Retry does not duplicate pings/messages | | | |
| **ACCESSIBILITY** |
| 73 | VoiceOver announces buttons (iPhone) | | N-A | |
| 74 | TalkBack announces buttons (Android) | N-A | | |
| 75 | Focus order logical on login + radar | | | |
| 76 | Larger system text stays readable | | | |
| 77 | Tap targets comfortable (≥44pt) | | | |
| **EMAIL REGRESSION (on real inbox)** |
| 78 | Sender shows "ORRBBIT" <notifications@updates.orrbbit.com> | | | |
| 79 | Reply-to support@orrbbit.com | | | |
| 80 | Orrbbit logo renders in Apple Mail / Gmail | | | |
| **BLOCKED until configured — do not fake** |
| 81 | Push notifications (needs google-services.json + native build) | BLOCKED | BLOCKED | |
| 82 | Apple/Google social login (NOT IMPLEMENTED) | N-A | N-A | |

## Defect log
| ID | Screen | Severity | Repro steps | Expected | Actual | Device/OS | Status |
|----|--------|----------|-------------|----------|--------|-----------|--------|
| | | | | | | | |

Severity: Critical (crash/security/data loss) · High · Medium · Low.
Process: report FAILs to the agent → smallest safe fix → new build if native config changed → re-test the affected rows only.

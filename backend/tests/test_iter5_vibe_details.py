"""Iteration 5 — Vibe Details / Intent Card tests

Covers:
- PUT /api/users/me/vibe-details persistence + GET /api/auth/me returns vibe_details
- GET /api/nearby returns intent/context/tags/vibe_details/mutual_reason/score;
  Sarah ranks first for Kauri, Olivia carries recruiter reason, radius <= 100m
- Privacy: show_recruiters=false hides Olivia from Kauri's nearby
- Visibility: 'hidden' on James hides his vibe_details from other users' nearby
- Saved-for-later: POST/GET/DELETE + no duplicates
- Pings: /api/pings payload contains reason/context/intent

Env: EXPO_PUBLIC_BACKEND_URL
Auth: demo accounts, password Intro123!
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PW = "Intro123!"

# Kauri's demo lat/lng per review request
KAURI_LAT = -37.8183
KAURI_LNG = 144.9671


# ------------------------------ helpers ------------------------------
def _login_demo(email: str | None = None) -> tuple[str, dict]:
    """Log in via /auth/demo-login. Empty body = Kauri."""
    body = {} if email is None else {"email": email}
    r = requests.post(f"{API}/auth/demo-login", json=body, timeout=15)
    assert r.status_code == 200, f"demo-login failed {r.status_code}: {r.text}"
    data = r.json()
    return data["access_token"], data["user"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def kauri_session():
    token, user = _login_demo()  # empty => Kauri
    return token, user


@pytest.fixture(scope="module")
def james_session():
    token, user = _login_demo("james@intro.demo")
    return token, user


@pytest.fixture(scope="module")
def sarah_session():
    token, user = _login_demo("sarah@intro.demo")
    return token, user


# ------------------------------ PUT /users/me/vibe-details ------------------------------
class TestVibeDetailsPersistence:
    def test_put_vibe_details_persists_and_returns_in_auth_me(self, kauri_session):
        token, _ = kauri_session
        payload = {
            "details": {
                "intent": "TEST intent",
                "context": "TEST context string",
                "looking_for": ["Feedback", "Testers"],
                "tags": ["TESTTag1", "TESTTag2"],
                "visibility": "public",
            }
        }
        r = requests.put(f"{API}/users/me/vibe-details", json=payload, headers=_headers(token), timeout=15)
        assert r.status_code == 200, r.text

        me = requests.get(f"{API}/auth/me", headers=_headers(token), timeout=15).json()
        vd = me.get("vibe_details") or {}
        assert vd.get("intent") == "TEST intent"
        assert vd.get("context") == "TEST context string"
        assert set(vd.get("tags", [])) >= {"TESTTag1", "TESTTag2"}
        assert vd.get("visibility") == "public"

    def test_restore_kauri_details(self, kauri_session):
        """Restore Kauri's seeded details so downstream tests behave as spec."""
        token, _ = kauri_session
        payload = {
            "details": {
                "intent": "Offering Career Advice",
                "advice_role": "Offering Advice",
                "context": "HR professional and founder building Intro.",
                "background": "HR professional and founder building Intro",
                "industry": "HR",
                "experience_level": "3-5 years",
                "professional_identity": "Founder",
                "looking_for": ["Business contacts", "App feedback", "Early testers"],
                "can_help_with": ["HR", "Career direction", "Interviews", "Confidence"],
                "offer_categories": ["Career", "HR", "Confidence"],
                "offer_experience": "Professional experience",
                "tags": ["HR", "Startups", "Business", "Golf"],
                "visibility": "public",
            }
        }
        r = requests.put(f"{API}/users/me/vibe-details", json=payload, headers=_headers(token), timeout=15)
        assert r.status_code == 200


# ------------------------------ GET /nearby ------------------------------
class TestNearbyVibeDetails:
    def test_nearby_returns_vibe_detail_fields_and_max_100m(self, kauri_session):
        token, _ = kauri_session
        r = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        users = data["users"]
        assert len(users) > 0, "expected demo users nearby"
        # every user carries the new fields and <=100m
        for u in users:
            assert u["distance"] <= 100, f"{u['name']} at {u['distance']}m exceeds 100m cap"
            assert "intent" in u
            assert "context" in u
            assert "tags" in u
            assert "vibe_details" in u
            assert "mutual_reason" in u
            assert "score" in u
            assert isinstance(u["score"], int)

    def test_sarah_ranks_first_and_has_career_advice_reason(self, kauri_session):
        token, _ = kauri_session
        r = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(token),
            timeout=15,
        ).json()
        users = r["users"]
        # Find Sarah
        sarah = next((u for u in users if (u.get("name") or "").startswith("Sarah")), None)
        assert sarah is not None, "Sarah must appear in Kauri's nearby list"
        # Per review: Sarah should rank FIRST for Kauri
        assert users[0]["id"] == sarah["id"], (
            f"Expected Sarah first; got {[u.get('name') for u in users[:3]]}"
        )
        assert sarah["score"] >= 8, f"Sarah score={sarah['score']} — expected ~10"
        assert "career" in (sarah.get("mutual_reason") or "").lower(), sarah.get("mutual_reason")

    def test_olivia_has_hiring_reason(self, kauri_session):
        token, _ = kauri_session
        users = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(token),
            timeout=15,
        ).json()["users"]
        olivia = next((u for u in users if (u.get("name") or "").startswith("Olivia")), None)
        assert olivia is not None
        reason = olivia.get("mutual_reason") or ""
        assert "hiring" in reason.lower(), reason
        assert "Frontend Developer" in reason or "Product Designer" in reason, reason


# ------------------------------ Privacy: show_recruiters ------------------------------
class TestRecruiterPrivacy:
    def test_show_recruiters_false_hides_olivia(self, kauri_session):
        token, _ = kauri_session
        # disable recruiters
        r = requests.put(
            f"{API}/users/me/state",
            json={"show_recruiters": False},
            headers=_headers(token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("show_recruiters") is False

        users = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(token),
            timeout=15,
        ).json()["users"]
        names = [u.get("name") for u in users]
        assert not any("Olivia" in (n or "") for n in names), f"Olivia should be hidden — got {names}"

    def test_reset_show_recruiters_true(self, kauri_session):
        token, _ = kauri_session
        r = requests.put(
            f"{API}/users/me/state",
            json={"show_recruiters": True},
            headers=_headers(token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("show_recruiters") is True

        users = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(token),
            timeout=15,
        ).json()["users"]
        assert any("Olivia" in (u.get("name") or "") for u in users), "Olivia should reappear"


# ------------------------------ Visibility hidden ------------------------------
class TestVibeDetailsVisibility:
    def test_james_hidden_visibility_masks_details_for_others(self, james_session, kauri_session):
        j_token, _ = james_session
        # Set James -> hidden
        r = requests.put(
            f"{API}/users/me/vibe-details",
            json={"details": {"intent": "Founder / Networking", "visibility": "hidden", "tags": ["Startups"]}},
            headers=_headers(j_token),
            timeout=15,
        )
        assert r.status_code == 200

        # As Kauri, check James in nearby
        k_token, _ = kauri_session
        users = requests.get(
            f"{API}/nearby",
            params={"lat": KAURI_LAT, "lng": KAURI_LNG},
            headers=_headers(k_token),
            timeout=15,
        ).json()["users"]
        james = next((u for u in users if (u.get("name") or "").startswith("James")), None)
        assert james is not None, "James should still be in nearby (visibility != profile hide)"
        # vibe_details should be empty / masked
        vd = james.get("vibe_details") or {}
        assert vd == {} or vd.get("intent") is None, f"expected masked vibe_details, got {vd}"
        assert not james.get("tags"), f"tags should be empty for hidden visibility, got {james.get('tags')}"

    def test_reset_james_visibility_public(self, james_session):
        j_token, _ = james_session
        r = requests.put(
            f"{API}/users/me/vibe-details",
            json={
                "details": {
                    "intent": "Founder / Networking",
                    "professional_identity": "Founder",
                    "industry": "Fintech",
                    "experience_level": "5-10 years",
                    "context": "Fintech founder open to meeting operators and marketers.",
                    "background": "Startup founder in fintech",
                    "looking_for": ["Tech contacts", "Investors", "Marketing advice"],
                    "can_help_with": ["Finance", "Startups", "Product strategy"],
                    "tags": ["Startups", "Finance", "Tech"],
                    "visibility": "public",
                }
            },
            headers=_headers(j_token),
            timeout=15,
        )
        assert r.status_code == 200


# ------------------------------ Saved for later ------------------------------
class TestSavedForLater:
    def test_full_save_cycle(self, kauri_session, sarah_session):
        k_token, _ = kauri_session
        _, sarah = sarah_session
        sarah_id = sarah["id"]

        # Clean any prior save
        requests.delete(f"{API}/saved/{sarah_id}", headers=_headers(k_token), timeout=15)

        # POST save
        r = requests.post(
            f"{API}/saved",
            json={"user_id": sarah_id, "distance": 25},
            headers=_headers(k_token),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # GET saved
        saved = requests.get(f"{API}/saved", headers=_headers(k_token), timeout=15).json()
        entry = next((s for s in saved if s["id"] == sarah_id), None)
        assert entry is not None
        assert entry["distance_at_save"] == 25
        assert entry["saved_at"]
        assert entry.get("intent")  # Sarah's intent should be surfaced

        # Duplicate POST — should not create a second row
        requests.post(
            f"{API}/saved",
            json={"user_id": sarah_id, "distance": 25},
            headers=_headers(k_token),
            timeout=15,
        )
        saved2 = requests.get(f"{API}/saved", headers=_headers(k_token), timeout=15).json()
        matches = [s for s in saved2 if s["id"] == sarah_id]
        assert len(matches) == 1, f"duplicate POST created {len(matches)} rows"

        # DELETE
        r = requests.delete(f"{API}/saved/{sarah_id}", headers=_headers(k_token), timeout=15)
        assert r.status_code == 200
        saved3 = requests.get(f"{API}/saved", headers=_headers(k_token), timeout=15).json()
        assert not any(s["id"] == sarah_id for s in saved3)


# ------------------------------ Pings payload ------------------------------
class TestPingPayload:
    def test_pings_include_reason_context_intent(self, kauri_session):
        token, _ = kauri_session
        # ensure visible
        requests.put(
            f"{API}/users/me/state",
            json={"visible": True, "vibe": "networking"},
            headers=_headers(token),
            timeout=15,
        )
        # try up to 6 generate attempts to force a ping
        got = None
        for _ in range(6):
            requests.post(
                f"{API}/pings/generate",
                params={"lat": KAURI_LAT, "lng": KAURI_LNG},
                headers=_headers(token),
                timeout=15,
            )
            pings = requests.get(f"{API}/pings", headers=_headers(token), timeout=15).json()
            if pings:
                got = pings[0]
                break
        assert got is not None, "expected at least one ping after 6 generate attempts"
        # spec: payload includes reason/context/intent fields (may be None but keys present)
        assert "reason" in got
        assert "context" in got
        assert "intent" in got

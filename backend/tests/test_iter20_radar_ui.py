"""Iteration 20 — Professional Radar UI spot-check.
Verifies backend surface used by the new map-first ProfessionalHome:
  - GET /api/professionals now includes 'bearing' (per review request)
  - Existing filters (category, available_now) still work
  - /connect/request pending flow works from a viewer to a verified pro
  - /help-requests, /professional/requests unchanged surface
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")


def _login(email: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={"email": email}, timeout=15)
    assert r.status_code == 200, f"demo-login {email} failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j["token"]["access_token"]


@pytest.fixture(scope="module")
def demo_token():
    return _login("demo@intro.demo")


@pytest.fixture(scope="module")
def sana_token():
    return _login("sana@radar.intro.demo")


@pytest.fixture(scope="module")
def jade_token():
    return _login("jade@radar.intro.demo")


def _auth(token): return {"Authorization": f"Bearer {token}"}


# --- /api/professionals: 'bearing' field ------------------------------------
class TestProfessionalsBearing:
    def test_bearing_present_in_all_pros(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200, r.text
        pros = r.json().get("professionals", [])
        assert len(pros) > 0, "expected at least 1 verified pro"
        missing = [p for p in pros if "bearing" not in p]
        assert not missing, f"pros missing 'bearing' field: {[p.get('name') for p in missing]}"
        # bearing should be numeric or None; if numeric, in [0, 360]
        for p in pros:
            b = p["bearing"]
            assert b is None or (isinstance(b, (int, float)) and 0 <= b < 360), f"bad bearing {b} on {p.get('name')}"

    def test_bearing_used_only_when_present(self, demo_token):
        """Bearing must be present (key exists) even if value can be None; distance always present."""
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631", headers=_auth(demo_token), timeout=15)
        pros = r.json().get("professionals", [])
        for p in pros:
            assert "bearing" in p and "distance" in p

    def test_only_verified_pros_listed(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631", headers=_auth(demo_token), timeout=15)
        pros = r.json().get("professionals", [])
        for p in pros:
            assert p.get("verified_by_intro") is True, f"{p.get('name')} is not verified but is listed"

    def test_category_filter_still_works(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631&category=HR", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        pros = r.json().get("professionals", [])
        assert all(p.get("primary_category") == "HR" for p in pros), "HR filter returned non-HR pros"

    def test_available_now_filter_still_works(self, demo_token):
        r_all = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631", headers=_auth(demo_token), timeout=15).json().get("professionals", [])
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631&available_now=true", headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200
        pros = r.json().get("professionals", [])
        # active_now filter is applied server-side; result must be subset of full list
        ids_all = {p["user_id"] for p in r_all}
        ids_now = {p["user_id"] for p in pros}
        assert ids_now.issubset(ids_all)
        for p in pros:
            assert p.get("active_now") is True, f"{p.get('name')} active_now={p.get('active_now')}"


# --- Request Help flow from Preview sheet -----------------------------------
class TestPreviewRequestHelp:
    def test_pending_ping_created(self, demo_token):
        pros = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631", headers=_auth(demo_token), timeout=15).json()["professionals"]
        # pick a verified pro that isn't already connected to the demo user
        target = next((p for p in pros if p.get("verified_by_intro")), None)
        assert target, "need at least one verified pro"
        target_id = target["user_id"]
        r = requests.post(f"{BASE_URL}/api/connect/request", json={"user_id": target_id}, headers=_auth(demo_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") in ("pending", "connected"), f"unexpected status {body}"
        # verify GET /api/connect/requests shows outgoing/relevant record
        pings = requests.get(f"{BASE_URL}/api/connect/requests", headers=_auth(demo_token), timeout=15)
        assert pings.status_code == 200
        outgoing = pings.json().get("outgoing", [])
        # if pending, expect outgoing entry to reference the target
        if body["status"] == "pending":
            found = any((p.get("to_user_id") == target_id) or (p.get("user_id") == target_id) or (p.get("target_user_id") == target_id) for p in outgoing)
            assert found, f"no outgoing pending entry found for target {target_id}. outgoing sample: {outgoing[:1]}"

    def test_demo_reset_restores_state(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/demo/reset", headers=_auth(demo_token), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True or "reset" in str(body).lower() or "seeded" in str(body).lower()


# --- Can Help surface (unverified vs verified) ------------------------------
class TestCanHelpGating:
    def test_sana_verified_sees_requests(self, sana_token):
        r = requests.get(f"{BASE_URL}/api/professional/requests?lat=-37.8136&lng=144.9631", headers=_auth(sana_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("verification_required") in (False, None)
        assert isinstance(body.get("requests"), list)

    def test_jade_unverified_gated(self, jade_token):
        r = requests.get(f"{BASE_URL}/api/professional/requests?lat=-37.8136&lng=144.9631", headers=_auth(jade_token), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("verification_required") is True
        assert body.get("requests") == []

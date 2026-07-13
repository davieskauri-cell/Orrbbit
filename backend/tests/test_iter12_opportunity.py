"""Iteration 12 — Opportunity vibe feature tests.

Verifies:
  1. GET /api/vibes contains opportunity vibe entry.
  2. GET /api/nearby (as kauri) returns the 5 opportunity demo users and NEVER leaks private_details.
  3. GET /api/opportunity/{priya_id} lock/unlock flow (before/after POST /api/matches).
  4. PUT /api/users/me/vibe-details rejects banned terms (400) but accepts normal payloads.

Cleanup: any kauri matches created in test 3 are deleted directly from mongo at teardown.
"""
import os
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
MEL_LAT, MEL_LNG = -37.8136, 144.9631

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def kauri_ctx():
    """Login as kauri via demo-login and return (token, user_id, headers)."""
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    assert tok
    user = body.get("user") or {}
    uid = user.get("id")
    hdrs = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    if not uid:
        me = requests.get(f"{BASE_URL}/api/users/me", headers=hdrs)
        assert me.status_code == 200
        uid = me.json()["id"]
    return {"token": tok, "id": uid, "headers": hdrs}


# ---------- 1. Vibes list ----------
class TestVibesList:
    def test_vibes_include_opportunity(self):
        r = requests.get(f"{BASE_URL}/api/vibes")
        assert r.status_code == 200
        vibes = r.json()
        assert isinstance(vibes, list)
        opp = next((v for v in vibes if v.get("key") == "opportunity"), None)
        assert opp is not None, "opportunity vibe missing"
        assert opp["label"] == "Opportunity"
        assert opp["color"] == "#F59E0B"
        assert opp["icon"] == "sparkles"


# ---------- 2. Nearby exposes public opportunity info but not private_details ----------
class TestNearbyOpportunityUsers:
    def test_five_opportunity_users_in_nearby(self, kauri_ctx):
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_ctx["headers"],
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200
        users = r.json()["users"]
        opp_users = [u for u in users if u.get("vibe") == "opportunity"]
        # 5 expected: Priya + Dev + Sana + Jade + Marco (all within 500m)
        assert len(opp_users) >= 5, f"expected 5 opportunity users, got {len(opp_users)}"
        names = {u.get("name") for u in opp_users}
        expected = {"Priya", "Dev", "Sana", "Jade", "Marco"}
        assert expected.issubset(names), f"missing opportunity users: {expected - names}"

    def test_nearby_never_leaks_private_details(self, kauri_ctx):
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_ctx["headers"],
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200
        users = r.json()["users"]
        for u in users:
            vd = u.get("vibe_details") or {}
            assert "private_details" not in vd, (
                f"private_details leaked in nearby for user {u.get('id')} / {u.get('name')}"
            )

    def test_priya_public_summary_visible_in_nearby(self, kauri_ctx):
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_ctx["headers"],
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        users = r.json()["users"]
        priya = next((u for u in users if u.get("name") == "Priya"), None)
        assert priya is not None
        vd = priya.get("vibe_details") or {}
        # public_summary or intent should surface something readable
        summary = vd.get("public_summary") or priya.get("intent") or vd.get("intent")
        assert summary, "expected public summary or intent for Priya"
        assert priya.get("distance") is not None
        assert priya.get("distance") <= 500


# ---------- 3. GET /api/opportunity/{id} + lock/unlock via POST /api/matches ----------
class TestOpportunityLockUnlock:
    @pytest.fixture(autouse=True)
    def _cleanup(self, mongo_db, kauri_ctx):
        # Runs before AND after each test in this class: drop kauri's matches so demo is clean.
        uid = kauri_ctx["id"]
        mongo_db.matches.delete_many({"$or": [{"user_a": uid}, {"user_b": uid}]})
        yield
        mongo_db.matches.delete_many({"$or": [{"user_a": uid}, {"user_b": uid}]})

    def _priya_id(self, kauri_ctx):
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_ctx["headers"],
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200
        priya = next(
            (u for u in r.json()["users"] if u.get("name") == "Priya" and u.get("vibe") == "opportunity"),
            None,
        )
        assert priya, "priya not in kauri's nearby list"
        return priya["id"]

    def test_locked_before_match(self, kauri_ctx):
        priya_id = self._priya_id(kauri_ctx)
        r = requests.get(
            f"{BASE_URL}/api/opportunity/{priya_id}",
            headers=kauri_ctx["headers"],
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["connected"] is False
        assert body["private_details"] is None
        opp = body["opportunity"]
        assert opp["opportunity_type"] == "Need help"
        assert opp["category"] == "Business"
        assert "staff" in (opp["public_summary"] or "").lower()

    def test_unlocked_after_match(self, kauri_ctx):
        priya_id = self._priya_id(kauri_ctx)
        # Create match
        m = requests.post(
            f"{BASE_URL}/api/matches",
            headers=kauri_ctx["headers"],
            json={"user_id": priya_id},
        )
        assert m.status_code == 200, m.text
        # Re-fetch opportunity
        r = requests.get(
            f"{BASE_URL}/api/opportunity/{priya_id}",
            headers=kauri_ctx["headers"],
        )
        assert r.status_code == 200
        body = r.json()
        assert body["connected"] is True, "expected connected=True after match"
        pd = body["private_details"]
        assert pd, "expected private_details to unlock after match"
        assert "business" in pd.lower() or "hr" in pd.lower()


# ---------- 4. Banned terms validation ----------
class TestBannedTerms:
    def test_banned_public_summary_rejected(self, kauri_ctx):
        r = requests.put(
            f"{BASE_URL}/api/users/me/vibe-details",
            headers=kauri_ctx["headers"],
            json={"details": {"public_summary": "selling a gun"}},
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "prohibit" in r.text.lower() or "not allowed" in r.text.lower()

    def test_normal_opportunity_details_saved(self, kauri_ctx):
        # save an innocuous opportunity payload
        payload = {
            "opportunity_type": "Need help",
            "category": "Tech",
            "public_summary": "Need a hand with a small landing page",
            "private_details": "React devs preferred, one weekend of work.",
            "payment": "Open to paying",
        }
        r = requests.put(
            f"{BASE_URL}/api/users/me/vibe-details",
            headers=kauri_ctx["headers"],
            json={"details": payload},
        )
        assert r.status_code == 200, r.text
        # Restore kauri to networking demo details by wiping opportunity keys
        # NOTE: main-agent hint said restart backend for full seed re-apply,
        # but for the demo state this test flow leaves kauri opportunity
        # details in place — we clean up in module teardown below.

    @classmethod
    def teardown_class(cls):
        """Restart backend to re-seed kauri's original vibe & details."""
        try:
            import subprocess
            subprocess.run(["sudo", "supervisorctl", "restart", "backend"], timeout=30)
        except Exception:
            pass

"""Backend tests — NEW safety / trial-readiness features (iteration 3).

Covers:
- PUT /api/users/me/state visibility_expires_at + quiet_mode + trial_mode_active persistence
- POST /api/pings/generate returns null when quiet_mode=true
- GET /api/nearby users include verified + active_now fields with expected values
- POST /api/feedback + GET /api/metrics (11 counters, conversations_confirmed)
- POST /api/analytics profile_view increments profile_views metric
- GET /api/trial returns Southbank Social Trial event + active flag
- POST /api/blocks also ends any active meetup between the two users
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

LAT = -37.8136  # Melbourne CBD demo location
LNG = 144.9631
TIMEOUT = 20


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def kauri_headers():
    r = requests.post(f"{API}/auth/demo-login", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    hdrs = _auth(tok)
    # ensure baseline
    requests.put(f"{API}/users/me/state", headers=hdrs, json={
        "vibe": "networking", "radius": 50, "visible": True,
        "ghost_mode": False, "paused": False, "quiet_mode": False,
        "only_same_vibe": False, "verified_only": False,
        "trial_mode_active": False, "lat": LAT, "lng": LNG,
    }, timeout=TIMEOUT)
    yield hdrs
    # restore
    requests.put(f"{API}/users/me/state", headers=hdrs, json={
        "vibe": "networking", "radius": 50, "visible": True,
        "ghost_mode": False, "paused": False, "quiet_mode": False,
        "only_same_vibe": False, "verified_only": False,
        "trial_mode_active": False,
    }, timeout=TIMEOUT)


# ------------------------- state / visibility -------------------------
class TestStateVisibility:
    def test_visible_for_15_sets_expiry_15min_ahead(self, kauri_headers):
        before = datetime.now(timezone.utc)
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"visible": True, "visible_for": 15}, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body["visible"] is True
        exp = body.get("visibility_expires_at")
        assert exp, "visibility_expires_at missing"
        exp_dt = datetime.fromisoformat(exp)
        delta_min = (exp_dt - before).total_seconds() / 60.0
        assert 14.5 <= delta_min <= 15.5, f"expected ~15min ahead, got {delta_min:.2f}m"

    def test_quiet_mode_persists(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"quiet_mode": True}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["quiet_mode"] is True
        # GET verifies persistence
        me = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT).json()
        assert me["quiet_mode"] is True

    def test_ping_generate_returns_null_when_quiet_mode(self, kauri_headers):
        # quiet_mode already true from previous test
        r = requests.post(f"{API}/pings/generate", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ping") is None
        # reset
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"quiet_mode": False}, timeout=TIMEOUT)
        me = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT).json()
        assert me["quiet_mode"] is False

    def test_trial_mode_active_persists(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"trial_mode_active": True}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["trial_mode_active"] is True
        me = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT).json()
        assert me["trial_mode_active"] is True
        # reset
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"trial_mode_active": False}, timeout=TIMEOUT)


# ------------------------- nearby verified / active_now -------------------------
class TestNearbyVerified:
    EXPECTED_VERIFIED = {"James", "Olivia", "Mia", "Sophie", "Ryan"}
    EXPECTED_UNVERIFIED = {"Sarah", "Jake", "Liam", "Emily"}

    def test_nearby_users_include_verified_and_active_now(self, kauri_headers):
        # widen radius to 100 to include Ryan + Emily
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"radius": 100, "vibe": "networking"}, timeout=TIMEOUT)
        r = requests.get(f"{API}/nearby", headers=kauri_headers,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        users = r.json()["users"]
        for u in users:
            assert "verified" in u, f"verified missing on {u.get('name')}"
            assert "active_now" in u, f"active_now missing on {u.get('name')}"
            assert isinstance(u["verified"], bool)
            assert isinstance(u["active_now"], bool)
        by_name = {u["name"]: u for u in users if u.get("is_demo")}
        for n in self.EXPECTED_VERIFIED:
            assert n in by_name, f"{n} not in nearby users"
            assert by_name[n]["verified"] is True, f"{n} should be verified"
        for n in self.EXPECTED_UNVERIFIED:
            assert n in by_name, f"{n} not in nearby users"
            assert by_name[n]["verified"] is False, f"{n} should NOT be verified"
        # restore radius
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"radius": 50}, timeout=TIMEOUT)


# ------------------------- trial event -------------------------
class TestTrialEvent:
    def test_trial_returns_southbank_event(self, kauri_headers):
        r = requests.get(f"{API}/trial", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "event" in data
        assert "active" in data
        assert isinstance(data["active"], bool)
        e = data["event"]
        assert e["name"] == "Southbank Social Trial"
        assert e["active_users"] == 64
        for key in ("venue", "start_time", "end_time", "pings_created",
                    "mutual_accepts", "conversations_confirmed", "invite_link"):
            assert key in e, f"missing {key} in trial event"


# ------------------------- feedback + metrics + analytics -------------------------
class TestMetricsFeedbackAnalytics:
    METRIC_KEYS = {
        "demo_signups", "active_users", "vibes_selected", "pings_sent",
        "profile_views", "mutual_accepts", "meetups_started", "meetups_completed",
        "reports_submitted", "blocks", "conversations_confirmed",
    }

    def test_metrics_has_11_counters(self, kauri_headers):
        r = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == self.METRIC_KEYS, f"got {set(data.keys())}"
        for k, v in data.items():
            assert isinstance(v, int), f"{k} not int: {v}"

    def test_feedback_increments_conversations_confirmed(self, kauri_headers):
        before = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        before_count = before["conversations_confirmed"]
        r = requests.post(f"{API}/feedback", headers=kauri_headers, json={
            "spoke": "Yes, we spoke",
            "experience": "Great",
            "comments": "TEST feedback iteration_3",
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        after = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        assert after["conversations_confirmed"] >= before_count + 1
        assert after["conversations_confirmed"] >= 1

    def test_analytics_profile_view_increments(self, kauri_headers):
        before = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        r = requests.post(f"{API}/analytics", headers=kauri_headers,
                          json={"event": "profile_view"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        after = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        assert after["profile_views"] >= before["profile_views"] + 1


# ------------------------- blocks ends meetup -------------------------
class TestBlockEndsMeetup:
    """Use a freshly-registered throwaway user (not demo) so demos stay clean."""

    def test_block_ends_active_meetup(self):
        email = f"TEST_bmu_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Test1234!", "name": "TEST BlockMeetup", "age": 25,
        }, timeout=TIMEOUT)
        assert reg.status_code == 200, reg.text
        tok = reg.json()["access_token"]
        hdrs = _auth(tok)

        # position throwaway at Melbourne CBD
        requests.put(f"{API}/users/me/state", headers=hdrs, json={
            "vibe": "networking", "radius": 100, "visible": True,
            "lat": LAT, "lng": LNG,
        }, timeout=TIMEOUT)

        # find any demo user in nearby (Sarah is closest compatible not needed here)
        r = requests.get(f"{API}/nearby", headers=hdrs,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        others = [u for u in r.json()["users"] if u.get("is_demo")]
        assert others, "expected at least one demo user in nearby"
        target = next((u for u in others if u["name"] == "James"), others[0])
        target_id = target["id"]

        # start a meetup with target
        mr = requests.post(f"{API}/meetups", headers=hdrs, json={"user_id": target_id}, timeout=TIMEOUT)
        assert mr.status_code == 200
        # verify meetup active
        act = requests.get(f"{API}/meetups/active", headers=hdrs,
                           params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT).json()
        assert act["meetup"] is not None, "meetup should be active before block"
        assert act["meetup"]["user"]["id"] == target_id

        # now block that user
        br = requests.post(f"{API}/blocks", headers=hdrs, json={"user_id": target_id}, timeout=TIMEOUT)
        assert br.status_code == 200
        assert br.json().get("ok") is True

        # active meetup must now be None
        act2 = requests.get(f"{API}/meetups/active", headers=hdrs,
                            params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT).json()
        assert act2["meetup"] is None, "block should have ended the active meetup"

        # cleanup: hide throwaway user so it doesn't pollute other tests
        requests.put(f"{API}/users/me/state", headers=hdrs, json={
            "visible": False, "lat": None, "lng": None,
        }, timeout=TIMEOUT)

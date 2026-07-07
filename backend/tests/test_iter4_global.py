"""Backend tests — iteration_4 Global-scale features.

Covers:
- GET /api/cities (cities + zones)
- GET /api/ambassador
- GET /api/campus
- GET /api/communities
- GET /api/events/demo (auth) returns event + active
- GET /api/trial-report (auth)
- GET /api/north-star (auth)
- GET /api/metrics (auth) — new keys: waitlist_signups, ambassador_invites, event_joins, signups_by_city
- POST /api/waitlist (public, no auth)
- PUT /api/users/me/state accepts mode/city/intent and echoes them back
- GET /api/demo-accounts returns city, mode, verified per row
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TIMEOUT = 20


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def kauri_headers():
    r = requests.post(f"{API}/auth/demo-login", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    hdrs = _auth(tok)
    yield hdrs
    # restore Kauri baseline
    requests.put(f"{API}/users/me/state", headers=hdrs, json={
        "mode": "Social", "city": "Melbourne", "vibe": "networking",
        "radius": 50, "visible": True, "quiet_mode": False,
    }, timeout=TIMEOUT)


# ---------- Public global endpoints ----------
class TestPublicGlobalEndpoints:
    def test_cities_returns_cities_and_zones(self):
        r = requests.get(f"{API}/cities", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data and "zones" in data
        assert isinstance(data["cities"], list) and len(data["cities"]) >= 3
        names = {c["name"] for c in data["cities"]}
        for expected in ("Melbourne", "London", "Sydney"):
            assert expected in names
        melb = next(c for c in data["cities"] if c["name"] == "Melbourne")
        for k in ("status", "zones", "active_today", "pings", "matches", "conversations"):
            assert k in melb
        assert isinstance(data["zones"], list) and len(data["zones"]) >= 3
        for z in data["zones"]:
            assert "name" in z and "active_users" in z and "top_vibe" in z

    def test_communities_returns_list(self):
        r = requests.get(f"{API}/communities", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 5
        for c in data:
            assert {"name", "nearby", "events"}.issubset(c.keys())

    def test_ambassador_returns_stats(self):
        r = requests.get(f"{API}/ambassador", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        for k in ("name", "city", "invites", "signups", "tasks"):
            assert k in data
        assert isinstance(data["tasks"], list) and len(data["tasks"]) >= 3

    def test_campus_returns_vibes(self):
        r = requests.get(f"{API}/campus", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "name" in data and "active_users" in data and "vibes" in data
        assert isinstance(data["vibes"], list) and len(data["vibes"]) >= 2


# ---------- Authed global endpoints ----------
class TestAuthedGlobalEndpoints:
    def test_events_demo_requires_auth(self):
        r = requests.get(f"{API}/events/demo", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_events_demo_with_auth(self, kauri_headers):
        r = requests.get(f"{API}/events/demo", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "event" in data and "active" in data
        assert isinstance(data["active"], bool)
        e = data["event"]
        for k in ("name", "location", "active_users", "pings"):
            assert k in e

    def test_trial_report(self, kauri_headers):
        r = requests.get(f"{API}/trial-report", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        for k in ("event", "city", "date", "active_users", "pings_sent",
                  "mutual_accepts", "meetups_started", "conversations_confirmed",
                  "feedback_summary", "safety_reports", "blocks", "key_learnings"):
            assert k in data, f"missing {k}"
        assert isinstance(data["key_learnings"], list) and len(data["key_learnings"]) >= 1

    def test_north_star(self, kauri_headers):
        r = requests.get(f"{API}/north-star", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        for k in ("today", "this_week", "this_city", "this_event", "total"):
            assert k in data and isinstance(data[k], int)

    def test_metrics_has_new_global_counters(self, kauri_headers):
        r = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        for k in ("waitlist_signups", "ambassador_invites", "event_joins", "signups_by_city"):
            assert k in data, f"missing {k} in metrics"
        assert isinstance(data["signups_by_city"], dict)
        assert isinstance(data["waitlist_signups"], int)
        assert isinstance(data["ambassador_invites"], int)
        assert isinstance(data["event_joins"], int)
        # Melbourne always present as demo users seeded
        assert "Melbourne" in data["signups_by_city"]


# ---------- Waitlist ----------
class TestWaitlist:
    def test_waitlist_post_ok(self):
        payload = {
            "name": "TEST Waitlist User",
            "email": f"TEST_wl_{uuid.uuid4().hex[:8]}@intro.example",
            "city": "London",
            "country": "United Kingdom",
            "ambassador": True,
        }
        r = requests.post(f"{API}/waitlist", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_waitlist_increments_metric(self, kauri_headers):
        before = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        b = before["waitlist_signups"]
        r = requests.post(f"{API}/waitlist", json={
            "name": "TEST Waitlist2", "email": f"TEST_wl_{uuid.uuid4().hex[:8]}@intro.example",
            "city": "Melbourne", "ambassador": False,
        }, timeout=TIMEOUT)
        assert r.status_code == 200
        after = requests.get(f"{API}/metrics", headers=kauri_headers, timeout=TIMEOUT).json()
        assert after["waitlist_signups"] >= b + 1


# ---------- State: mode/city/intent ----------
class TestStateModeCityIntent:
    def test_set_mode(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"mode": "Networking"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("mode") == "Networking"
        me = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT).json()
        assert me["mode"] == "Networking"

    def test_set_city(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"city": "Melbourne"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("city") == "Melbourne"

    def test_set_intent(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                         json={"intent": "Meet new people"}, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("intent") == "Meet new people"
        me = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT).json()
        assert me["intent"] == "Meet new people"


# ---------- Demo accounts filters ----------
class TestDemoAccountsFields:
    def test_demo_accounts_have_city_mode_verified(self):
        r = requests.get(f"{API}/demo-accounts", timeout=TIMEOUT)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 8
        for row in rows:
            for k in ("email", "name", "city", "mode", "verified"):
                assert k in row, f"row missing {k}: {row}"
            assert isinstance(row["verified"], bool)
        # global users appear (Amelia London etc.)
        by_email = {r["email"]: r for r in rows}
        assert "amelia@intro.demo" in by_email
        assert by_email["amelia@intro.demo"]["city"] == "London"
        # Kauri should be Melbourne
        assert by_email["kauri@intro.demo"]["city"] == "Melbourne"

"""Backend API tests for INTRO — proximity-based social app.

Covers: auth (demo-login, register 18+, login), profile/state (radius clamp),
nearby (compat + radius filter), pings (generate/list/dismiss/accept -> match),
matches, meetups (start/active/end), encounters, demo-accounts, vibes,
blocks/reports (using a throwaway registered user so demo accounts stay clean).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

DEMO_PASSWORD = "Intro123!"
LAT = -37.8136  # Melbourne CBD
LNG = 144.9631

TIMEOUT = 20

# module-level shared state across TestPings tests
_state = {}


# --------------------------- fixtures ---------------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def kauri(session):
    r = session.post(f"{API}/auth/demo-login", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == "kauri@intro.demo"
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def kauri_headers(kauri):
    return _auth(kauri[0])


@pytest.fixture(scope="module", autouse=True)
def _reset_kauri_state(kauri_headers):
    """Ensure Kauri starts with networking, radius 50, visible True."""
    requests.put(f"{API}/users/me/state", headers=kauri_headers, json={
        "vibe": "networking", "radius": 50, "visible": True,
        "ghost_mode": False, "paused": False, "only_same_vibe": False,
        "verified_only": False, "lat": LAT, "lng": LNG,
    }, timeout=TIMEOUT)
    yield
    # restore
    requests.put(f"{API}/users/me/state", headers=kauri_headers, json={
        "vibe": "networking", "radius": 50, "visible": True,
        "ghost_mode": False, "paused": False, "only_same_vibe": False,
        "verified_only": False,
    }, timeout=TIMEOUT)


# --------------------------- health ---------------------------
def test_root(session):
    r = session.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    assert "message" in r.json()


# --------------------------- auth ---------------------------
class TestAuth:
    def test_demo_login_empty_body_is_kauri(self, session):
        r = session.post(f"{API}/auth/demo-login", json={}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "kauri@intro.demo"
        assert r.json()["user"]["name"] == "Kauri"

    def test_demo_login_by_email(self, session):
        r = session.post(f"{API}/auth/demo-login", json={"email": "james@intro.demo"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "james@intro.demo"

    def test_demo_login_unknown_email(self, session):
        r = session.post(f"{API}/auth/demo-login", json={"email": "nobody@intro.demo"}, timeout=TIMEOUT)
        assert r.status_code == 404

    def test_register_rejects_under_18(self, session):
        payload = {
            "email": f"TEST_minor_{uuid.uuid4().hex[:8]}@intro.example",
            "password": "Test1234!", "name": "TEST Minor", "age": 17,
        }
        r = session.post(f"{API}/auth/register", json=payload, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_register_and_login_18plus(self, session):
        email = f"TEST_user_{uuid.uuid4().hex[:8]}@intro.example"
        payload = {"email": email, "password": "Test1234!", "name": "TEST User", "age": 22}
        r = session.post(f"{API}/auth/register", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()
        # login
        r2 = session.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"}, timeout=TIMEOUT)
        assert r2.status_code == 200
        # wrong password
        r3 = session.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=TIMEOUT)
        assert r3.status_code == 401

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_me_returns_current(self, kauri_headers):
        r = requests.get(f"{API}/auth/me", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["email"] == "kauri@intro.demo"


# --------------------------- vibes / demo accounts ---------------------------
class TestReferenceData:
    def test_vibes(self, session):
        r = session.get(f"{API}/vibes", timeout=TIMEOUT)
        assert r.status_code == 200
        vibes = r.json()
        assert len(vibes) == 8
        keys = {v["key"] for v in vibes}
        assert {"open_to_chat", "relationship", "coffee_drinks", "networking",
                "need_advice", "gym_buddy", "exploring", "busy"} <= keys

    def test_demo_accounts(self, session):
        r = session.get(f"{API}/demo-accounts", timeout=TIMEOUT)
        assert r.status_code == 200
        accounts = r.json()
        assert len(accounts) == 10
        emails = {a["email"] for a in accounts}
        for e in ["kauri", "james", "sarah", "olivia", "jake", "mia",
                  "liam", "sophie", "ryan", "emily"]:
            assert f"{e}@intro.demo" in emails


# --------------------------- nearby ---------------------------
class TestNearby:
    def test_nearby_radius_50_kauri_networking(self, kauri_headers):
        # ensure networking + 50m radius
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"vibe": "networking", "radius": 50}, timeout=TIMEOUT)
        r = requests.get(f"{API}/nearby", headers=kauri_headers,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["radius"] == 50
        assert data["my_vibe"] == "networking"
        users = data["users"]
        # 7 demo users are <=50m (excluding Kauri, Ryan 78, Emily 94)
        demo_users = [u for u in users if u.get("is_demo")]
        assert len(demo_users) == 7, f"expected 7 demo got {len(demo_users)}: {[u['name'] for u in demo_users]}"
        # sorted by distance
        dists = [u["distance"] for u in users]
        assert dists == sorted(dists)
        # compat for networking: networking, open_to_chat, need_advice
        compat_names = {u["name"] for u in demo_users if u["compatible"]}
        assert {"Sarah", "James", "Sophie", "Olivia"} <= compat_names

    def test_nearby_radius_100_reveals_ryan_emily(self, kauri_headers):
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"radius": 100}, timeout=TIMEOUT)
        r = requests.get(f"{API}/nearby", headers=kauri_headers,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["radius"] == 100
        demo_users = [u for u in data["users"] if u.get("is_demo")]
        names = {u["name"] for u in demo_users}
        assert "Ryan" in names
        assert "Emily" in names
        assert len(demo_users) == 9

    def test_radius_clamped_to_100_max(self, kauri_headers):
        r = requests.put(f"{API}/users/me/state", headers=kauri_headers,
                        json={"radius": 500}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["radius"] == 100

    def test_radius_10_returns_zero_users(self, kauri_headers):
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"radius": 10}, timeout=TIMEOUT)
        r = requests.get(f"{API}/nearby", headers=kauri_headers,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        demo_users = [u for u in r.json()["users"] if u.get("is_demo")]
        assert len(demo_users) == 0
        # restore
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"radius": 50}, timeout=TIMEOUT)


# --------------------------- pings ---------------------------
class TestPings:
    def test_generate_ping_closest_compatible(self, kauri_headers, session):
        # cleanup: clear any existing pings for Kauri via dismiss loop
        r0 = requests.get(f"{API}/pings", headers=kauri_headers, timeout=TIMEOUT).json()
        for p in r0:
            requests.post(f"{API}/pings/{p['id']}/dismiss", headers=kauri_headers, timeout=TIMEOUT)

        # ensure networking, radius 50
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"vibe": "networking", "radius": 50}, timeout=TIMEOUT)

        r = requests.post(f"{API}/pings/generate", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        ping = r.json().get("ping")
        assert ping is not None, "expected a compatible ping"
        # Ping must be compatible with Kauri's networking vibe
        assert ping["vibe"] in {"networking", "open_to_chat", "need_advice"}, \
            f"expected compatible vibe, got {ping['vibe']}"
        _state["first_ping_id"] = ping["id"]
        _state["first_ping_user_id"] = ping["user"]["id"]

    def test_generate_ping_within_2min_skips_same_user(self, kauri_headers):
        # second call within 2 mins should NOT re-ping Sarah — either different or None
        r = requests.post(f"{API}/pings/generate", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        p = r.json().get("ping")
        if p is not None:
            assert p["user"]["id"] != _state["first_ping_user_id"]

    def test_list_pings(self, kauri_headers):
        r = requests.get(f"{API}/pings", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        pings = r.json()
        assert any(p["id"] == _state["first_ping_id"] for p in pings)

    def test_dismiss_ping(self, kauri_headers):
        r = requests.post(f"{API}/pings/{_state['first_ping_id']}/dismiss",
                          headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # verify status changed
        pings = requests.get(f"{API}/pings", headers=kauri_headers, timeout=TIMEOUT).json()
        found = [p for p in pings if p["id"] == _state["first_ping_id"]]
        assert found and found[0]["status"] == "dismissed"

    def test_accept_ping_creates_match(self, kauri_headers):
        # Need a fresh ping — try to generate; if throttled, create one via matches directly
        # For accept test we need an accept-able ping (not dismissed and from a different user)
        # Kauri already has Sarah dismissed — issue another generate after clearing throttle by using another vibe swap trick isn't possible; instead just test /matches endpoint
        # Try to generate for another candidate
        r = requests.post(f"{API}/pings/generate", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        p = r.json().get("ping")
        if p is None:
            pytest.skip("no new ping available to accept in throttle window")
        acc = requests.post(f"{API}/pings/{p['id']}/accept",
                            headers=kauri_headers, timeout=TIMEOUT)
        assert acc.status_code == 200
        match = acc.json()["match"]
        assert match["active"] is True
        assert "id" in match


# --------------------------- matches & meetups ---------------------------
class TestMatchesMeetups:
    def test_create_match_and_meetup_flow(self, kauri_headers, session):
        # find James id via demo-login
        j = session.post(f"{API}/auth/demo-login", json={"email": "james@intro.demo"}, timeout=TIMEOUT).json()
        james_id = j["user"]["id"]

        # create match
        r = requests.post(f"{API}/matches", headers=kauri_headers,
                          json={"user_id": james_id}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["match"]["active"] is True

        # start meetup
        r2 = requests.post(f"{API}/meetups", headers=kauri_headers,
                           json={"user_id": james_id}, timeout=TIMEOUT)
        assert r2.status_code == 200
        meetup = r2.json()
        assert "expires_at" in meetup
        _state["meetup_id"] = meetup["id"]

        # active meetup returns other user + distance
        r3 = requests.get(f"{API}/meetups/active", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r3.status_code == 200
        m = r3.json()["meetup"]
        assert m is not None
        assert m["user"]["name"] == "James"
        assert m["distance"] == 32  # James is 32m in demo data

        # end meetup
        r4 = requests.post(f"{API}/meetups/{_state['meetup_id']}/end",
                           headers=kauri_headers, timeout=TIMEOUT)
        assert r4.status_code == 200
        # verify inactive
        r5 = requests.get(f"{API}/meetups/active", headers=kauri_headers,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r5.json()["meetup"] is None


# --------------------------- encounters ---------------------------
class TestEncounters:
    def test_encounters_lists_demo_with_compat(self, kauri_headers):
        # ensure networking
        requests.put(f"{API}/users/me/state", headers=kauri_headers,
                     json={"vibe": "networking"}, timeout=TIMEOUT)
        r = requests.get(f"{API}/encounters", headers=kauri_headers, timeout=TIMEOUT)
        assert r.status_code == 200
        enc = r.json()
        assert len(enc) >= 9  # all demo users except Kauri (10-1)
        # each has minutes_ago + compatible
        for e in enc:
            assert "minutes_ago" in e
            assert "compatible" in e
        # Sarah/James/Olivia/Sophie should be compatible for networking
        names_compat = {e["name"] for e in enc if e["compatible"]}
        assert {"Sarah", "James", "Olivia", "Sophie"} <= names_compat


# --------------------------- blocks / reports (throwaway user) ---------------------------
class TestBlocksReports:
    """Use a freshly-registered throwaway user so demo accounts stay clean."""

    def test_block_hides_user_from_nearby_and_pings(self, session):
        email = f"TEST_block_{uuid.uuid4().hex[:8]}@intro.example"
        reg = session.post(f"{API}/auth/register", json={
            "email": email, "password": "Test1234!", "name": "TEST Blocker", "age": 25,
        }, timeout=TIMEOUT)
        assert reg.status_code == 200
        token = reg.json()["access_token"]
        hdrs = _auth(token)

        # set networking + radius 100 + location
        requests.put(f"{API}/users/me/state", headers=hdrs, json={
            "vibe": "networking", "radius": 100, "lat": LAT, "lng": LNG, "visible": True,
        }, timeout=TIMEOUT)

        # find Sarah in nearby
        r = requests.get(f"{API}/nearby", headers=hdrs,
                         params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        assert r.status_code == 200
        users = r.json()["users"]
        sarah = next((u for u in users if u["name"] == "Sarah"), None)
        assert sarah is not None, "Sarah must be visible before block"

        # block Sarah
        b = requests.post(f"{API}/blocks", headers=hdrs,
                         json={"user_id": sarah["id"]}, timeout=TIMEOUT)
        assert b.status_code == 200

        # nearby should no longer include Sarah
        r2 = requests.get(f"{API}/nearby", headers=hdrs,
                          params={"lat": LAT, "lng": LNG}, timeout=TIMEOUT)
        names = {u["name"] for u in r2.json()["users"]}
        assert "Sarah" not in names

        # report Sarah as well
        rep = requests.post(f"{API}/reports", headers=hdrs, json={
            "user_id": sarah["id"], "reason": "spam", "details": "TEST report",
        }, timeout=TIMEOUT)
        assert rep.status_code == 200
        assert rep.json()["ok"] is True

        # Cleanup: hide this throwaway user so it doesn't pollute subsequent nearby/ping tests
        requests.put(f"{API}/users/me/state", headers=hdrs, json={
            "visible": False, "lat": None, "lng": None,
        }, timeout=TIMEOUT)

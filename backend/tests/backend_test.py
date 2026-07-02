"""Backend API tests for ProximityRadar."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nearby-connect-93.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Existing test account
TEST_EMAIL = "tester@radar.com"
TEST_PASSWORD = "secret123"

# Melbourne-ish coordinates (used by web fallback)
LAT = -37.8136
LNG = 144.9631


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def new_user_creds():
    return {
        "email": f"test_{uuid.uuid4().hex[:10]}@radar.com",
        "password": "Password123!",
        "display_name": "TEST User",
        "bio": "TEST bio",
    }


@pytest.fixture(scope="module")
def token_and_user(session, new_user_creds):
    """Register a fresh user and return token+user."""
    r = session.post(f"{API}/auth/register", json=new_user_creds, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data["access_token"], data["user"]


@pytest.fixture(scope="module")
def auth_headers(token_and_user):
    token, _ = token_and_user
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- health ----------------
def test_root(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert "message" in r.json()


# ---------------- auth ----------------
class TestAuth:
    def test_register_duplicate_email_rejected(self, session, new_user_creds, token_and_user):
        # token_and_user already registered new_user_creds -> duplicate should fail
        r = session.post(f"{API}/auth/register", json=new_user_creds, timeout=15)
        assert r.status_code == 400

    def test_login_success_seeded_account(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=15)
        # Seed account may or may not exist; if not, register it then login
        if r.status_code != 200:
            reg = session.post(f"{API}/auth/register", json={
                "email": TEST_EMAIL, "password": TEST_PASSWORD,
                "display_name": "Tester", "bio": "seed",
            }, timeout=15)
            assert reg.status_code in (200, 400)
            r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": "wrong-pass"}, timeout=15)
        assert r.status_code == 401

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers, token_and_user):
        _, user = token_and_user
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == user["id"]
        assert data["email"] == user["email"]


# ---------------- profile / state ----------------
class TestProfileState:
    def test_update_profile(self, auth_headers):
        payload = {"display_name": "TEST Renamed", "bio": "TEST updated bio"}
        r = requests.put(f"{API}/users/me", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["display_name"] == "TEST Renamed"
        assert data["bio"] == "TEST updated bio"
        # GET verify persistence
        r2 = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r2.json()["display_name"] == "TEST Renamed"

    def test_update_state(self, auth_headers):
        payload = {"status": "open_to_chat", "lat": LAT, "lng": LNG, "visible": True, "radius": 200}
        r = requests.put(f"{API}/users/me/state", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "open_to_chat"
        assert data["radius"] == 200
        assert data["visible"] is True


# ---------------- statuses ----------------
class TestStatuses:
    def test_get_default_statuses(self, session):
        r = session.get(f"{API}/statuses", timeout=15)
        assert r.status_code == 200
        items = r.json()
        keys = {s["key"] for s in items}
        for expected in ("open_to_chat", "looking_for_relationship", "struggling", "busy"):
            assert expected in keys, f"missing default status {expected}"

    def test_add_custom_status(self, session, auth_headers):
        label = f"TEST Vibe {uuid.uuid4().hex[:6]}"
        payload = {"label": label, "description": "TEST", "color": "#FF00AA", "icon": "star"}
        r = requests.post(f"{API}/statuses", headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        created_key = r.json()["key"]
        # verify appears in list
        r2 = session.get(f"{API}/statuses", timeout=15)
        keys = {s["key"] for s in r2.json()}
        assert created_key in keys


# ---------------- nearby ----------------
class TestNearby:
    def test_nearby_requires_auth(self):
        r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG, "radius": 200}, timeout=15)
        assert r.status_code == 401

    def test_nearby_returns_mock_users_sorted(self, auth_headers):
        # ensure state is set
        requests.put(f"{API}/users/me/state", headers=auth_headers, json={
            "status": "open_to_chat", "lat": LAT, "lng": LNG, "visible": True, "radius": 200,
        }, timeout=15)
        r = requests.get(f"{API}/nearby", headers=auth_headers, params={"lat": LAT, "lng": LNG, "radius": 200}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["my_status"] == "open_to_chat"
        assert data["count"] >= 5  # 7 mocks within 200m expected
        users = data["users"]
        # Sorted by distance ascending
        distances = [u["distance"] for u in users]
        assert distances == sorted(distances)
        # Match: open_to_chat pairs with open_to_chat, looking_for_relationship, struggling
        for u in users:
            if u["is_mock"] and u["status"] in ("open_to_chat", "looking_for_relationship", "struggling"):
                assert u["is_match"] is True, f"expected match true for {u['display_name']} ({u['status']})"
            if u["is_mock"] and u["status"] == "busy":
                assert u["is_match"] is False

    def test_nearby_radius_filter(self, auth_headers):
        r = requests.get(f"{API}/nearby", headers=auth_headers, params={"lat": LAT, "lng": LNG, "radius": 50}, timeout=15)
        assert r.status_code == 200
        # Only Aria (42m) within 50m
        mock_ids = [u["id"] for u in r.json()["users"] if u["is_mock"]]
        assert "mock-1" in mock_ids
        assert "mock-7" not in mock_ids  # 180m

    def test_nearby_busy_no_matches(self, auth_headers):
        requests.put(f"{API}/users/me/state", headers=auth_headers, json={"status": "busy"}, timeout=15)
        r = requests.get(f"{API}/nearby", headers=auth_headers, params={"lat": LAT, "lng": LNG, "radius": 200}, timeout=15)
        assert r.status_code == 200
        for u in r.json()["users"]:
            if u["is_mock"]:
                assert u["is_match"] is False

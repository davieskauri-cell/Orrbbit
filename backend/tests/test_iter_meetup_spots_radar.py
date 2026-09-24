"""
Iteration test: Orrbbit Verified Meetup Spots (new endpoint) + Radar cleanup regression.
Covers:
 - GET /api/business/meetup-spots (auth required, only meetup_spot_approved+Verified businesses)
 - GET /api/business/nearby (prior-session endpoint, sanity regression)
 - Demo login + basic radar/nearby sanity (no server errors)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

MELB_LAT = -37.8115
MELB_LNG = 144.9633


@pytest.fixture(scope="module")
def demo_token():
    r = requests.post(f"{API}/auth/demo-login", json={})
    assert r.status_code == 200, r.text
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token
    return token


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


class TestMeetupSpotsEndpoint:
    def test_meetup_spots_returns_200_and_shape(self, auth_headers):
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "spots" in data
        assert isinstance(data["spots"], list)
        assert len(data["spots"]) >= 3

    def test_meetup_spots_have_required_fields(self, auth_headers):
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        spots = r.json()["spots"]
        for s in spots:
            assert "id" in s
            assert "name" in s
            assert "category" in s
            assert "distance" in s
            assert isinstance(s["distance"], (int, float))

    def test_meetup_spots_seeded_names_present(self, auth_headers):
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        names = {s["name"] for s in r.json()["spots"]}
        expected = {"The Daily Grind", "The Commons", "Riverside Community Center"}
        assert expected.issubset(names), f"Missing expected demo spots, got: {names}"

    def test_meetup_spots_sorted_by_distance_ascending(self, auth_headers):
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        spots = r.json()["spots"]
        dists = [s["distance"] for s in spots]
        assert dists == sorted(dists)

    def test_meetup_spots_excludes_wharf_kitchen(self, auth_headers):
        """The Wharf Kitchen is Verified but NOT meetup_spot_approved — must not appear."""
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        names = {s["name"] for s in r.json()["spots"]}
        assert "The Wharf Kitchen" not in names

    def test_meetup_spots_requires_auth(self):
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG})
        assert r.status_code in (401, 403)

    def test_meetup_spots_distance_values_plausible(self, auth_headers):
        """Roughly expect: Daily Grind ~315m, Commons ~459m, Riverside ~697m from Melbourne CBD demo loc."""
        r = requests.get(f"{API}/business/meetup-spots", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        spots = {s["name"]: s["distance"] for s in r.json()["spots"]}
        for name in ["The Daily Grind", "The Commons", "Riverside Community Center"]:
            assert spots[name] < 5000  # sanity: within a few km, not absurd


class TestBusinessNearbyRegression:
    """Sanity check for prior-session GET /api/business/nearby endpoint (unrelated to this task)."""

    def test_nearby_businesses_200(self, auth_headers):
        r = requests.get(f"{API}/business/nearby", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "businesses" in data
        assert isinstance(data["businesses"], list)

    def test_nearby_businesses_requires_auth(self):
        r = requests.get(f"{API}/business/nearby", params={"lat": MELB_LAT, "lng": MELB_LNG})
        assert r.status_code in (401, 403)


class TestRegressionSanity:
    """Basic regression: demo login + nearby users + events still function."""

    def test_auth_me(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("email")

    def test_nearby_users(self, auth_headers):
        r = requests.get(f"{API}/nearby", params={"lat": MELB_LAT, "lng": MELB_LNG}, headers=auth_headers)
        assert r.status_code == 200

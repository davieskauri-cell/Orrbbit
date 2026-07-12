"""Iteration 11 retest — validates the two fixes from iter 10:
  1. Profile menu leak (frontend-only, tested via Playwright separately)
  2. /api/nearby response strips lat/lng for ALL user categories.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
# Melbourne CBD demo fallback coords
MEL_LAT, MEL_LNG = -37.8136, 144.9631


@pytest.fixture(scope="module")
def kauri_token():
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    assert tok, f"no token in {body}"
    return tok


@pytest.fixture(scope="module")
def kauri_headers(kauri_token):
    return {"Authorization": f"Bearer {kauri_token}", "Content-Type": "application/json"}


def _assert_no_latlng(users, label):
    assert isinstance(users, list) and len(users) > 0, f"{label}: expected users list"
    for u in users:
        assert "lat" not in u, f"{label}: user {u.get('id')} still has 'lat' key"
        assert "lng" not in u, f"{label}: user {u.get('id')} still has 'lng' key"
        # sanity: distance + bearing kept
        assert "distance" in u, f"{label}: distance missing"
        assert "bearing" in u, f"{label}: bearing missing"


class TestNearbyPrivacy:
    """FIX 2 RETEST — lat/lng must not appear in nearby users[]."""

    def test_kauri_nearby_regular_no_latlng(self, kauri_headers):
        # ensure HD demo off first
        requests.put(
            f"{BASE_URL}/api/users/me/state",
            headers=kauri_headers,
            json={"high_density_demo": False},
        )
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_headers,
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "users" in body and "count" in body and "radius" in body
        _assert_no_latlng(body["users"], "regular+demo (HD off)")

    def test_kauri_nearby_high_density_no_latlng(self, kauri_headers):
        # turn HD demo on
        r_state = requests.put(
            f"{BASE_URL}/api/users/me/state",
            headers=kauri_headers,
            json={"high_density_demo": True},
        )
        assert r_state.status_code == 200, r_state.text

        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_headers,
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        users = body["users"]
        # HD should produce many users (capped at MAX_DISCOVERY = 100)
        assert len(users) >= 50, f"expected packed HD list, got {len(users)}"
        _assert_no_latlng(users, "high-density synthetic")
        # ensure at least one synthetic id present (hd-*)
        has_hd = any(str(u.get("id", "")).startswith("hd-") for u in users)
        assert has_hd, "expected at least one hd-* synthetic id"

        # cleanup: turn HD demo back off
        requests.put(
            f"{BASE_URL}/api/users/me/state",
            headers=kauri_headers,
            json={"high_density_demo": False},
        )

    def test_kauri_nearby_regular_user_flow(self, kauri_headers):
        """Register a real @example.com user and confirm their nearby lookup also strips lat/lng."""
        import uuid

        email = f"TEST_iter11_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": "Intro123!",
                "name": "IterElevenTest",
                "age": 27,
            },
        )
        assert reg.status_code in (200, 201), reg.text
        tok = reg.json().get("access_token") or reg.json().get("token")
        assert tok
        hdrs = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=hdrs,
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200, r.text
        _assert_no_latlng(r.json()["users"], "fresh-regular-user nearby")

        # cleanup
        requests.delete(f"{BASE_URL}/api/users/me", headers=hdrs)


class TestNearbyRegression:
    """Ensure existing fields still returned (regression)."""

    def test_nearby_shape(self, kauri_headers):
        r = requests.get(
            f"{BASE_URL}/api/nearby",
            headers=kauri_headers,
            params={"lat": MEL_LAT, "lng": MEL_LNG},
        )
        assert r.status_code == 200
        body = r.json()
        users = body["users"]
        assert len(users) > 0
        u = users[0]
        for k in ("id", "name", "vibe", "distance", "bearing", "compatible"):
            assert k in u, f"missing key {k}"
        assert isinstance(u["distance"], (int, float))
        assert isinstance(u["bearing"], (int, float))

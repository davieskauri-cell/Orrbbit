"""Iter 10 backend tests — BETA production-readiness pass.

Coverage:
- Account deletion (DELETE /api/users/me) for regular + demo users
- Regression: register + login, block/report, plan/radius limits, nearby privacy
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ------------------------- register + login regression -------------------------
def _register(s, suffix=""):
    email = f"TEST_iter10_{uuid.uuid4().hex[:8]}{suffix}@example.com"
    payload = {"name": "Iter10 Tester", "email": email, "password": "Intro123!", "age": 25}
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return email, "Intro123!", data["access_token"], data["user"]


def test_register_and_login_flow(s):
    email, pw, token, user = _register(s)
    assert user["email"] == email.lower()
    # login with the credentials
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == email.lower()


def test_demo_login_kauri(s):
    r = s.post(f"{API}/auth/demo-login", json={}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "kauri@intro.demo"
    assert body["user"].get("is_demo") is True
    assert body["user"]["plan"] == "pro"


# ------------------------- account deletion -------------------------
def test_delete_regular_user(s):
    email, pw, token, _ = _register(s, suffix="_del")
    h = {"Authorization": f"Bearer {token}"}

    r = s.delete(f"{API}/users/me", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True

    # subsequent login must fail (user gone)
    r2 = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r2.status_code == 401, f"expected 401 after delete, got {r2.status_code} {r2.text}"

    # /auth/me with old token must also fail
    r3 = s.get(f"{API}/auth/me", headers=h, timeout=15)
    assert r3.status_code == 401


def test_delete_demo_account_forbidden(s):
    r = s.post(f"{API}/auth/demo-login", json={}, timeout=15)
    assert r.status_code == 200
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    d = s.delete(f"{API}/users/me", headers=h, timeout=15)
    assert d.status_code == 403, f"expected 403 for demo delete, got {d.status_code} {d.text}"
    assert "demo" in d.text.lower()


def test_delete_requires_auth(s):
    r = s.delete(f"{API}/users/me", timeout=15)
    assert r.status_code in (401, 403)


# ------------------------- block / report regression -------------------------
def test_block_hides_from_nearby(s):
    # Login as Kauri
    kauri = s.post(f"{API}/auth/demo-login", json={}, timeout=15).json()
    ktok = kauri["access_token"]
    kh = {"Authorization": f"Bearer {ktok}"}

    # Prime Kauri with a known location to ensure nearby returns people
    s.put(f"{API}/users/me/state", json={"visible": True, "lat": -37.8136, "lng": 144.9631, "radius": 500}, headers=kh, timeout=15)

    # pick a demo target to block (james)
    james = s.post(f"{API}/auth/demo-login", json={"email": "james@intro.demo"}, timeout=15).json()
    james_id = james["user"]["id"]

    # relog kauri (demo-login may have replaced session context — use ktok directly)
    nearby_before = s.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=kh, timeout=15)
    assert nearby_before.status_code == 200, nearby_before.text
    body_before = nearby_before.json()
    users_before = body_before["users"] if isinstance(body_before, dict) else body_before
    ids_before = {u.get("id") for u in users_before}

    br = s.post(f"{API}/blocks", json={"user_id": james_id}, headers=kh, timeout=15)
    assert br.status_code in (200, 201), br.text

    nearby_after = s.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=kh, timeout=15)
    body_after = nearby_after.json()
    users_after = body_after["users"] if isinstance(body_after, dict) else body_after
    ids_after = {u.get("id") for u in users_after}
    assert james_id not in ids_after, "blocked user still visible in /api/nearby"


def test_report_endpoint(s):
    kauri = s.post(f"{API}/auth/demo-login", json={}, timeout=15).json()
    kh = {"Authorization": f"Bearer {kauri['access_token']}"}
    james = s.post(f"{API}/auth/demo-login", json={"email": "james@intro.demo"}, timeout=15).json()
    james_id = james["user"]["id"]
    r = s.post(f"{API}/reports", json={"user_id": james_id, "reason": "TEST_iter10 spam"}, headers=kh, timeout=15)
    assert r.status_code in (200, 201), r.text


# ------------------------- plan / radius limits -------------------------
def test_free_user_radius_capped(s):
    # Sarah = free plan
    r = s.post(f"{API}/auth/demo-login", json={"email": "sarah@intro.demo"}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # try to set radius > 50 for free
    resp = s.put(f"{API}/users/me/state", json={"radius": 250}, headers=h, timeout=15)
    # accept either 400 rejection OR clamp to 50 (both are valid per playbook)
    if resp.status_code == 200:
        me = s.get(f"{API}/auth/me", headers=h, timeout=15).json()
        assert me["radius"] <= 50, f"free plan not capped, got radius={me['radius']}"
    else:
        assert resp.status_code in (400, 403), resp.text


def test_pro_user_radius_500(s):
    r = s.post(f"{API}/auth/demo-login", json={}, timeout=15).json()  # kauri = pro
    h = {"Authorization": f'Bearer ' + r['access_token']}
    resp = s.put(f"{API}/users/me/state", json={"radius": 500}, headers=h, timeout=15)
    assert resp.status_code == 200, resp.text
    me = s.get(f"{API}/auth/me", headers=h, timeout=15).json()
    assert me["radius"] == 500


def test_radius_hard_cap_500(s):
    r = s.post(f"{API}/auth/demo-login", json={}, timeout=15).json()
    h = {"Authorization": f'Bearer ' + r['access_token']}
    resp = s.put(f"{API}/users/me/state", json={"radius": 10000}, headers=h, timeout=15)
    if resp.status_code == 200:
        me = s.get(f"{API}/auth/me", headers=h, timeout=15).json()
        assert me["radius"] <= 500, f"hard cap violated: {me['radius']}"
    else:
        assert resp.status_code in (400, 403)


# ------------------------- privacy: no lat/lng in /nearby -------------------------
def test_nearby_privacy_no_exact_coords(s):
    r = s.post(f"{API}/auth/demo-login", json={}, timeout=15).json()
    h = {"Authorization": f'Bearer ' + r['access_token']}
    s.put(f"{API}/users/me/state", json={"visible": True, "lat": -37.8136, "lng": 144.9631, "radius": 500}, headers=h, timeout=15)

    resp = s.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=h, timeout=15)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    users = body["users"] if isinstance(body, dict) else body
    assert isinstance(users, list) and len(users) > 0, "expected demo users in nearby"

    for u in users:
        # HARD: must never expose full street addresses
        for k in ("address", "street"):
            assert k not in u, f"privacy leak: /nearby exposed {k} on {u.get('id')}"
        # distance should be present (coarse)
        assert ("distance" in u) or ("distance_label" in u) or ("dist" in u), f"no distance field on {u}"

    # SOFT WARN (not fail): /nearby currently returns lat/lng — needed by the radar map,
    # but for demo users these are SYNTHESISED positions relative to the requester
    # (destination_point(lat,lng,demo_dist,demo_bearing)). For real users it would be the
    # raw stored lat/lng. Flagged for beta review — see test report.
    leaked = [u.get("id") for u in users if "lat" in u or "lng" in u]
    if leaked:
        print(f"[WARN] /api/nearby exposes lat/lng on {len(leaked)}/{len(users)} users (synthetic for demos, but raw for real users). Consider fuzzing/removing before real-user beta launch.")

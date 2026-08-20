"""Iteration 47 — Production hardening security regression suite.

Asserts the privacy/session guarantees required for developer handover:
no public email/DOB/exact-location, quantized distances, token revocation,
ban enforcement, under-18 block, deep-link profile privacy.
"""
import uuid

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"

FORBIDDEN_PUBLIC_FIELDS = {"email", "date_of_birth", "dob", "lat", "lng", "hashed_password",
                           "token", "verify_token", "deletion_token", "documents"}


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _mongo():
    c = pymongo.MongoClient(benv["MONGO_URL"])
    return c, c[benv["DB_NAME"]]


@pytest.fixture(scope="module")
def kauri_token():
    r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def fresh_user(verify_email):
    email = f"test_iter47_{uuid.uuid4().hex[:10]}@example.com"
    pw = "Passw0rd!47"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": "Iter47 Tester",
        "date_of_birth": "1993-05-05", "accept_policies": True,
    })
    assert r.status_code == 200, r.text
    verify_email(email)
    return r.json()["access_token"], email, pw, r.json()["user"]["id"]


class TestNoPublicPrivateData:
    def test_nearby_entries_expose_no_private_fields(self, kauri_token):
        r = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(kauri_token))
        assert r.status_code == 200
        users = r.json()["users"]
        assert users, "nearby empty — cannot assert"
        for u in users:
            leaked = FORBIDDEN_PUBLIC_FIELDS & set(u.keys())
            assert not leaked, f"nearby leaks {leaked} for {u.get('name')}"

    def test_person_deep_link_expose_no_private_fields(self, kauri_token):
        r = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(kauri_token))
        target = r.json()["users"][0]["id"]
        p = requests.get(f"{API}/people/{target}", headers=_h(kauri_token))
        assert p.status_code == 200
        leaked = FORBIDDEN_PUBLIC_FIELDS & set(p.json().keys())
        assert not leaked, f"/people leaks {leaked}"

    def test_pings_expose_no_private_fields(self, kauri_token):
        r = requests.get(f"{API}/pings", headers=_h(kauri_token))
        assert r.status_code == 200
        for p in r.json():
            leaked = FORBIDDEN_PUBLIC_FIELDS & set((p.get("user") or {}).keys())
            assert not leaked, f"ping user leaks {leaked}"

    def test_professionals_expose_no_private_fields(self, kauri_token):
        r = requests.get(f"{API}/professionals", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(kauri_token))
        assert r.status_code == 200
        body = r.json()
        pros = body.get("professionals", body) if isinstance(body, dict) else body
        for p in pros:
            leaked = FORBIDDEN_PUBLIC_FIELDS & set(p.keys())
            assert not leaked, f"professional leaks {leaked}"
            assert "identity" not in p

    def test_own_account_returns_own_email_only(self, fresh_user):
        tok, email, _, _ = fresh_user
        me = requests.get(f"{API}/auth/me", headers=_h(tok)).json()
        assert me["email"] == email  # own email allowed on own account


class TestLocationPrivacy:
    def test_real_user_distance_bearing_quantized(self, kauri_token, fresh_user, verify_email):
        # place the fresh REAL user near kauri... real+demo are realm-isolated,
        # so instead register a second real viewer and check them against each other.
        tok_a, _, _, uid_a = fresh_user
        c, db = _mongo()
        db.users.update_one({"id": uid_a}, {"$set": {
            "lat": -37.81371, "lng": 144.96317, "visible": True, "city": "Melbourne",
            # meet current discoverability standard (2 photos + bio)
            "photos": ["/api/demo-assets/tom.jpg", "/api/demo-assets/theo.jpg"],
            "photo_url": "/api/demo-assets/tom.jpg",
            "bio": "Iter47 quantization test subject with a proper-length bio for discovery."}})
        email_b = f"test_iter47b_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email_b, "password": "Passw0rd!47", "name": "Iter47 Viewer",
            "date_of_birth": "1994-04-04", "accept_policies": True})
        verify_email(email_b)
        tok_b = r.json()["access_token"]
        n = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(tok_b)).json()
        mine = [u for u in n["users"] if u["id"] == uid_a]
        c.close()
        assert mine, "test subject not in viewer's nearby"
        u = mine[0]
        assert u["distance"] % 10 == 0, "real-user distance not quantized to 10 m"
        assert u["bearing"] % 10 == 0, "real-user bearing not quantized to 10°"
        assert "lat" not in u and "lng" not in u


class TestSessionRevocation:
    def test_logout_all_revokes_old_token(self, fresh_user):
        tok, email, pw, _ = fresh_user
        # fresh login so we don't kill the module fixture token for later tests
        tok2 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}).json()["access_token"]
        assert requests.get(f"{API}/auth/me", headers=_h(tok2)).status_code == 200
        r = requests.post(f"{API}/auth/logout-all", headers=_h(tok2))
        assert r.status_code == 200
        old = requests.get(f"{API}/auth/me", headers=_h(tok2))
        assert old.status_code == 401
        assert old.json()["detail"] == "SESSION_REVOKED"
        # re-login issues a valid token with the new version
        tok3 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}).json()["access_token"]
        assert requests.get(f"{API}/auth/me", headers=_h(tok3)).status_code == 200

    def test_banned_user_token_rejected(self, verify_email):
        email = f"test_iter47ban_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!47", "name": "Ban Test",
            "date_of_birth": "1990-01-01", "accept_policies": True})
        verify_email(email)
        tok = r.json()["access_token"]
        assert requests.get(f"{API}/auth/me", headers=_h(tok)).status_code == 200
        c, db = _mongo()
        db.users.update_one({"email": email}, {"$set": {"admin_status": "banned"}})
        banned = requests.get(f"{API}/auth/me", headers=_h(tok))
        db.users.delete_one({"email": email})
        c.close()
        assert banned.status_code == 403
        assert banned.json()["detail"] == "ACCOUNT_BANNED"

    def test_deleted_user_token_rejected(self, verify_email):
        email = f"test_iter47del_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!47", "name": "Del Test",
            "date_of_birth": "1990-01-01", "accept_policies": True})
        tok = r.json()["access_token"]
        c, db = _mongo()
        db.users.delete_one({"email": email})
        c.close()
        assert requests.get(f"{API}/auth/me", headers=_h(tok)).status_code == 401


class TestAgeGate:
    def test_under_18_registration_blocked(self):
        from datetime import date
        dob = date.today().replace(year=date.today().year - 16).isoformat()
        r = requests.post(f"{API}/auth/register", json={
            "email": f"kid_{uuid.uuid4().hex[:8]}@example.com", "password": "Passw0rd!47",
            "name": "Too Young", "date_of_birth": dob, "accept_policies": True})
        assert r.status_code in (400, 403, 422), "under-18 signup not blocked"

    def test_future_dob_blocked(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"future_{uuid.uuid4().hex[:8]}@example.com", "password": "Passw0rd!47",
            "name": "Future DOB", "date_of_birth": "2031-01-01", "accept_policies": True})
        assert r.status_code in (400, 422)


class TestDeepLinkProfile:
    def test_profile_loads_by_id_without_nearby_visit(self, kauri_token):
        # get any target from nearby, then hit /people/{id} with a FRESH login token
        n = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(kauri_token)).json()
        target = n["users"][0]["id"]
        tok = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"}).json()["access_token"]
        p = requests.get(f"{API}/people/{target}", headers=_h(tok))
        assert p.status_code == 200
        assert p.json()["id"] == target

    def test_blocked_or_missing_profile_404(self, kauri_token):
        r = requests.get(f"{API}/people/does-not-exist", headers=_h(kauri_token))
        assert r.status_code == 404

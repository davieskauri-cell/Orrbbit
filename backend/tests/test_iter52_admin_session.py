"""Iteration 52 — Control Centre admin-session resilience regression tests.

Backend contract that the frontend fix relies on:
- Valid admin token  -> 200 with real production users (never fabricated empties).
- Expired token      -> 401 (frontend must force logout + login screen).
- Malformed token    -> 401.
- Wrong-secret token -> 401.
- No token           -> 401/403.
- Genuinely empty result (no match) -> 200 with items: [] (real empty state).
- Re-login after expiry -> fresh token works and returns data again.
- 401 bodies never leak secrets or token contents.

NOTE: never prints credentials/secrets. No production data is modified.
"""
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"
MONGO = pymongo.MongoClient(benv["MONGO_URL"])
db = MONGO[benv["DB_NAME"]]

CONTROL_JWT_SECRET = benv.get("CONTROL_JWT_SECRET") or (benv["JWT_SECRET"] + "-control")

QA_ADMIN_EMAIL = "qa-admin@intro.control"
QA_ADMIN_PW = "Qa!hpgOlIndvj0UbVWk"


def _login():
    r = requests.post(f"{API}/control/auth/login",
                      json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login()


@pytest.fixture(scope="module")
def admin_id():
    doc = db.admin_users.find_one({"email": QA_ADMIN_EMAIL}, {"id": 1})
    assert doc, "QA admin missing"
    return doc["id"]


def _users(token, mode="live"):
    return requests.get(f"{API}/control/users",
                        headers={"Authorization": f"Bearer {token}", "X-Admin-Mode": mode}, timeout=15)


def _make_token(admin_id, *, exp_delta_hours, secret=CONTROL_JWT_SECRET, token_type="control_access"):
    now = datetime.now(timezone.utc)
    return pyjwt.encode({
        "sub": admin_id, "email": QA_ADMIN_EMAIL, "role": "super_admin",
        "token_type": token_type, "must_change_password": False,
        "exp": now + timedelta(hours=exp_delta_hours), "iat": now,
    }, secret, algorithm="HS256")


class TestSessionResilience:
    def test_valid_token_loads_real_users(self, admin_token):
        r = _users(admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1, "LIVE users must not be empty with a valid session"
        assert all(not u.get("is_demo") for u in body["items"])

    def test_expired_token_returns_401(self, admin_id):
        expired = _make_token(admin_id, exp_delta_hours=-2)
        r = _users(expired)
        assert r.status_code == 401, f"expired token must 401, got {r.status_code}"
        # never a misleading 200-with-empty
        assert "items" not in (r.json() or {})

    def test_malformed_token_returns_401(self):
        r = _users("not-a-jwt-at-all")
        assert r.status_code == 401

    def test_wrong_secret_token_returns_401(self, admin_id):
        forged = _make_token(admin_id, exp_delta_hours=8, secret="wrong-secret-value")
        r = _users(forged)
        assert r.status_code == 401

    def test_wrong_token_type_returns_401(self, admin_id):
        wrong_type = _make_token(admin_id, exp_delta_hours=8, token_type="access")
        r = _users(wrong_type)
        assert r.status_code == 401

    def test_no_token_rejected(self):
        r = requests.get(f"{API}/control/users", timeout=15)
        assert r.status_code in (401, 403)

    def test_401_body_never_leaks_secrets(self, admin_id):
        expired = _make_token(admin_id, exp_delta_hours=-2)
        r = _users(expired)
        text = r.text.lower()
        assert CONTROL_JWT_SECRET.lower() not in text
        assert expired.lower()[:40] not in text
        assert "hashed_password" not in text

    def test_relogin_restores_data(self, admin_id):
        """Simulates the frontend flow: session expires -> 401 -> re-login -> data back."""
        expired = _make_token(admin_id, exp_delta_hours=-2)
        assert _users(expired).status_code == 401
        fresh = _login()
        r = _users(fresh)
        assert r.status_code == 200 and r.json()["total"] >= 1

    def test_genuinely_empty_result_is_a_real_200(self, admin_token):
        """Authenticated query with no matches is the ONLY case that may be empty."""
        r = requests.get(f"{API}/control/users",
                         params={"q": f"no-match-{uuid.uuid4().hex}"},
                         headers={"Authorization": f"Bearer {admin_token}", "X-Admin-Mode": "live"},
                         timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 0 and body["items"] == []

    def test_dashboard_expired_token_401(self, admin_id):
        expired = _make_token(admin_id, exp_delta_hours=-2)
        r = requests.get(f"{API}/control/dashboard",
                         headers={"Authorization": f"Bearer {expired}"}, timeout=15)
        assert r.status_code == 401
        assert "kpis" not in (r.json() or {}), "expired session must never return zeroed KPIs"

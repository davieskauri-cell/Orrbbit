"""Iteration 50 — Regression: Production Control Centre LIVE user sync.

Owner-reported production defect: a newly created real account did not appear
in Control Centre -> LIVE PRODUCTION -> Users after the Iter49 deploy.

Root cause: the Control Centre data mode defaulted to DEMO on both the
frontend (ControlContext useState('demo') + stored cc_mode) and the backend
(X-Admin-Mode header default "demo"), while the Iter49 environment banner
read "LIVE PRODUCTION" — so LIVE users/KPIs silently showed demo data.

Fix under test:
- Backend get_mode() now defaults to LIVE; demo is strictly opt-in via the
  X-Admin-Mode: demo header.
- Real users (is_demo missing, null or False) appear in LIVE users + KPIs.
- Explicit demo users stay excluded from LIVE and appear only in demo mode.
- RBAC: no anonymous or ordinary user token can read Control Centre users.

NOTE: never prints credentials or user PII beyond generated probe accounts.
"""
import uuid

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"
MONGO = pymongo.MongoClient(benv["MONGO_URL"])
db = MONGO[benv["DB_NAME"]]

QA_ADMIN_EMAIL = "qa-admin@intro.control"
QA_ADMIN_PW = "Qa!hpgOlIndvj0UbVWk"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/control/auth/login",
                      json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


def _headers(token, mode=None):
    h = {"Authorization": f"Bearer {token}"}
    if mode:
        h["X-Admin-Mode"] = mode
    return h


def _register(name_tag):
    """Real-style public signup exactly as a production user would do it."""
    email = f"iter50-{name_tag}-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "Passw0rd!50x",
        "name": f"Iter50 {name_tag}",
        "date_of_birth": "1992-05-05",
        "accept_policies": True,
    }, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    return email


def _find_in_users(token, email, mode=None):
    r = requests.get(f"{API}/control/users", params={"q": email, "limit": 25},
                     headers=_headers(token, mode), timeout=15)
    assert r.status_code == 200, f"/control/users failed: {r.status_code} {r.text[:200]}"
    items = r.json()["items"]
    return any(u.get("email") == email for u in items)


@pytest.fixture(scope="module")
def probe_email(admin_token):
    email = _register("probe")
    yield email
    db.users.delete_many({"email": {"$regex": r"^iter50-.*@example\.com$"}})
    db.email_events.delete_many({"to_email": {"$regex": r"^iter50-"}})


class TestLiveUserSync:
    def test_new_real_signup_visible_in_live_users(self, admin_token, probe_email):
        assert _find_in_users(admin_token, probe_email, mode="live"), \
            "DEFECT: new real signup missing from LIVE Control Centre users"

    def test_new_real_signup_visible_without_mode_header(self, admin_token, probe_email):
        """Missing X-Admin-Mode must default to LIVE, not demo."""
        assert _find_in_users(admin_token, probe_email, mode=None), \
            "DEFECT: default mode hid a real user (header default must be LIVE)"

    def test_unknown_mode_header_defaults_to_live(self, admin_token, probe_email):
        assert _find_in_users(admin_token, probe_email, mode="staging"), \
            "DEFECT: unknown mode value must fall back to LIVE, not demo"

    def test_new_real_signup_not_in_demo_mode(self, admin_token, probe_email):
        assert not _find_in_users(admin_token, probe_email, mode="demo"), \
            "ISOLATION BREAK: real user leaked into demo mode"

    def test_user_with_missing_is_demo_field_is_live(self, admin_token):
        """Legacy/legit records with no is_demo field at all must be LIVE."""
        email = _register("legacy")
        db.users.update_one({"email": email}, {"$unset": {"is_demo": ""}})
        assert _find_in_users(admin_token, email, mode="live"), \
            "DEFECT: user with missing is_demo field excluded from LIVE"

    def test_user_with_is_demo_false_is_live(self, admin_token, probe_email):
        doc = db.users.find_one({"email": probe_email}, {"is_demo": 1})
        assert doc is not None and doc.get("is_demo") is False, \
            "signup should stamp is_demo: False"

    def test_demo_user_excluded_from_live(self, admin_token):
        demo_email = "kauri@intro.demo"
        assert db.users.find_one({"email": demo_email, "is_demo": True}), "demo seed missing"
        assert not _find_in_users(admin_token, demo_email, mode="live"), \
            "ISOLATION BREAK: demo user visible in LIVE users"
        assert _find_in_users(admin_token, demo_email, mode="demo"), \
            "demo user must remain visible in authorized demo mode"

    def test_live_kpi_counts_real_users_and_excludes_demo(self, admin_token, probe_email):
        r = requests.get(f"{API}/control/dashboard", headers=_headers(admin_token, "live"), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["mode"] == "live"
        live_total = body["kpis"]["total_users"]
        expected = db.users.count_documents({"is_demo": {"$ne": True}})
        assert live_total == expected, f"LIVE KPI {live_total} != real user count {expected}"
        demo_count = db.users.count_documents({"is_demo": True})
        assert demo_count > 0 and live_total != db.users.count_documents({}), \
            "LIVE KPI must exclude demo users"

    def test_dashboard_without_header_is_live(self, admin_token):
        r = requests.get(f"{API}/control/dashboard", headers=_headers(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["mode"] == "live", "dashboard default mode must be LIVE"

    def test_newest_first_page_one(self, admin_token):
        email = _register("newest")
        r = requests.get(f"{API}/control/users", params={"page": 1, "limit": 25},
                         headers=_headers(admin_token, "live"), timeout=15)
        assert r.status_code == 200
        emails = [u.get("email") for u in r.json()["items"]]
        assert email in emails, "newest signup must appear on page 1 (created_at desc)"


class TestRbacUnchanged:
    def test_anonymous_rejected(self):
        r = requests.get(f"{API}/control/users", timeout=15)
        assert r.status_code in (401, 403)

    def test_ordinary_user_token_rejected(self, admin_token, probe_email):
        r = requests.post(f"{API}/auth/login",
                          json={"email": probe_email, "password": "Passw0rd!50x"}, timeout=15)
        # unverified users may be gated from product login; token may come from register
        if r.status_code == 200:
            tok = r.json().get("access_token") or r.json().get("token")
            if tok:
                r2 = requests.get(f"{API}/control/users",
                                  headers={"Authorization": f"Bearer {tok}"}, timeout=15)
                assert r2.status_code in (401, 403), \
                    f"SECURITY: user token got {r2.status_code} on /control/users"

"""Iteration 34 — Orrbbit signup / legal-consent / safety experience.

Covers:
 - GET /api/policies registry (14 policies, url/version/effective/status)
 - Age gate (17yo -> 403, exact message, no user), boundary (=18 pass, -1 day fail)
 - Consent flag (accept_policies=false -> 400)
 - Invalid / future DOB -> 400
 - Valid register: token+user, consent_records with expected fields
 - PUT /users/me/email-preferences marketing withdrawal -> append-only record
 - DELETE /users/me with reauth: wrong pwd -> 401, wrong conf -> 400, ok -> 200 + token invalid
 - POST /consents/acknowledge (valid + unknown), GET /users/me/acknowledgements
 - GET /users/me/data-export
 - POST /blocks, GET /blocks, DELETE /blocks/{id}
 - Regression: login, demo-login, /auth/me, /auth/forgot-password
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/") + "/api"

DEMO_EMAIL = "kauri@intro.demo"
DEMO_PWD = "Intro123!"
UNDERAGE_MSG = ("Orrbbit is currently available only to people aged 18 or older. "
                "Your account has not been created.")


def _mk_email(tag=""):
    return f"test_{tag}_{uuid.uuid4().hex[:10]}@example.com"


def _dob(years_ago: int, days_offset: int = 0) -> str:
    today = date.today()
    try:
        d = today.replace(year=today.year - years_ago)
    except ValueError:
        d = today.replace(year=today.year - years_ago, day=28)
    d = d + timedelta(days=days_offset)
    return d.isoformat()


def _register_payload(email=None, dob=None, accept=True, marketing=False):
    return {
        "email": email or _mk_email(),
        "password": "TestPwd12345!",
        "name": "Test User",
        "date_of_birth": dob or _dob(25),
        "accept_policies": accept,
        "marketing_opt_in": marketing,
        "platform": "web",
        "app_version": "1.0.0",
        "locale": "en-AU",
    }


# ---------------- Policies ----------------
class TestPolicies:
    def test_policies_registry(self):
        r = requests.get(f"{BASE_URL}/policies", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "policies" in data and isinstance(data["policies"], list)
        assert len(data["policies"]) == 14, f"expected 14 policies, got {len(data['policies'])}"
        keys = [p["key"] for p in data["policies"]]
        for req in ("terms", "privacy", "community_guidelines", "safety",
                    "location_privacy", "child_safety", "professional_verification",
                    "delete_account", "cookies", "refunds"):
            assert req in keys, f"missing policy key {req}"
        for p in data["policies"]:
            assert p["url"].startswith("https://www.orrbbit.com/"), p["url"]
            assert p["version"] == "1.0"
            assert p["effective_date"] == "2026-08-04"
            assert p["status"] == "effective"
        assert data.get("signup_required") == ["terms", "community_guidelines", "privacy"]


# ---------------- Age gate & consent ----------------
class TestRegisterValidation:
    def test_underage_17_blocked(self):
        payload = _register_payload(dob=_dob(17))
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == UNDERAGE_MSG
        # Login should also fail — account not created
        lr = requests.post(f"{BASE_URL}/auth/login",
                           json={"email": payload["email"], "password": payload["password"]}, timeout=10)
        assert lr.status_code == 401

    def test_boundary_exactly_18_succeeds(self):
        payload = _register_payload(dob=_dob(18, days_offset=0))
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        # cleanup
        tok = r.json()["access_token"]
        requests.delete(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {tok}"},
                        json={"password": payload["password"], "confirmation": "DELETE"}, timeout=15)

    def test_boundary_18_minus_1_day_fails(self):
        # 18 years ago tomorrow => user is 17 years 364 days => underage
        payload = _register_payload(dob=_dob(18, days_offset=1))
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == UNDERAGE_MSG

    def test_missing_consent_blocks(self):
        payload = _register_payload(accept=False)
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 400, r.text
        assert "agree" in r.json().get("detail", "").lower()

    def test_future_dob_400(self):
        payload = _register_payload(dob=(date.today() + timedelta(days=30)).isoformat())
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 400

    def test_invalid_dob_400(self):
        payload = _register_payload(dob="not-a-date")
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 400


# ---------------- Successful signup + consent record ----------------
@pytest.fixture(scope="module")
def new_user(verify_email):
    payload = _register_payload(marketing=True)
    r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    verify_email(payload["email"])  # pass iter43 hard gate
    yield {"token": body["access_token"], "user": body["user"], "password": payload["password"]}
    # best-effort cleanup — may already be deleted by delete tests
    requests.delete(f"{BASE_URL}/users/me",
                    headers={"Authorization": f"Bearer {body['access_token']}"},
                    json={"password": payload["password"], "confirmation": "DELETE"}, timeout=10)


class TestSignupSuccess:
    def test_token_and_user(self, new_user):
        assert new_user["token"]
        u = new_user["user"]
        assert u["email"].startswith("test_")
        assert "hashed_password" not in u
        assert u["age"] >= 18

    def test_consent_record_created(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{BASE_URL}/users/me/consents", headers=h, timeout=10)
        assert r.status_code == 200, r.text
        recs = r.json()["consents"]
        signup = [x for x in recs if x.get("event") == "signup"]
        assert len(signup) == 1, f"expected exactly 1 signup consent record, got {len(signup)}"
        s = signup[0]
        for f in ("age_gate_passed", "terms_version", "terms_accepted_at",
                  "community_guidelines_version", "community_guidelines_accepted_at",
                  "privacy_version", "privacy_acknowledged_at", "marketing_opt_in",
                  "marketing_consent_at", "platform", "locale", "method"):
            assert f in s, f"missing field {f} in signup consent"
        assert s["age_gate_passed"] is True
        assert s["marketing_opt_in"] is True
        assert s["marketing_consent_at"] is not None
        assert s["platform"] == "web"
        assert s["locale"] == "en-AU"
        assert s["method"] == "in_app_signup"


class TestMarketingWithdrawal:
    def test_withdraw_marketing_creates_record(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.put(f"{BASE_URL}/users/me/email-preferences",
                         headers=h, json={"marketing": False}, timeout=15)
        # Endpoint should exist
        assert r.status_code in (200, 204), f"email-preferences PUT failed: {r.status_code} {r.text}"
        cr = requests.get(f"{BASE_URL}/users/me/consents", headers=h, timeout=10)
        assert cr.status_code == 200
        recs = cr.json()["consents"]
        withdrawn = [x for x in recs if x.get("event") == "marketing_consent_changed"
                     or x.get("marketing_withdrawn_at")]
        assert withdrawn, f"expected marketing withdrawal record, got events={[r.get('event') for r in recs]}"


# ---------------- Acknowledgements ----------------
class TestAcknowledgements:
    def test_valid_notice_types(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        for nt in ("professional_disclaimer", "credential_upload_notice"):
            r = requests.post(f"{BASE_URL}/consents/acknowledge",
                              headers=h, json={"notice_type": nt}, timeout=10)
            assert r.status_code == 200, f"{nt}: {r.text}"

    def test_unknown_type_400(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.post(f"{BASE_URL}/consents/acknowledge",
                          headers=h, json={"notice_type": "nope_bad"}, timeout=10)
        assert r.status_code == 400

    def test_latest_acknowledgements(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{BASE_URL}/users/me/acknowledgements", headers=h, timeout=10)
        assert r.status_code == 200
        ack = r.json()["acknowledgements"]
        assert "professional_disclaimer" in ack
        assert "credential_upload_notice" in ack


# ---------------- Data export ----------------
class TestDataExport:
    def test_export_shape(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{BASE_URL}/users/me/data-export", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("profile", "consent_records", "reports_submitted", "saved_profiles"):
            assert k in d, f"missing {k}"
        assert "hashed_password" not in d["profile"]


# ---------------- Blocks ----------------
class TestBlocks:
    def test_block_list_unblock_flow(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        # need a target — use a demo user
        dr = requests.post(f"{BASE_URL}/auth/demo-login", json={"email": "james@intro.demo"}, timeout=10)
        assert dr.status_code == 200
        target_id = dr.json()["user"]["id"]
        # Block
        br = requests.post(f"{BASE_URL}/blocks", headers=h, json={"user_id": target_id}, timeout=10)
        assert br.status_code in (200, 201), br.text
        # List
        lr = requests.get(f"{BASE_URL}/blocks", headers=h, timeout=10)
        assert lr.status_code == 200
        assert any(b["user_id"] == target_id for b in lr.json()["blocked"])
        # Unblock
        ur = requests.delete(f"{BASE_URL}/blocks/{target_id}", headers=h, timeout=10)
        assert ur.status_code == 200
        # Unblocking again -> 404
        ur2 = requests.delete(f"{BASE_URL}/blocks/{target_id}", headers=h, timeout=10)
        assert ur2.status_code == 404


# ---------------- Delete account with reauth ----------------
class TestDeleteAccountReauth:
    def _fresh(self):
        payload = _register_payload()
        r = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200
        return r.json()["access_token"], payload["password"]

    def test_wrong_confirmation_400(self):
        tok, pwd = self._fresh()
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.delete(f"{BASE_URL}/users/me", headers=h,
                            json={"password": pwd, "confirmation": "delete"}, timeout=10)
        # backend uppercases so 'delete' should pass; test with real wrong text
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            # backend accepted lowercase — retry with truly wrong text on a new account
            tok, pwd = self._fresh()
            h = {"Authorization": f"Bearer {tok}"}
            r = requests.delete(f"{BASE_URL}/users/me", headers=h,
                                json={"password": pwd, "confirmation": "NOPE"}, timeout=10)
            assert r.status_code == 400

    def test_wrong_password_401(self):
        tok, _pwd = self._fresh()
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.delete(f"{BASE_URL}/users/me", headers=h,
                            json={"password": "WrongPwd12345!", "confirmation": "DELETE"}, timeout=10)
        assert r.status_code == 401

    def test_correct_deletes_and_token_invalid(self):
        tok, pwd = self._fresh()
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.delete(f"{BASE_URL}/users/me", headers=h,
                            json={"password": pwd, "confirmation": "DELETE"}, timeout=15)
        assert r.status_code == 200, r.text
        me = requests.get(f"{BASE_URL}/auth/me", headers=h, timeout=10)
        assert me.status_code == 401


# ---------------- Regression: login / demo-login / me / forgot-password ----------------
class TestRegression:
    def test_demo_login(self):
        r = requests.post(f"{BASE_URL}/auth/demo-login", json={}, timeout=10)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == DEMO_EMAIL

    def test_login_password(self):
        r = requests.post(f"{BASE_URL}/auth/login",
                          json={"email": DEMO_EMAIL, "password": DEMO_PWD}, timeout=10)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        me = requests.get(f"{BASE_URL}/auth/me",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert me.status_code == 200
        assert me.json()["email"] == DEMO_EMAIL

    def test_forgot_password(self):
        r = requests.post(f"{BASE_URL}/auth/forgot-password",
                          json={"email": "delivered@resend.dev"}, timeout=15)
        assert r.status_code in (200, 204), r.text

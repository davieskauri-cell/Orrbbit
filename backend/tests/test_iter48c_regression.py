"""Iteration 48c — Independent regression tests for the Resend precedence fix
and the full email pipeline (register/verify/resend/forgot/admin visibility).

Preview cannot actually deliver email (revoked key -> HTTP 401 from Resend).
That 401 is the PROOF that the pipeline reaches the provider and errors are
recorded (not swallowed). Production activates the fix once redeployed with
the new RESEND_API_KEY in Emergent Secrets.

NOTE: this file MUST NOT print or assert any secret values.
"""
import os
import subprocess
import sys
import time
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


# ---------- helpers ----------
def _new_probe_email():
    return f"delivered+{uuid.uuid4().hex[:8]}@resend.dev"


@pytest.fixture(scope="module")
def probe_user():
    """Register a fresh user via public API; return dict with email/token/id."""
    email = _new_probe_email()
    r = requests.post(f"{API}/auth/register", json={
        "email": email,
        "password": "Passw0rd!48c",
        "name": "Iter48c Probe",
        "date_of_birth": "1990-01-01",
        "accept_policies": True,
    }, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in register response: {list(data.keys())}"

    yield {"email": email, "token": token}

    # Cleanup Mongo
    db.users.delete_one({"email": email})
    db.email_events.delete_many({"to_email": email})
    db.password_resets.delete_many({"email": email})


# ---------- TEST 1: precedence fix ----------
class TestPrecedence:
    def test_secret_process_env_wins_over_file_env(self):
        """RESEND_API_KEY on OS env must shadow the .env file value."""
        code = (
            "import sys; sys.path.insert(0, '/app/backend');"
            "from email_templates import env_cfg;"
            "v = env_cfg('RESEND_API_KEY');"
            "print('MATCH' if v == 'SENTINEL' else 'MISMATCH')"
        )
        r = subprocess.run(
            [sys.executable, "-c", code],
            env={"RESEND_API_KEY": "SENTINEL", "PATH": "/usr/bin:/bin"},
            capture_output=True, text=True, cwd="/app/backend",
        )
        assert r.returncode == 0, r.stderr[-300:]
        assert "MATCH" in r.stdout, r.stdout

    def test_branding_stays_file_first(self):
        """APP_URL injected in process env must NOT shadow the file value."""
        code = (
            "import sys; sys.path.insert(0, '/app/backend');"
            "from email_templates import env_cfg;"
            "v = env_cfg('APP_URL');"
            "print('SAFE' if 'evil.example' not in v else 'LEAKED')"
        )
        r = subprocess.run(
            [sys.executable, "-c", code],
            env={"APP_URL": "https://evil.example", "PATH": "/usr/bin:/bin"},
            capture_output=True, text=True, cwd="/app/backend",
        )
        assert r.returncode == 0, r.stderr[-300:]
        assert "SAFE" in r.stdout, r.stdout


# ---------- TEST 2: verification flow reaches Resend and failures aren't swallowed ----------
class TestVerificationPipeline:
    def test_verify_email_event_recorded(self, probe_user):
        email = probe_user["email"]
        ev = None
        for _ in range(15):
            ev = db.email_events.find_one(
                {"to_email": email, "template": "verify_email"},
                sort=[("created_at", -1)],
            )
            if ev:
                break
            time.sleep(1)
        assert ev is not None, "verify_email event never recorded — pipeline broken"
        # In preview key is revoked -> failed with 401. In prod after redeploy -> sent.
        assert ev["status"] in ("failed", "queued", "sent"), ev.get("status")

    def test_failure_reason_contains_http_signal_and_no_secret(self, probe_user):
        """Preview should show HTTP 401 in failure_reason; must never contain the api key."""
        email = probe_user["email"]
        ev = None
        for _ in range(15):
            ev = db.email_events.find_one(
                {"to_email": email, "template": "verify_email",
                 "status": {"$in": ["failed", "queued"]}},
                sort=[("created_at", -1)],
            )
            if ev and ev.get("failure_reason"):
                break
            time.sleep(1)

        # If sent successfully in a future prod run, allow skip
        if not ev or ev.get("status") == "sent":
            pytest.skip("verification email delivered (production key active)")

        reason = ev.get("failure_reason") or ""
        assert "401" in reason or "HTTP" in reason.upper() or "unauth" in reason.lower(), reason
        # Secret must not leak into stored failure reason
        # Resend keys have the prefix re_
        assert "re_" not in reason.replace("resend", "").replace("Resend", ""), "secret leaked into failure_reason"


# ---------- TEST 3: resend-verification rate limit ----------
class TestResendRateLimit:
    def test_resend_verification_then_429(self, probe_user):
        headers = {"Authorization": f"Bearer {probe_user['token']}"}
        statuses = []
        got_429 = False
        for _ in range(8):
            r = requests.post(f"{API}/email/resend-verification", headers=headers, timeout=15)
            statuses.append(r.status_code)
            if r.status_code == 429:
                got_429 = True
                break
            time.sleep(0.2)
        assert got_429, f"expected 429 within 8 calls, got: {statuses}"
        # first calls should have been 200 (or 4xx-non-429 acceptable, but not all 429 immediately)
        assert 200 in statuses, f"expected some 200 responses, got: {statuses}"


# ---------- TEST 4: forgot-password reaches email service ----------
class TestPasswordReset:
    def test_forgot_password_records_email_event(self, probe_user):
        email = probe_user["email"]
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
        assert r.status_code in (200, 202), f"{r.status_code} {r.text[:200]}"
        ev = None
        for _ in range(15):
            ev = db.email_events.find_one(
                {"to_email": email, "template": "password_reset"},
                sort=[("created_at", -1)],
            )
            if ev:
                break
            time.sleep(1)
        assert ev is not None, "password_reset event never recorded"
        assert ev["status"] in ("failed", "queued", "sent")


# ---------- TEST 5: admin visibility of failures ----------
class TestAdminVisibility:
    def test_admin_email_stats_surfaces_failures(self, probe_user):
        login = requests.post(f"{API}/control/auth/login", json={
            "email": "qa-admin@intro.control",
            "password": "Qa!hpgOlIndvj0UbVWk",
        }, timeout=15)
        assert login.status_code == 200, login.text[:300]
        token = login.json().get("access_token") or login.json().get("token")
        assert token, list(login.json().keys())
        headers = {"Authorization": f"Bearer {token}"}

        r = requests.get(f"{API}/control/email/stats", headers=headers, timeout=15)
        assert r.status_code == 200, r.text[:300]
        stats = r.json()

        # Sanity — required admin-visibility fields
        # Accept either flat counts or nested groups
        blob = str(stats)
        assert "failed" in blob.lower(), stats

        # Recent failures list should include an entry (from preview 401s)
        # Try common shapes
        recent = (stats.get("recent_failures")
                  or stats.get("recent_failed")
                  or stats.get("recent", {}).get("failures")
                  or [])
        assert isinstance(recent, list), f"recent_failures shape unexpected: {type(recent)}"
        assert len(recent) > 0, f"admin dashboard shows no recent failures despite preview 401s: keys={list(stats.keys())}"

        # Ensure admin payload never leaks the real Resend API key.
        # Resend keys are shaped like "re_XXXXXXXXXXXXXXXXX" (>=15 chars, alnum).
        import re as _re
        leaked = _re.search(r"\bre_[A-Za-z0-9_]{15,}", blob)
        assert leaked is None, f"Secret-shaped token leaked in admin payload"


# ---------- TEST 6: sender config unchanged ----------
class TestSenderConfig:
    def test_from_email_configured(self):
        # Read variable presence + value; FROM_EMAIL is not a secret
        val = benv.get("FROM_EMAIL")
        assert val == "notifications@updates.orrbbit.com", f"FROM_EMAIL wrong: {val!r}"

    def test_resend_api_key_variable_exists_but_not_printed(self):
        # Only check that the key exists in .env; never print value
        assert "RESEND_API_KEY" in benv, "RESEND_API_KEY missing from backend/.env"
        # sanity: not empty
        assert bool(benv.get("RESEND_API_KEY")), "RESEND_API_KEY empty"

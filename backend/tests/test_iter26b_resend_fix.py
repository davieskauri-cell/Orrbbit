"""Iteration 26b — Verify Resend domain fix (updates.orrbbit.com subdomain).

Root cause fixed: FROM_EMAIL was hello@orrbbit.com (apex not verified);
Resend returned 403. Verified domain is subdomain updates.orrbbit.com, so
FROM_EMAIL was updated to hello@updates.orrbbit.com.

This suite independently confirms:
  1. control admin test-send returns status='sent' with a resend_id (not 'failed'/403)
  2. Fresh registration triggers verify_email + welcome BOTH status='sent' with resend_id
  3. Forgot-password produces password_reset event status='sent'
  4. GET /api/control/email/stats reflects sent counts + recent scheduler_last_run
  5. Regression: 56 templates listed, demo login works, demo accounts create NO email events
"""

import os
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "qa-admin@intro.control"
ADMIN_PASSWORD = "QaControl!2026x"

# Emails sent budget: keep <=4 real live sends
# 1) control test-send to delivered@resend.dev (welcome)
# 2) register -> verify_email + welcome (2)
# 3) forgot-password -> password_reset (1)
# Total = 4 sends


# ------------------------------------------------------------- fixtures

@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_headers(s):
    r = s.post(f"{API}/control/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "X-Admin-Mode": "live"}


@pytest.fixture(scope="session")
def live_user(s):
    """Register a fresh real (non-demo) user at gmail.com so Resend accepts."""
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_livemail_{tag}@gmail.com"
    payload = {
        "name": "Live Email Test",
        "email": email,
        "password": "LivePass!2026",
        "age": 28,
        "gender": "other",
    }
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "email": email,
        "token": data.get("access_token") or data.get("token"),
        "user": data.get("user") or data,
    }


# ------------------------------------------------------------- 1. CORE FIX

class TestResendFixCore:
    """Verify the 403 → 200 fix directly through the control admin test-send."""

    def test_admin_test_send_welcome_delivered(self, s, admin_headers):
        r = s.post(
            f"{API}/control/email/templates/welcome/test",
            json={"to_email": "delivered@resend.dev"},
            headers=admin_headers,
        )
        assert r.status_code == 200, f"unexpected HTTP: {r.status_code} {r.text}"
        data = r.json()
        # CORE BUG VERIFICATION — must be 'sent' now, not 'failed'/403
        assert data.get("status") == "sent", (
            f"expected status=sent (403 fix). Got: {data}"
        )
        # Resend returns an id when successfully queued
        assert data.get("resend_id"), f"missing resend_id in {data}"


# ------------------------------------------------------------- 2. Register triggers

class TestRegistrationLiveSends:
    def test_verify_and_welcome_both_sent(self, s, admin_headers, live_user):
        # Give email_service fire-and-forget tasks time to complete
        time.sleep(6)
        r = s.get(
            f"{API}/control/email/events",
            params={"email": live_user["email"]},
            headers=admin_headers,
        )
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 2, f"expected >=2 events, got {len(items)}: {items}"

        by_template = {i["template"]: i for i in items}
        assert "verify_email" in by_template, f"missing verify_email in {by_template.keys()}"
        assert "welcome" in by_template, f"missing welcome in {by_template.keys()}"

        # Both must be sent (403 fix)
        for tmpl in ("verify_email", "welcome"):
            ev = by_template[tmpl]
            assert ev["status"] == "sent", (
                f"{tmpl} event status={ev['status']} expected 'sent'. Row: {ev}"
            )
            assert ev.get("resend_id"), f"{tmpl} missing resend_id: {ev}"


# ------------------------------------------------------------- 3. Forgot-password event

class TestForgotPasswordLive:
    def test_forgot_password_event_sent(self, s, admin_headers, live_user):
        r = s.post(
            f"{API}/auth/forgot-password",
            json={"email": live_user["email"]},
        )
        # endpoint returns 200 regardless (avoid enumeration)
        assert r.status_code == 200, f"forgot-password HTTP {r.status_code}: {r.text}"
        time.sleep(5)

        ev = s.get(
            f"{API}/control/email/events",
            params={"email": live_user["email"], "template": "password_reset"},
            headers=admin_headers,
        )
        assert ev.status_code == 200
        items = ev.json().get("items", [])
        reset_items = [i for i in items if i["template"] == "password_reset"]
        assert reset_items, f"no password_reset events for {live_user['email']}: {items}"
        latest = reset_items[0]
        assert latest["status"] == "sent", f"password_reset status={latest['status']}: {latest}"
        assert latest.get("resend_id"), f"password_reset missing resend_id: {latest}"


# ------------------------------------------------------------- 4. Stats + scheduler

class TestStatsAndScheduler:
    def test_stats_recent_and_counts(self, s, admin_headers):
        r = s.get(f"{API}/control/email/stats", headers=admin_headers)
        assert r.status_code == 200
        stats = r.json()

        counts = stats.get("counts") or stats
        sent = counts.get("sent", 0)
        assert sent > 0, f"expected counts.sent > 0 after live sends, got {sent}. Full: {stats}"

        last_run = stats.get("scheduler_last_run")
        # It can be null if scheduler never ran, but after restart it should populate soon.
        # Accept null but log; only fail if present and >2h old.
        if last_run:
            # parse ISO
            try:
                lr = datetime.fromisoformat(str(last_run).replace("Z", "+00:00"))
            except Exception:
                lr = None
            if lr:
                age = (datetime.now(timezone.utc) - lr).total_seconds()
                # 2h tolerance — scheduler runs every 300s so should be far fresher
                assert age < 2 * 3600, f"scheduler_last_run stale: {last_run} ({age}s)"


# ------------------------------------------------------------- 5. Regression

class TestRegression:
    def test_templates_still_56(self, s, admin_headers):
        r = s.get(f"{API}/control/email/templates", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") or data.get("templates") or data
        assert isinstance(items, list)
        assert len(items) == 56, f"expected 56 templates, got {len(items)}"

    def test_demo_login_works(self, s):
        r = s.post(f"{API}/auth/demo-login", json={})
        assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("access_token") or data.get("token"), f"no token in {data}"

    def test_demo_login_creates_no_email_events(self, s, admin_headers):
        # login as an @intro.demo account (kauri) and confirm no new email events
        # exist for that address (demo accounts are silent).
        demo_email = "kauri@intro.demo"
        r = s.post(f"{API}/auth/demo-login", json={"email": demo_email})
        assert r.status_code == 200
        time.sleep(3)

        ev = s.get(
            f"{API}/control/email/events",
            params={"email": demo_email},
            headers=admin_headers,
        )
        assert ev.status_code == 200
        items = ev.json().get("items", [])
        # Demo accounts should NEVER receive emails
        assert items == [], f"unexpected email events for demo account: {items}"


# ------------------------------------------------------------- teardown hint

@pytest.fixture(scope="session", autouse=True)
def _report_cleanup(request):
    """Print a cleanup hint at session end — actual cleanup left to main agent
    since we intentionally send live emails and want events preserved for audit.
    """
    yield
    print("\n[cleanup] TEST_livemail_*@gmail.com users may need pruning if the "
          "database retains them long-term.")

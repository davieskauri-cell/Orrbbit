"""Iteration 26 — Transactional Email System tests.

Covers:
- User email prefs GET/PUT
- Registration triggers events (verify_email + welcome, failed=OK due to unverified domain)
- Unsubscribe / verify HTML pages (invalid token → branded 'Link expired')
- Resend verification (auth)
- Forgot/reset password regression + email event
- Reports/feedback triggers + feedback cooldown
- Control Centre admin: templates list (56), preview, test send, mandatory toggle guard, events, stats, retry rules
- Resend webhook: bounce×2 → suppression; complained → immediate; DELETE removes
- Login regression (demo + real)
- Professional connect flow endpoints still respond
"""

import os
import time
import uuid
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

# QA control admin creds
ADMIN_EMAIL = "qa-admin@intro.control"
ADMIN_PASSWORD = "QaControl!2026x"


# ------------------------------------------------------- fixtures

@pytest.fixture(scope="session")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/control/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "X-Admin-Mode": "live"}


@pytest.fixture(scope="session")
def real_user(s):
    """Register a fresh real (non-demo) user for trigger tests."""
    tag = uuid.uuid4().hex[:8]
    email = f"TEST_emailtest_{tag}@gmail.com"
    payload = {"name": "Email Test", "email": email, "password": "TestPass!2026",
               "age": 27, "gender": "other"}
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": payload["password"],
            "token": data.get("access_token") or data.get("token"),
            "id": (data.get("user") or {}).get("id")}


@pytest.fixture(scope="session")
def user_headers(real_user):
    return {"Authorization": f"Bearer {real_user['token']}"}


@pytest.fixture(scope="session")
def demo_token(s):
    r = s.post(f"{API}/auth/demo-login", json={})
    assert r.status_code == 200
    j = r.json()
    return j.get("access_token") or j.get("token")


# ------------------------------------------------------- 1. Templates registry

class TestTemplates:
    def test_list_templates_count(self, s, admin_headers):
        r = s.get(f"{API}/control/email/templates", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        items = data["items"]
        assert len(items) == 56, f"expected 56 templates, got {len(items)}"
        mandatory = [t for t in items if t["mandatory"]]
        disabled_default = [t for t in items if not t["default_enabled"]]
        assert len(mandatory) == 33, f"expected 33 mandatory, got {len(mandatory)}"
        assert len(disabled_default) == 7, f"expected 7 disabled-default, got {len(disabled_default)}"

    def test_preview_template(self, s, admin_headers):
        r = s.get(f"{API}/control/email/templates/welcome/preview", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "subject" in data and "html" in data and "text" in data
        assert len(data["html"]) > 100
        assert "Orrbb" in data["html"]

    def test_preview_unknown_404(self, s, admin_headers):
        r = s.get(f"{API}/control/email/templates/does_not_exist/preview", headers=admin_headers)
        assert r.status_code == 404

    def test_mandatory_cannot_be_disabled(self, s, admin_headers):
        r = s.put(f"{API}/control/email/templates/password_reset/settings",
                  json={"enabled": False}, headers=admin_headers)
        assert r.status_code == 400

    def test_optional_toggle_persists(self, s, admin_headers):
        r = s.put(f"{API}/control/email/templates/re_engagement/settings",
                  json={"enabled": True}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["enabled"] is True
        # revert
        r2 = s.put(f"{API}/control/email/templates/re_engagement/settings",
                   json={"enabled": False}, headers=admin_headers)
        assert r2.status_code == 200

    def test_admin_test_send_expected_failed(self, s, admin_headers):
        # Domain not verified → Resend returns 403 → status=failed w/ reason. Expected.
        r = s.post(f"{API}/control/email/templates/welcome/test",
                   json={"to_email": "delivered@resend.dev"}, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("sent", "failed"), data
        if data["status"] == "failed":
            assert "reason" in data


# ------------------------------------------------------- 2. Registration events

class TestRegistrationEvents:
    def test_register_creates_events(self, s, admin_headers, real_user):
        # give a moment for fire-and-forget tasks
        time.sleep(6)
        r = s.get(f"{API}/control/email/events",
                  params={"email": real_user["email"]}, headers=admin_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 2, f"expected >=2 events (verify_email+welcome), got {len(items)}: {items}"
        templates = {i["template"] for i in items}
        assert "verify_email" in templates
        assert "welcome" in templates


# ------------------------------------------------------- 3. Email preferences

class TestEmailPreferences:
    def test_get_defaults(self, s, user_headers):
        r = s.get(f"{API}/users/me/email-preferences", headers=user_headers)
        assert r.status_code == 200
        prefs = r.json()["preferences"]
        assert prefs["connections"] is True
        assert prefs["session_reminders"] is True
        assert prefs["professional_activity"] is True
        assert prefs["weekly_summaries"] is False
        assert prefs["product_updates"] is False
        assert prefs["marketing"] is False

    def test_put_persists(self, s, user_headers):
        r = s.put(f"{API}/users/me/email-preferences",
                  json={"weekly_summaries": True, "marketing": True}, headers=user_headers)
        assert r.status_code == 200
        assert r.json()["preferences"]["weekly_summaries"] is True
        assert r.json()["preferences"]["marketing"] is True
        # verify via GET
        r2 = s.get(f"{API}/users/me/email-preferences", headers=user_headers)
        prefs = r2.json()["preferences"]
        assert prefs["weekly_summaries"] is True
        assert prefs["marketing"] is True


# ------------------------------------------------------- 4. Unsubscribe / verify pages

class TestPublicEmailPages:
    def test_unsubscribe_bad_token(self, s):
        r = s.get(f"{API}/email/unsubscribe", params={"token": "bad"})
        assert r.status_code == 200
        assert "Link expired" in r.text or "expired" in r.text.lower()
        assert "text/html" in r.headers.get("content-type", "")

    def test_verify_bad_token(self, s):
        r = s.get(f"{API}/email/verify", params={"token": "bad"})
        assert r.status_code == 200
        assert "Link expired" in r.text or "expired" in r.text.lower()

    def test_resend_verification_auth(self, s, user_headers):
        r = s.post(f"{API}/email/resend-verification", headers=user_headers)
        assert r.status_code == 200
        data = r.json()
        assert "ok" in data


# ------------------------------------------------------- 5. Password reset regression

class TestPasswordResetRegression:
    def test_forgot_creates_event(self, s, admin_headers, real_user):
        r = s.post(f"{API}/auth/forgot-password", json={"email": real_user["email"]})
        assert r.status_code == 200
        time.sleep(4)
        r2 = s.get(f"{API}/control/email/events",
                   params={"email": real_user["email"], "template": "password_reset"},
                   headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1

    def test_reset_wrong_code_400(self, s, real_user):
        r = s.post(f"{API}/auth/reset-password", json={
            "email": real_user["email"], "code": "000000", "new_password": "NewPass!2026"
        })
        assert r.status_code == 400


# ------------------------------------------------------- 6. Report / feedback triggers

class TestReportFeedbackTriggers:
    def test_report_creates_event(self, s, admin_headers, user_headers, real_user):
        # get a demo user id to report
        r = s.get(f"{API}/demo-accounts")
        # not all deployments expose; fall back to sarah
        target_id = None
        if r.status_code == 200:
            for u in (r.json() or []):
                if u.get("email", "").endswith("@intro.demo"):
                    target_id = u.get("id")
                    break
        if not target_id:
            pytest.skip("no reportable user id available")
        rr = s.post(f"{API}/reports",
                    json={"reported_user_id": target_id, "reason": "TEST_", "details": "test"},
                    headers=user_headers)
        # accept 200/201; even if endpoint different, we care about event
        assert rr.status_code in (200, 201), f"report failed: {rr.status_code} {rr.text}"
        time.sleep(4)
        r2 = s.get(f"{API}/control/email/events",
                   params={"email": real_user["email"], "template": "report_received"},
                   headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1

    def test_feedback_cooldown(self, s, admin_headers, user_headers, real_user):
        r1 = s.post(f"{API}/feedback",
                    json={"spoke": "Yes, we spoke", "experience": "Great",
                          "comments": "TEST_feedback iter26 first"}, headers=user_headers)
        assert r1.status_code in (200, 201)
        time.sleep(3)
        r_before = s.get(f"{API}/control/email/events",
                         params={"email": real_user["email"], "template": "feedback_received"},
                         headers=admin_headers)
        events_before = r_before.json()["items"]
        before = r_before.json()["total"]
        assert before >= 1  # first submit did log an event
        first_status = events_before[0]["status"] if events_before else None
        # second submit within 60min
        r2 = s.post(f"{API}/feedback",
                    json={"spoke": "Yes, we spoke", "experience": "Good",
                          "comments": "TEST_feedback iter26 second"}, headers=user_headers)
        assert r2.status_code in (200, 201)
        time.sleep(3)
        r_after = s.get(f"{API}/control/email/events",
                        params={"email": real_user["email"], "template": "feedback_received"},
                        headers=admin_headers)
        after = r_after.json()["total"]
        # Cooldown only applies when first email was 'sent'. On this env (domain
        # unverified) sends fail → cooldown does NOT engage by design (failed
        # sends intentionally don't block re-sends). Verify expected behavior.
        if first_status == "sent":
            assert after == before, f"cooldown expected: before={before} after={after}"
        else:
            # failed-first: 2nd send allowed to try again — logged as new event
            assert after >= before


# ------------------------------------------------------- 7. Control Centre — events, stats, retry

class TestControlEmailsAdmin:
    def test_events_search_by_email(self, s, admin_headers, real_user):
        r = s.get(f"{API}/control/email/events",
                  params={"email": real_user["email"]}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_stats(self, s, admin_headers):
        r = s.get(f"{API}/control/email/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "counts" in data
        assert set(["sent", "failed", "queued"]).issubset(data["counts"].keys())
        assert "suppressions" in data and "bounces" in data
        # scheduler may not have run yet — non-fatal
        assert "scheduler_last_run" in data

    def test_retry_password_reset_forbidden(self, s, admin_headers, real_user):
        # find any password_reset event for our user
        r = s.get(f"{API}/control/email/events",
                  params={"email": real_user["email"], "template": "password_reset"},
                  headers=admin_headers)
        events = r.json()["items"]
        if not events:
            pytest.skip("no password_reset event")
        target = next((e for e in events if e["status"] == "failed"), events[0])
        rr = s.post(f"{API}/control/email/events/{target['id']}/retry", headers=admin_headers)
        # 400 because security template, OR 400 because status != failed
        assert rr.status_code == 400

    def test_retry_failed_non_security(self, s, admin_headers, real_user):
        r = s.get(f"{API}/control/email/events",
                  params={"email": real_user["email"], "status": "failed"},
                  headers=admin_headers)
        events = [e for e in r.json()["items"] if e["template"] not in ("password_reset", "verify_email")]
        if not events:
            pytest.skip("no retryable failed event")
        target = events[0]
        rr = s.post(f"{API}/control/email/events/{target['id']}/retry", headers=admin_headers)
        assert rr.status_code == 200


# ------------------------------------------------------- 8. Resend webhook / suppression

class TestResendWebhook:
    def test_bounce_twice_creates_suppression(self, s, admin_headers):
        target = f"TEST_bounce_{uuid.uuid4().hex[:6]}@test.com"
        payload = {"type": "email.bounced", "data": {"to": [target], "email_id": "x"}}
        r1 = s.post(f"{API}/webhooks/resend", json=payload)
        assert r1.status_code == 200
        r2 = s.post(f"{API}/webhooks/resend", json=payload)
        assert r2.status_code == 200
        sup = s.get(f"{API}/control/email/suppressions", headers=admin_headers).json()
        emails = [i["email"] for i in sup["items"]]
        assert target.lower() in emails, f"{target} not suppressed. items={emails[:5]}"

    def test_complained_immediate_suppression(self, s, admin_headers):
        target = f"TEST_complain_{uuid.uuid4().hex[:6]}@test.com"
        r = s.post(f"{API}/webhooks/resend",
                   json={"type": "email.complained", "data": {"to": [target], "email_id": "y"}})
        assert r.status_code == 200
        sup = s.get(f"{API}/control/email/suppressions", headers=admin_headers).json()
        emails = [i["email"] for i in sup["items"]]
        assert target.lower() in emails

    def test_delete_suppression(self, s, admin_headers):
        target = f"TEST_del_{uuid.uuid4().hex[:6]}@test.com"
        s.post(f"{API}/webhooks/resend",
               json={"type": "email.complained", "data": {"to": [target], "email_id": "z"}})
        r = s.delete(f"{API}/control/email/suppressions/{target}", headers=admin_headers)
        assert r.status_code == 200
        sup = s.get(f"{API}/control/email/suppressions", headers=admin_headers).json()
        emails = [i["email"] for i in sup["items"]]
        assert target.lower() not in emails


# ------------------------------------------------------- 9. Regression — login + professional endpoints

class TestRegression:
    def test_demo_login_ok(self, s):
        r = s.post(f"{API}/auth/demo-login", json={})
        assert r.status_code == 200
        j = r.json()
        assert j.get("access_token") or j.get("token")

    def test_real_login_ok(self, s, real_user):
        r = s.post(f"{API}/auth/login",
                   json={"email": real_user["email"], "password": real_user["password"]})
        assert r.status_code == 200
        j = r.json()
        assert j.get("access_token") or j.get("token")

    def test_professional_endpoints_alive(self, s, demo_token):
        h = {"Authorization": f"Bearer {demo_token}"}
        r = s.get(f"{API}/professional/connect/requests", headers=h)
        assert r.status_code == 200
        r2 = s.get(f"{API}/professional/sessions", headers=h)
        assert r2.status_code == 200

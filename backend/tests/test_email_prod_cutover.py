"""Iteration 33 — Orrbbit production email cutover verification.

Verifies that the env-file-precedence fix (dotenv_values via env_cfg) has:
  * removed all preview.emergentagent.com URLs from rendered emails
  * kept APP_URL as https://orrbbit.com for privacy/terms links
  * points logo + backend-served links at PUBLIC_BASE_URL (emergent.host)
  * ships the friendly "Open this securely in your browser." fallback (CTA-only)

Live sends are limited to a single delivered@resend.dev send + Resend API lookup.
"""
import os
import re
import time
import uuid

import pytest
import requests
from dotenv import dotenv_values

BACKEND_ENV = dotenv_values("/app/backend/.env")

# Preview (admin login target — QA admin lives on preview DB)
PREVIEW_BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                              "https://nearby-connect-93.preview.emergentagent.com").rstrip("/")
# Production static/HTML endpoints
PROD_BASE = "https://nearby-connect-93.emergent.host"

QA_ADMIN_EMAIL = "qa-admin@intro.control"
QA_ADMIN_PASSWORD = "QawqvEcQ-eOdWT!7"

RESEND_API_KEY = BACKEND_ENV.get("RESEND_API_KEY")
EXPECTED_LOGO_URL = "nearby-connect-93.emergent.host/api/email-assets/orrbbit-logo-v2.png"
EXPECTED_APP_URL = "https://orrbbit.com"


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{PREVIEW_BASE}/api/control/auth/login",
                      json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PASSWORD},
                      timeout=30)
    if r.status_code != 200:
        pytest.skip(f"QA admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}",
            "X-Admin-Mode": "live",
            "Content-Type": "application/json"}


# ---------------------------------------------------------------- 1. Preview HTML checks
def _assert_common_html(html: str, template_key: str, has_cta: bool):
    # No preview / localhost URLs anywhere in rendered HTML
    assert "preview.emergentagent" not in html, f"[{template_key}] leaked preview URL"
    assert "localhost" not in html, f"[{template_key}] leaked localhost"
    # Logo hosted on emergent.host
    assert EXPECTED_LOGO_URL in html, f"[{template_key}] missing prod logo URL"
    # APP_URL links present (privacy/terms)
    assert f"{EXPECTED_APP_URL}/privacy" in html, f"[{template_key}] wrong privacy URL"
    assert f"{EXPECTED_APP_URL}/terms" in html, f"[{template_key}] wrong terms URL"
    # Friendly fallback line (only emails WITH a CTA have it)
    if has_cta:
        assert "Open this securely in your browser." in html, (
            f"[{template_key}] missing friendly fallback anchor")
        # And no raw URL exposed as anchor TEXT (>https:// pattern)
        assert ">https://" not in html, (
            f"[{template_key}] has raw URL exposed as anchor text")
    else:
        assert "Open this securely in your browser." not in html, (
            f"[{template_key}] should NOT have fallback line (no CTA)")


def test_preview_welcome(admin_headers):
    r = requests.get(f"{PREVIEW_BASE}/api/control/email/templates/welcome/preview",
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["key"] == "welcome"
    assert "subject" in data and "html" in data
    _assert_common_html(data["html"], "welcome", has_cta=True)


def test_preview_help_request_received(admin_headers):
    r = requests.get(f"{PREVIEW_BASE}/api/control/email/templates/help_request_received/preview",
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    html = r.json()["html"]
    _assert_common_html(html, "help_request_received", has_cta=True)
    # help_request_received has category=connections → unsub + prefs links present
    assert "unsubscribe" in html.lower(), "should include unsubscribe link (has category)"
    # prefs_url should use PUBLIC_BASE_URL/email-preferences
    assert f"{PROD_BASE}/email-preferences" in html or "#prefs-sample" in html, (
        "prefs_url should use PUBLIC_BASE_URL")


def test_preview_booking_confirmed(admin_headers):
    r = requests.get(f"{PREVIEW_BASE}/api/control/email/templates/booking_confirmed/preview",
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    _assert_common_html(r.json()["html"], "booking_confirmed", has_cta=True)


def test_preview_password_reset_no_fallback(admin_headers):
    """password_reset has NO CTA, so no fallback line should be present."""
    r = requests.get(f"{PREVIEW_BASE}/api/control/email/templates/password_reset/preview",
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    html = r.json()["html"]
    _assert_common_html(html, "password_reset", has_cta=False)
    # code_box should be present (visual OTP)
    assert "letter-spacing:8px" in html, "code_box styling missing"


# ---------------------------------------------------------------- 2. One live send + Resend verification
@pytest.fixture(scope="module")
def live_send_result(admin_headers):
    r = requests.post(
        f"{PREVIEW_BASE}/api/control/email/templates/booking_confirmed/test",
        headers=admin_headers,
        json={"to_email": "delivered@resend.dev"},
        timeout=45,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_live_send_booking_confirmed(live_send_result):
    assert live_send_result["status"] == "sent", live_send_result
    assert live_send_result.get("resend_id"), "resend_id missing"


def test_resend_api_lookup(live_send_result):
    if not RESEND_API_KEY:
        pytest.skip("RESEND_API_KEY not in backend/.env")
    resend_id = live_send_result["resend_id"]
    # Resend takes a moment to make the message queryable
    for _ in range(6):
        r = requests.get(f"https://api.resend.com/emails/{resend_id}",
                         headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                         timeout=30)
        if r.status_code == 200:
            break
        time.sleep(2)
    assert r.status_code == 200, f"Resend lookup failed: {r.status_code} {r.text[:200]}"
    msg = r.json()
    # Sender / reply-to as configured in .env
    assert msg.get("from") == "ORRBBIT <notifications@updates.orrbbit.com>", msg.get("from")
    reply_to = msg.get("reply_to")
    assert reply_to == ["support@orrbbit.com"] or reply_to == "support@orrbbit.com", reply_to
    html = msg.get("html", "") or ""
    assert "preview.emergentagent" not in html, "preview URL leaked into live email"
    assert EXPECTED_LOGO_URL in html, "prod logo URL missing in live email"
    assert "Open this securely in your browser." in html, "friendly fallback missing"
    # No raw https:// visible as anchor TEXT
    assert ">https://" not in html, "raw https:// appearing as anchor text"


# ---------------------------------------------------------------- 3. Production endpoints (live)
def test_prod_logo_asset():
    r = requests.get(f"{PROD_BASE}/api/email-assets/orrbbit-logo.png", timeout=30)
    assert r.status_code == 200, f"logo returned {r.status_code}"
    assert r.headers.get("content-type", "").startswith("image/png"), r.headers.get("content-type")
    size = len(r.content)
    # Expected ~50KB per PRD
    assert 20_000 < size < 200_000, f"unexpected logo size: {size} bytes"


def test_prod_verify_bad_token():
    r = requests.get(f"{PROD_BASE}/api/email/verify?token=bad", timeout=30)
    assert r.status_code == 200
    assert "Orrbb" in r.text, "branded page missing 'Orrbb'"
    assert r.url.startswith("https://"), "must be HTTPS"


def test_prod_unsubscribe_bad_token():
    r = requests.get(f"{PROD_BASE}/api/email/unsubscribe?token=bad", timeout=30)
    assert r.status_code == 200
    assert "Orrbb" in r.text, "branded page missing 'Orrbb'"


# ---------------------------------------------------------------- 4. Regression on preview backend
@pytest.fixture(scope="module")
def qa_user():
    """Register a fresh QA user; cleanup after tests run."""
    rand = uuid.uuid4().hex[:8]
    email = f"QA_prodmail_{rand}@gmail.com"
    payload = {"name": "QA Prodmail",
               "email": email,
               "password": "QaProd2026!",
               "date_of_birth": "1994-03-03",
               "accept_policies": True}
    r = requests.post(f"{PREVIEW_BASE}/api/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token: {data}"
    yield {"email": email, "token": tok, "id": (data.get("user") or {}).get("id")}
    # Cleanup: delete this user
    try:
        requests.delete(f"{PREVIEW_BASE}/api/users/me",
                        headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    except Exception:
        pass


def test_forgot_password_password_reset(qa_user):
    r = requests.post(f"{PREVIEW_BASE}/api/auth/forgot-password",
                      json={"email": qa_user["email"]}, timeout=30)
    assert r.status_code == 200, r.text
    # Wait a moment for the async email event to persist
    time.sleep(2)


def test_password_reset_event_has_code_box(admin_headers, qa_user):
    """Check an email_event was created for this user (mandatory template, no cooldown block).
    We can't inspect the outgoing HTML directly here but we can verify the template renders
    the code_box + friendly fallback logic (already covered above)."""
    r = requests.get(f"{PREVIEW_BASE}/api/control/email/events",
                     headers=admin_headers,
                     params={"email": qa_user["email"], "template": "password_reset"},
                     timeout=30)
    assert r.status_code == 200, r.text
    items = r.json().get("items", [])
    assert any(ev.get("template") == "password_reset" for ev in items), (
        f"no password_reset email_event recorded for {qa_user['email']}: {items[:2]}")


def test_get_email_preferences(qa_user):
    r = requests.get(f"{PREVIEW_BASE}/api/users/me/email-preferences",
                     headers={"Authorization": f"Bearer {qa_user['token']}"},
                     timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "preferences" in body and "labels" in body
    assert isinstance(body["preferences"].get("connections"), bool)


def test_get_vibes():
    r = requests.get(f"{PREVIEW_BASE}/api/vibes", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # /api/vibes returns a list of vibe dicts
    items = data if isinstance(data, list) else data.get("items") or data.get("vibes")
    assert items and len(items) > 0, "vibes list empty"

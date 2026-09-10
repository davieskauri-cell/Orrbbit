"""Iter84 backend tests — Business verification lifecycle + deletion cascade.

Covers:
- register business (unique @orrbbitqa.example.com)
- POST /business/me -> verification_status == 'In Progress', country_code == 'AU'
- GET /business/me returns country_code
- business event publish blocked (403) while In Progress
- POST /business/me/verification -> 'Pending Review' + email_events business_verification_submitted
- activate sandbox subscription -> still Pending Review (never Verified) +
  business_subscription_activated email event
- user self-call to /control/businesses/{id}/verification returns 401/403
- profile save with verification_status:'Verified' in payload is ignored
- QA admin approve sets Verified
- BACKEND deletion cascade: business w/ event + attendee -> DELETE /users/me =>
  event cancelled, attendee notified/email, profile cleaned, verifications retained
  with business_account_deleted history, email_events contains business_account_deleted,
  event absent from /events/nearby.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
DB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
    os.environ.get("DB_NAME", "test_database")
]
QA_ADMIN_EMAIL = "qa-admin@intro.control"
QA_ADMIN_PWD = "Qa!hpgOlIndvj0UbVWk"


def _register_business(tag_suffix=""):
    tag = uuid.uuid4().hex[:8] + tag_suffix
    email = f"biz-iter84-{tag}@orrbbitqa.example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "name": f"Iter84 Biz {tag}",
            "display_name": f"BizIt84{tag[:4]}",
            "account_type": "business",
            "date_of_birth": "1990-01-01",
            "accept_policies": True,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    uid = d["user"]["id"]
    tok = d["access_token"]
    DB.users.update_one({"id": uid}, {"$set": {"email_verified": True}})
    return {"email": email, "uid": uid, "tok": tok, "tag": tag}


def _create_business_profile(ctx, country="Australia"):
    r = requests.post(
        f"{API}/business/me",
        headers={"Authorization": f"Bearer {ctx['tok']}"},
        json={
            "name": f"Iter84 QA Cafe {ctx['tag']}",
            "category": "Café",
            "email": ctx["email"],
            "location_display": "1 Test St, Melbourne",
            "description": "Iter84 backend QA cafe.",
            "logo_url": "https://picsum.photos/seed/qa84/200",
            "cover_url": "https://picsum.photos/seed/qa84c/800/400",
            "lat": -37.8136,
            "lng": 144.9631,
            "phone": "+61 3 9000 0000",
            "country": country,
            "primary_contact": "Iter84 QA",
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _cleanup(uid, biz_id=None):
    DB.users.delete_many({"id": uid})
    DB.business_profiles.delete_many({"user_id": uid})
    DB.business_verifications.delete_many({"user_id": uid})
    DB.business_login_links.delete_many({"user_id": uid})
    DB.notifications.delete_many({"user_id": uid})
    DB.email_events.delete_many({"user_id": uid})
    DB.email_deliveries.delete_many({"user_id": uid})
    DB.consent_records.delete_many({"user_id": uid})
    DB.events.delete_many({"creator_user_id": uid})
    DB.event_attendees.delete_many({"user_id": uid})
    if biz_id:
        DB.admin_audit_logs.delete_many({"target_id": biz_id})


# =========================================================================
# Lifecycle tests
# =========================================================================

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/control/auth/login",
        json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PWD},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


@pytest.fixture(scope="module")
def biz_ctx():
    ctx = _register_business("-lc")
    resp = _create_business_profile(ctx)
    ctx["biz_id"] = resp["business"]["id"]
    yield ctx
    _cleanup(ctx["uid"], ctx["biz_id"])


class TestBusinessLifecycle:

    def test_a_new_business_is_in_progress_with_country_code(self, biz_ctx):
        # GET /business/me should show verification_status 'In Progress' + country_code 'AU'
        r = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["business"]["verification_status"] == "In Progress"
        assert d["business"]["country_code"] == "AU"
        assert d["business"]["country"] == "Australia"

    def test_b_event_publish_blocked_in_progress(self, biz_ctx):
        r = requests.post(
            f"{API}/events",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={
                "title": "Iter84 blocked event",
                "description": "Should be blocked while In Progress",
                "start_datetime": "2027-01-01T10:00:00Z",
                "end_datetime": "2027-01-01T12:00:00Z",
                "location_display": "1 Test St, Melbourne",
                "lat": -37.8136, "lng": 144.9631,
                "category": "Coffee / Drinks",
                "capacity": 5,
            },
            timeout=30,
        )
        # Should be blocked with 403 (not verified) or 402 (no subscription)
        assert r.status_code in (402, 403), f"Expected block, got {r.status_code}: {r.text}"

    def test_c_submit_verification_records_email_event(self, biz_ctx):
        DB.email_events.delete_many(
            {"user_id": biz_ctx["uid"], "template": "business_verification_submitted"}
        )
        r = requests.post(
            f"{API}/business/me/verification",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={
                "legal_name": f"Iter84 QA Cafe {biz_ctx['tag']}",
                "country": "Australia",
                "abn": "12345678901",
                "email": biz_ctx["email"],
                "phone": "+61 3 9000 0000",
                "address": "1 Test St, Melbourne",
                "primary_contact": "Iter84 QA",
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        # Confirm status is now Pending Review
        me = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        ).json()
        assert me["business"]["verification_status"] == "Pending Review"
        # Email event recorded
        ev = list(DB.email_events.find(
            {"user_id": biz_ctx["uid"], "template": "business_verification_submitted"}
        ))
        assert len(ev) >= 1, "business_verification_submitted email_event not recorded"

    def test_d_sandbox_activation_does_not_verify_and_emits_activated_email(self, biz_ctx):
        DB.email_events.delete_many(
            {"user_id": biz_ctx["uid"], "template": "business_subscription_activated"}
        )
        r = requests.post(
            f"{API}/business/subscription/activate",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={"platform": "sandbox"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        me = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        ).json()
        # Subscription is active but verification is still Pending Review (NEVER auto-Verified)
        assert me["business"]["subscription"]["status"] == "active"
        assert me["business"]["verification_status"] == "Pending Review"
        ev = list(DB.email_events.find(
            {"user_id": biz_ctx["uid"], "template": "business_subscription_activated"}
        ))
        assert len(ev) == 1, f"Expected 1 business_subscription_activated event, got {len(ev)}"

    def test_e_self_call_to_control_verification_rejected(self, biz_ctx):
        # Non-admin cannot call control endpoint
        r = requests.post(
            f"{API}/control/businesses/{biz_ctx['biz_id']}/verification",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={"action": "approve", "note": "self-approve attempt"},
            timeout=30,
        )
        assert r.status_code in (401, 403), (
            f"Self-call to control endpoint should be rejected, got {r.status_code}: {r.text}"
        )
        # Confirm no state changed
        me = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        ).json()
        assert me["business"]["verification_status"] != "Verified"

    def test_f_payload_injection_verified_ignored(self, biz_ctx):
        # Try to inject verification_status:'Verified' in profile save (upsert)
        r = requests.post(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={
                "name": f"Iter84 QA Cafe {biz_ctx['tag']}",
                "category": "Café",
                "email": biz_ctx["email"],
                "location_display": "1 Test St, Melbourne",
                "description": "Injection attempt.",
                "logo_url": "https://picsum.photos/seed/qa84/200",
                "cover_url": "https://picsum.photos/seed/qa84c/800/400",
                "phone": "+61 3 9000 0000",
                "country": "Australia",
                "primary_contact": "Iter84 QA",
                # Injection attempt
                "verification_status": "Verified",
                "verified": True,
            },
            timeout=30,
        )
        assert r.status_code == 200
        me = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        ).json()
        # Must not have been elevated to Verified
        assert me["business"]["verification_status"] != "Verified", (
            "Verification status must not be settable via profile-save payload"
        )

    def test_g_admin_approve_sets_verified(self, biz_ctx, admin_token):
        r = requests.post(
            f"{API}/control/businesses/{biz_ctx['biz_id']}/verification",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "approve", "note": "iter84 QA approve"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        me = requests.get(
            f"{API}/business/me",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        ).json()
        assert me["business"]["verification_status"] == "Verified"


# =========================================================================
# Deletion cascade tests
# =========================================================================

@pytest.fixture(scope="module")
def delete_ctx(admin_token):
    """Set up a business with a hosted event + a personal attendee."""
    ctx = _register_business("-del")
    _create_business_profile(ctx)
    # Approve so business can create events
    biz = DB.business_profiles.find_one({"user_id": ctx["uid"]})
    biz_id = biz["id"]
    ctx["biz_id"] = biz_id
    # Submit verification first
    requests.post(
        f"{API}/business/me/verification",
        headers={"Authorization": f"Bearer {ctx['tok']}"},
        json={
            "legal_name": f"Iter84 QA Cafe {ctx['tag']}",
            "country": "Australia",
            "abn": "12345678901",
            "email": ctx["email"],
            "phone": "+61 3 9000 0000",
            "address": "1 Test St, Melbourne",
            "primary_contact": "Iter84 QA",
        },
        timeout=30,
    )
    # Approve via admin
    r = requests.post(
        f"{API}/control/businesses/{biz_id}/verification",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"action": "approve", "note": "iter84 del ctx approve"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    # Activate sandbox subscription
    r = requests.post(
        f"{API}/business/subscription/activate",
        headers={"Authorization": f"Bearer {ctx['tok']}"},
        json={"platform": "sandbox"},
        timeout=30,
    )
    assert r.status_code == 200
    # Create business event
    from datetime import datetime, timezone, timedelta
    starts = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat().replace("+00:00", "Z")
    ends = (datetime.now(timezone.utc) + timedelta(days=3, hours=2)).isoformat().replace("+00:00", "Z")
    r = requests.post(
        f"{API}/events",
        headers={"Authorization": f"Bearer {ctx['tok']}"},
        json={
            "title": "Iter84 QA Business Event",
            "description": "For deletion cascade test",
            "start_datetime": starts,
            "end_datetime": ends,
            "location_display": "1 Test St, Melbourne",
            "lat": -37.8136, "lng": 144.9631,
            "category": "Coffee / Drinks",
            "capacity": 5,
        },
        timeout=30,
    )
    assert r.status_code == 200, r.text
    event_id = r.json()["event"]["id"] if "event" in r.json() else r.json().get("id")
    ctx["event_id"] = event_id

    # Register a personal attendee
    att_tag = uuid.uuid4().hex[:8]
    att_email = f"att-iter84-{att_tag}@orrbbitqa.example.com"
    ra = requests.post(
        f"{API}/auth/register",
        json={
            "email": att_email,
            "password": "Password123!",
            "name": f"Iter84 Attendee {att_tag}",
            "display_name": f"Att84{att_tag[:4]}",
            "date_of_birth": "1990-01-01",
            "accept_policies": True,
        },
        timeout=30,
    )
    assert ra.status_code == 200, ra.text
    att = ra.json()
    att_uid = att["user"]["id"]
    att_tok = att["access_token"]
    DB.users.update_one({"id": att_uid}, {"$set": {"email_verified": True}})
    ctx["att_uid"] = att_uid
    ctx["att_email"] = att_email
    ctx["att_tok"] = att_tok

    # Attendee joins event
    rj = requests.post(
        f"{API}/events/{event_id}/join",
        headers={"Authorization": f"Bearer {att_tok}"},
        timeout=30,
    )
    assert rj.status_code == 200, rj.text

    yield ctx

    # Teardown attendee
    _cleanup(att_uid)
    _cleanup(ctx["uid"], ctx["biz_id"])


class TestDeletionCascade:

    def test_delete_business_cancels_event_and_notifies_attendee(self, delete_ctx):
        # Snapshot email_events counts pre-delete
        DB.email_events.delete_many(
            {"user_id": delete_ctx["uid"], "template": "business_account_deleted"}
        )
        # DELETE /users/me with JSON body
        r = requests.delete(
            f"{API}/users/me",
            headers={"Authorization": f"Bearer {delete_ctx['tok']}"},
            json={"password": "Password123!", "confirmation": "DELETE"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # Event should be cancelled
        ev = DB.events.find_one({"id": delete_ctx["event_id"]})
        assert ev is not None, "Event record should be retained"
        assert ev["status"] == "cancelled", f"Event status is {ev['status']}, expected cancelled"

        # Attendee notified with event_cancelled notification
        n = list(DB.notifications.find({"user_id": delete_ctx["att_uid"], "type": "event_cancelled"}))
        assert len(n) >= 1, "Attendee did not receive event_cancelled notification"

        # Attendee email_event event_cancelled recorded
        ec = list(DB.email_events.find({"user_id": delete_ctx["att_uid"], "template": "event_cancelled"}))
        assert len(ec) >= 1, "event_cancelled email_event missing"

        # business_profiles and business_login_links removed
        assert DB.business_profiles.find_one({"user_id": delete_ctx["uid"]}) is None
        assert DB.business_login_links.find_one({"user_id": delete_ctx["uid"]}) is None

        # business_verifications retained with history entry
        bv = DB.business_verifications.find_one({"user_id": delete_ctx["uid"]})
        assert bv is not None, "Verification record must be retained"
        hist_actions = [h.get("action") for h in (bv.get("history") or [])]
        assert "business_account_deleted" in hist_actions, (
            f"business_account_deleted not in history: {hist_actions}"
        )

        # email_events contain business_account_deleted for this user
        bd = list(DB.email_events.find(
            {"user_id": delete_ctx["uid"], "template": "business_account_deleted"}
        ))
        # user_id may be None on cleanup — accept fallback to entity_id lookup
        if not bd:
            bd = list(DB.email_events.find(
                {"entity_id": delete_ctx["biz_id"], "template": "business_account_deleted"}
            ))
        assert len(bd) >= 1, "business_account_deleted email_event missing"

    def test_deleted_event_absent_from_events_nearby(self, delete_ctx):
        # As attendee, /events/nearby should not include the cancelled event
        r = requests.get(
            f"{API}/events/nearby",
            headers={"Authorization": f"Bearer {delete_ctx['att_tok']}"},
            params={"lat": -37.8136, "lng": 144.9631, "radius_km": 5},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        items = r.json()
        if isinstance(items, dict):
            items = items.get("events", items.get("items", []))
        ids = [e.get("id") for e in items]
        assert delete_ctx["event_id"] not in ids, "Cancelled event still visible in /events/nearby"


# =========================================================================
# Personal registration regression
# =========================================================================

class TestPersonalRegistrationEmail:

    def test_personal_registration_gets_welcome_not_business_welcome(self):
        tag = uuid.uuid4().hex[:8]
        email = f"pers-iter84-{tag}@orrbbitqa.example.com"
        r = requests.post(
            f"{API}/auth/register",
            json={
                "email": email,
                "password": "Password123!",
                "name": f"Iter84 Personal {tag}",
                "display_name": f"Per84{tag[:4]}",
                "date_of_birth": "1990-01-01",
                "accept_policies": True,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        uid = r.json()["user"]["id"]
        try:
            ev = list(DB.email_events.find({"user_id": uid}))
            templates = [e.get("template") for e in ev]
            assert "welcome" in templates, f"Personal user did not receive welcome; templates={templates}"
            assert "business_welcome" not in templates, (
                "Personal user must NOT receive business_welcome"
            )
        finally:
            _cleanup(uid)

"""Iter83 backend focused tests:
- business_welcome email event created on FIRST subscription activation
- second activation (previous status still 'active') must NOT create a duplicate
- GET /api/business/subscription returns started_at + platform + renews_at
- GET /api/control/businesses/{id} exposes subscription, events, reviews, audit fields
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


@pytest.fixture(scope="module")
def biz_ctx():
    tag = uuid.uuid4().hex[:8]
    email = f"biz-ref-qa-{tag}@orrbbitqa.example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "name": "Iter83 Ref Biz Owner",
            "display_name": f"Iter83{tag[:4]}",
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

    r2 = requests.post(
        f"{API}/business/me",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "name": f"Iter83 QA Cafe {tag}",
            "category": "Café",
            "email": email,
            "location_display": "1 Test St, Melbourne",
            "description": "Iter83 backend QA cafe.",
            "logo_url": "https://picsum.photos/seed/qa83/200",
            "cover_url": "https://picsum.photos/seed/qa83c/800/400",
            "lat": -37.8136,
            "lng": 144.9631,
            "phone": "+61 3 9000 0000",
            "country": "Australia",
            "primary_contact": "Iter83 QA",
        },
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    biz_id = r2.json()["business"]["id"]

    # Submit verification (required to prove the control detail returns verification records too)
    rv = requests.post(
        f"{API}/business/me/verification",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "legal_name": r2.json()["business"]["name"],
            "country": "Australia",
            "abn": "12345678901",
            "email": email,
            "phone": "+61 3 9000 0000",
            "address": "1 Test St, Melbourne",
            "primary_contact": "Iter83 QA",
        },
        timeout=30,
    )
    assert rv.status_code == 200, rv.text

    yield {"email": email, "uid": uid, "tok": tok, "biz_id": biz_id, "tag": tag}

    # Cleanup
    DB.users.delete_many({"id": uid})
    DB.business_profiles.delete_many({"user_id": uid})
    DB.business_verifications.delete_many({"user_id": uid})
    DB.business_login_links.delete_many({"user_id": uid})
    DB.notifications.delete_many({"user_id": uid})
    DB.email_events.delete_many({"user_id": uid})
    DB.email_deliveries.delete_many({"user_id": uid})
    DB.admin_audit_logs.delete_many({"target_id": biz_ctx and biz_id})
    DB.events.delete_many({"creator_user_id": uid})
    DB.consent_records.delete_many({"user_id": uid})


class TestBusinessWelcomeAndSubscription:
    """Iter83 — business_welcome email + subscription payload"""

    def test_first_activate_creates_business_welcome(self, biz_ctx):
        # Ensure no prior welcome events (fresh user)
        DB.email_events.delete_many({"user_id": biz_ctx["uid"], "template": "business_subscription_activated"})

        r = requests.post(
            f"{API}/business/subscription/activate",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={"platform": "sandbox"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        sub = d["subscription"]
        assert sub["status"] == "active"
        assert sub["started_at"] and sub["renews_at"] and sub["platform"] == "sandbox"

        # email_events must have one business_welcome record for this user (status can be failed)
        events = list(
            DB.email_events.find({"user_id": biz_ctx["uid"], "template": "business_subscription_activated"})
        )
        assert len(events) == 1, f"Expected 1 business_welcome event, got {len(events)}"

    def test_get_subscription_includes_started_at(self, biz_ctx):
        r = requests.get(
            f"{API}/business/subscription",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "active"
        assert d.get("started_at"), "started_at missing"
        assert d.get("renews_at"), "renews_at missing"
        assert d.get("platform") == "sandbox"
        assert d.get("price") == "$5.99/month"

    def test_second_activate_no_duplicate_welcome(self, biz_ctx):
        # Precondition: previous status is still 'active'
        biz = DB.business_profiles.find_one({"id": biz_ctx["biz_id"]})
        assert biz["subscription"]["status"] == "active"

        r = requests.post(
            f"{API}/business/subscription/activate",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={"platform": "sandbox"},
            timeout=30,
        )
        assert r.status_code == 200

        events = list(
            DB.email_events.find({"user_id": biz_ctx["uid"], "template": "business_subscription_activated"})
        )
        assert len(events) == 1, (
            f"Duplicate business_welcome created on repeat activate: {len(events)}"
        )

    def test_reactivate_after_cancel_sends_welcome_again(self, biz_ctx):
        # Cancel then re-activate: previous status is 'cancelled', so welcome should be sent
        rc = requests.post(
            f"{API}/business/subscription/cancel",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            timeout=30,
        )
        assert rc.status_code == 200

        r = requests.post(
            f"{API}/business/subscription/activate",
            headers={"Authorization": f"Bearer {biz_ctx['tok']}"},
            json={"platform": "sandbox"},
            timeout=30,
        )
        assert r.status_code == 200
        events = list(
            DB.email_events.find({"user_id": biz_ctx["uid"], "template": "business_subscription_activated"})
        )
        assert len(events) == 2, f"Expected 2 welcome events after reactivate, got {len(events)}"


class TestControlBusinessDetail:
    """Iter83 — control detail panel returns all the required fields."""

    @pytest.fixture(scope="class")
    def admin_token(self):
        r = requests.post(
            f"{API}/control/auth/login",
            json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PWD},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        return j.get("access_token") or j.get("token")

    def test_control_detail_contains_all_sections(self, biz_ctx, admin_token):
        r = requests.get(
            f"{API}/control/businesses/{biz_ctx['biz_id']}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # business object present with subscription block
        assert d["business"]["id"] == biz_ctx["biz_id"]
        assert "subscription" in d["business"]
        assert d["business"]["subscription"]["status"] in ("active", "cancelled")
        # owner block with admin_status ('active' by default)
        assert "owner" in d and "admin_status" in d["owner"]
        # verifications list (we submitted one earlier)
        assert isinstance(d["verifications"], list) and len(d["verifications"]) >= 1
        # events list, reviews list (empty is fine), audit array, emails array, average_rating field
        for k in ("events", "reviews", "audit", "emails"):
            assert k in d, f"missing '{k}' in control detail"
        assert "average_rating" in d
        # Emails: at least one business_welcome we sent earlier should appear here
        templates = [e.get("template") for e in d["emails"]]
        assert "business_subscription_activated" in templates, f"welcome not in email records: {templates}"

"""Admin DELETE /api/control/businesses/{id} — hard delete + cascade.

Covers:
- DELETE without recent re-auth => 428 (Control Centre prompts for re-auth)
- POST /control/auth/reauth then DELETE => 200 and business + related records gone
- Owner ACCOUNT is retained (only the business is deleted)
- DELETE nonexistent business => 404
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


def _register_business(suffix=""):
    tag = uuid.uuid4().hex[:8] + suffix
    email = f"bizdel-{tag}@orrbbitqa.example.com"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email, "password": "Password123!",
            "name": f"BizDel {tag}", "display_name": f"BizDel{tag[:4]}",
            "account_type": "business", "date_of_birth": "1990-01-01",
            "accept_policies": True,
        }, timeout=30,
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
            "name": f"BizDel Cafe {tag}", "category": "Café", "email": email,
            "location_display": "1 Test St, Melbourne", "description": "delete test",
            "lat": -37.8136, "lng": 144.9631, "phone": "+61 3 9000 0000",
            "country": "Australia", "primary_contact": "QA",
        }, timeout=30,
    )
    assert r2.status_code == 200, r2.text
    biz_id = r2.json()["business"]["id"]
    return {"email": email, "uid": uid, "tok": tok, "biz_id": biz_id, "tag": tag}


def _cleanup(uid, biz_id=None):
    DB.users.delete_many({"id": uid})
    DB.business_profiles.delete_many({"user_id": uid})
    DB.business_verifications.delete_many({"user_id": uid})
    DB.notifications.delete_many({"user_id": uid})
    DB.email_events.delete_many({"user_id": uid})
    DB.consent_records.delete_many({"user_id": uid})
    DB.events.delete_many({"creator_user_id": uid})
    if biz_id:
        DB.admin_audit_logs.delete_many({"target_id": biz_id})


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/control/auth/login",
        json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PWD}, timeout=30,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


def _reauth(token):
    r = requests.post(
        f"{API}/control/auth/reauth",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": QA_ADMIN_PWD}, timeout=30,
    )
    assert r.status_code == 200, r.text


def test_delete_not_405(admin_token):
    """The endpoint exists (regression for the reported 405)."""
    r = requests.delete(
        f"{API}/control/businesses/does-not-exist",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
    )
    assert r.status_code != 405, "DELETE method must be registered"


def test_delete_requires_reauth_then_succeeds(admin_token):
    ctx = _register_business("-ok")
    # Add a verification submission + a business-hosted event to exercise cascade
    DB.business_verifications.insert_one({
        "id": str(uuid.uuid4()), "business_id": ctx["biz_id"], "user_id": ctx["uid"],
        "status": "Pending Review", "submitted_at": "2026-01-01T00:00:00Z", "history": [],
    })
    ev_id = str(uuid.uuid4())
    DB.events.insert_one({
        "id": ev_id, "creator_user_id": ctx["uid"], "host_type": "business",
        "title": "Del Event", "status": "active", "category": "Coffee / Drinks",
    })
    DB.event_attendees.insert_one({
        "id": str(uuid.uuid4()), "event_id": ev_id, "user_id": str(uuid.uuid4()),
        "join_status": "accepted",
    })
    try:
        # Ensure re-auth window is stale
        DB.admin_users.update_one(
            {"email": QA_ADMIN_EMAIL}, {"$set": {"last_reauth_at": "2000-01-01T00:00:00+00:00"}})
        r = requests.delete(
            f"{API}/control/businesses/{ctx['biz_id']}",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
        )
        assert r.status_code == 428, f"expected 428 without recent re-auth, got {r.status_code}: {r.text}"

        _reauth(admin_token)
        r = requests.delete(
            f"{API}/control/businesses/{ctx['biz_id']}",
            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("deleted") == ctx["biz_id"]

        # Business + related records gone
        assert DB.business_profiles.find_one({"id": ctx["biz_id"]}) is None
        assert DB.business_verifications.find_one({"business_id": ctx["biz_id"]}) is None
        assert DB.events.find_one({"id": ev_id}) is None
        assert DB.event_attendees.find_one({"event_id": ev_id}) is None
        # Owner account retained
        assert DB.users.find_one({"id": ctx["uid"]}) is not None
        # Audit row recorded
        assert DB.admin_audit_logs.find_one(
            {"target_id": ctx["biz_id"], "action": "business_delete"}) is not None
    finally:
        _cleanup(ctx["uid"], ctx["biz_id"])
        DB.event_attendees.delete_many({"event_id": ev_id})


def test_delete_nonexistent_returns_404(admin_token):
    _reauth(admin_token)
    r = requests.delete(
        f"{API}/control/businesses/{uuid.uuid4().hex}",
        headers={"Authorization": f"Bearer {admin_token}"}, timeout=30,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

"""
Iter81 focused tests:
- Secure single-use computer-continue verification link (48h) — request, redeem, reuse rejected, bogus rejected, token not in email records.
- Subscription activation does NOT auto-verify the business.
- Event creation BLOCKED while verification is Pending (Iter81 gate).
- Personal registration (account_type omitted) still works and login routes correctly via /api/auth/me.
"""
import os
import time
import uuid
import pymongo
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
DB = pymongo.MongoClient(MONGO_URL)[DB_NAME]

TAG = uuid.uuid4().hex[:6]
BIZ = f"qa.link.{TAG}@example.com"
PER = f"qa.per.{TAG}@example.com"
PWD = "Password123!"


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _register(email, name, atype="personal"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PWD, "name": name, "display_name": name.replace(" ", "")[:12],
        "account_type": atype, "date_of_birth": "1990-01-01", "accept_policies": True,
    }, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ctx():
    b = _register(BIZ, "QA Link Owner", "business")
    DB.users.update_one({"id": b["user"]["id"]}, {"$set": {"email_verified": True}})
    # Create business profile
    r = requests.post(f"{API}/business/me", json={
        "name": f"QA Link Biz {TAG}", "category": "Hotel", "email": BIZ,
        "location_display": "Melbourne CBD", "description": "QA cafe for secure link testing.",
        "logo_url": "https://picsum.photos/seed/l/200", "cover_url": "https://picsum.photos/seed/c/800/400",
        "lat": -37.8136, "lng": 144.9631,
    }, headers=_hdr(b["access_token"]), timeout=30)
    assert r.status_code == 200, r.text
    biz_id = r.json()["business"]["id"]
    yield {"biz": b, "biz_id": biz_id}
    # cleanup
    ids = [b["user"]["id"]]
    DB.business_verifications.delete_many({"user_id": {"$in": ids}})
    DB.business_profiles.delete_many({"user_id": {"$in": ids}})
    DB.users.delete_many({"id": {"$in": ids}})
    DB.consent_records.delete_many({"user_id": {"$in": ids}})
    DB.notifications.delete_many({"user_id": {"$in": ids}})
    DB.email_events.delete_many({"user_id": {"$in": ids}})
    DB.email_deliveries.delete_many({"to_email": BIZ})
    if "business_login_links" in DB.list_collection_names():
        DB.business_login_links.delete_many({"user_id": {"$in": ids}})


def test_a_subscription_does_not_auto_verify(ctx):
    tok = ctx["biz"]["access_token"]
    r = requests.post(f"{API}/business/subscription/activate", json={"platform": "sandbox"},
                      headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["subscription"]["status"] == "active"
    # Verification status must remain NOT verified (Not Submitted / Pending Review)
    ov = requests.get(f"{API}/business/me", headers=_hdr(tok), timeout=30).json()
    vs = ov["business"]["verification_status"]
    assert vs != "Verified", f"Subscription should NOT auto-verify; got status={vs}"


def test_b_event_blocked_while_pending(ctx):
    tok = ctx["biz"]["access_token"]
    # Submit verification -> Pending Review (still not Verified)
    r = requests.post(f"{API}/business/me/verification", json={
        "legal_name": "QA Link Biz Pty Ltd", "abn": "12 000 000 000",
        "country": "Australia", "phone": "+61 3 0000 0000", "primary_contact": "QA",
        "address": "1 QA St", "document_name": "cert.pdf",
    }, headers=_hdr(tok), timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "Pending Review"
    # Attempt to publish event -> must be forbidden (verification pending)
    now = int(time.time())
    body = {
        "title": f"QA Pending Blocked {TAG}", "category": "Business Networking",
        "start_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now + 3600)),
        "end_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now + 7200)),
        "location_display": "QA venue", "lat": -37.8136, "lng": 144.9631,
    }
    r2 = requests.post(f"{API}/events", json=body, headers=_hdr(tok), timeout=30)
    assert r2.status_code in (403, 400), f"Expected block while Pending, got {r2.status_code}: {r2.text}"


def test_c_computer_link_request_redeem_and_reuse_rejected(ctx):
    tok = ctx["biz"]["access_token"]
    # Request the secure link (backend at /business/me/verification-link)
    r = requests.post(f"{API}/business/me/verification-link", json={}, headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    req = r.json()
    # Backend does NOT return the token (security) — pull from db.business_login_links
    row = DB.business_login_links.find_one(
        {"user_id": ctx["biz"]["user"]["id"]}, sort=[("created_at", -1)])
    assert row and row.get("token"), "verification link row not created"
    tk = row["token"]
    # Token must NEVER be in email_events records (security)
    for ev in DB.email_events.find({"user_id": ctx["biz"]["user"]["id"]}):
        assert tk not in str(ev), "Raw token leaked into email_events record"
    # First redeem OK
    r1 = requests.post(f"{API}/business/verification-link/redeem", json={"token": tk}, timeout=30)
    assert r1.status_code == 200, r1.text
    assert "access_token" in r1.json()
    # Reuse rejected (single-use)
    r2 = requests.post(f"{API}/business/verification-link/redeem", json={"token": tk}, timeout=30)
    assert r2.status_code in (400, 401, 403, 410), f"Reuse should be rejected, got {r2.status_code}"
    # Bogus token rejected
    r3 = requests.post(f"{API}/business/verification-link/redeem", json={"token": "bogus-" + uuid.uuid4().hex}, timeout=30)
    assert r3.status_code in (400, 401, 403, 404, 410)


def test_d_personal_registration_and_login_routes():
    r = requests.post(f"{API}/auth/register", json={
        "email": PER, "password": PWD, "name": "QA Personal Only",
        "display_name": "QAPer", "date_of_birth": "1990-01-01", "accept_policies": True,
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["account_type"] == "personal"
    tok = d["access_token"]
    me = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30).json()
    assert me["account_type"] == "personal"
    # cleanup
    DB.users.delete_many({"email": PER})
    DB.consent_records.delete_many({"user_id": d["user"]["id"]})


def test_e_demo_login_regression():
    r = requests.post(f"{API}/auth/demo-login", json={}, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["account_type"] == "personal"
    assert j["user"].get("is_demo") is True

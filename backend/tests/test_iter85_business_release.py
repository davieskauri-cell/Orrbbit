"""Iter85 ORRBBIT Business release-correction pass.

Focused tests:
- GET /api/business/me returns ~250 countries (pycountry) alphabetical.
- POST /api/business/me with country 'Japan' stores country_code 'JP'.
- GET /api/business/address-autocomplete → {enabled:false} (no GOOGLE_PLACES_API_KEY in env).
- Lock: while In Progress or Pending Review, GET /api/business/me/analytics returns 403;
  event publish returns 403. After QA admin approve → analytics 200; event creation 200.
- Control actions: start_review → 'In Review' (no email event created), revoke → 'Revoked',
  request_reverification → 'Reverification Required' (email event business_verification_more_info),
  reinstate → 'Verified'; each action audited.
"""
import os
import uuid
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/")
assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"
API = f"{BASE}/api"

QA_ADMIN_EMAIL = "qa-admin@intro.control"
QA_ADMIN_PASSWORD = "Qa!hpgOlIndvj0UbVWk"
PASS = "Iter85QA!"
DOMAIN = "orrbbitqa.example.com"


def _mongo_client():
    from pymongo import MongoClient
    return MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))


def _db():
    c = _mongo_client()
    return c[os.environ.get("DB_NAME", "test_database")]


def _mark_verified(email: str):
    db = _db()
    db.users.update_one({"email": email.lower()}, {"$set": {"email_verified": True}})


def _register(email, name="QA Biz", account_type="business"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASS, "name": name,
        "age": 30, "date_of_birth": "1994-01-01",
        "account_type": account_type,
        "accept_policies": True,
        "marketing_opt_in": False})
    assert r.status_code in (200, 201), r.text
    _mark_verified(email)
    lr = requests.post(f"{API}/auth/login", json={"email": email, "password": PASS})
    assert lr.status_code == 200, lr.text
    return lr.json()["access_token"]


def _auth_hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _admin_token():
    r = requests.post(f"{API}/control/auth/login",
                      json={"email": QA_ADMIN_EMAIL, "password": QA_ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _cleanup(email):
    db = _db()
    u = db.users.find_one({"email": email.lower()})
    if not u:
        return
    uid = u["id"]
    biz = db.business_profiles.find_one({"user_id": uid})
    if biz:
        bid = biz["id"]
        db.business_verifications.delete_many({"business_id": bid})
        db.event_reviews.delete_many({"business_id": bid})
    db.business_profiles.delete_many({"user_id": uid})
    db.business_login_links.delete_many({"user_id": uid})
    db.events.delete_many({"creator_user_id": uid})
    db.event_attendees.delete_many({"user_id": uid})
    db.notifications.delete_many({"user_id": uid})
    db.email_events.delete_many({"user_id": uid})
    db.email_deliveries.delete_many({"user_id": uid})
    db.consent_records.delete_many({"user_id": uid})
    db.admin_audit_logs.delete_many({"target_id": uid})
    db.users.delete_one({"id": uid})


@pytest.fixture
def biz_user():
    email = f"biz-iter85-{uuid.uuid4().hex[:8]}@{DOMAIN}"
    tok = _register(email)
    yield {"email": email, "token": tok}
    _cleanup(email)


def _upsert_profile(tok, country="Australia"):
    body = {
        "name": f"QA Biz {uuid.uuid4().hex[:6]}", "category": "Café",
        "email": f"contact-{uuid.uuid4().hex[:6]}@{DOMAIN}",
        "location_display": "123 Test St, Melbourne VIC 3000",
        "description": "QA test business for iter85",
        "country": country, "phone": "+61400000000",
        "primary_contact": "QA Contact", "registration_number": "12345678901",
    }
    r = requests.post(f"{API}/business/me", json=body, headers=_auth_hdr(tok))
    assert r.status_code == 200, r.text
    return r.json()


# --- 1. Country list & country_code -----------------------------------------
def test_get_me_returns_full_country_list(biz_user):
    _upsert_profile(biz_user["token"])
    r = requests.get(f"{API}/business/me", headers=_auth_hdr(biz_user["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    countries = data.get("countries") or []
    assert len(countries) >= 200, f"Expected ~250 countries, got {len(countries)}"
    # Main body should be sorted; 'Other' may be appended at the end.
    body = [c for c in countries if c != "Other"]
    assert body == sorted(body), "pycountry portion should be alphabetical"
    assert "Other" in countries
    for c in ("Australia", "Japan", "Zimbabwe", "United Kingdom"):
        assert c in countries, f"{c} missing from country list"


def test_country_code_jp_for_japan(biz_user):
    tok = biz_user["token"]
    _upsert_profile(tok, country="Australia")
    body = {
        "name": "QA Biz JP", "category": "Café",
        "email": f"jp-{uuid.uuid4().hex[:6]}@{DOMAIN}",
        "location_display": "1-1 Chiyoda, Tokyo",
        "description": "JP QA business", "country": "Japan",
        "phone": "+81301234567", "primary_contact": "QA", "registration_number": "9999",
    }
    r = requests.post(f"{API}/business/me", json=body, headers=_auth_hdr(tok))
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["business"]["country"] == "Japan"
    assert me["business"]["country_code"] == "JP"


# --- 2. Google Places address autocomplete (disabled) -----------------------
def test_address_autocomplete_disabled_without_key(biz_user):
    _upsert_profile(biz_user["token"])
    r = requests.get(f"{API}/business/address-autocomplete",
                     params={"q": "123 Collins", "country": "Australia"},
                     headers=_auth_hdr(biz_user["token"]))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("enabled") is False
    assert j.get("suggestions") == []


# --- 3. Lock: analytics 403 while pending, 200 after Verified ---------------
def test_analytics_and_event_locked_until_verified(biz_user):
    tok = biz_user["token"]
    me = _upsert_profile(tok)
    biz_id = me["business"]["id"]
    assert me["business"]["verification_status"] == "In Progress"

    # analytics 403 while In Progress
    a1 = requests.get(f"{API}/business/me/analytics", headers=_auth_hdr(tok))
    assert a1.status_code == 403, a1.text

    # activate sandbox subscription (so publish gate is only verification)
    s = requests.post(f"{API}/business/subscription/activate",
                      json={"platform": "sandbox"}, headers=_auth_hdr(tok))
    assert s.status_code == 200, s.text

    # submit verification → Pending Review
    v = requests.post(f"{API}/business/me/verification", json={
        "legal_name": "QA Biz Legal", "country": "Australia", "abn": "12345678901",
        "email": f"legal-{uuid.uuid4().hex[:6]}@{DOMAIN}", "phone": "+61400000000",
        "address": "123 Test St, Melbourne VIC 3000",
        "primary_contact": "QA Contact", "document_name": "abn.pdf",
    }, headers=_auth_hdr(tok))
    assert v.status_code == 200, v.text

    # analytics still 403 while Pending Review
    a2 = requests.get(f"{API}/business/me/analytics", headers=_auth_hdr(tok))
    assert a2.status_code == 403, a2.text

    # try to publish an event → 403
    from datetime import datetime, timedelta, timezone
    start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=2, hours=2)).isoformat()
    ev_body = {
        "title": "QA Event", "category": "Coffee / Drinks",
        "description": "Test event", "location_display": "Test venue",
        "start_datetime": start, "end_datetime": end,
        "capacity": 20, "vibe": "Networking",
        "lat": -37.8136, "lng": 144.9631,
    }
    e1 = requests.post(f"{API}/events", json=ev_body, headers=_auth_hdr(tok))
    assert e1.status_code == 403, f"Expected 403 publishing while pending, got {e1.status_code} {e1.text[:200]}"

    # QA admin approves
    adm = _admin_token()
    ap = requests.post(f"{API}/control/businesses/{biz_id}/verification",
                       json={"action": "approve", "note": "QA approved"},
                       headers={"Authorization": f"Bearer {adm}", "Content-Type": "application/json"})
    assert ap.status_code == 200, ap.text

    # analytics 200 now
    a3 = requests.get(f"{API}/business/me/analytics", headers=_auth_hdr(tok))
    assert a3.status_code == 200, a3.text
    assert a3.json().get("verified") is True

    # event publish 200 now
    e2 = requests.post(f"{API}/events", json=ev_body, headers=_auth_hdr(tok))
    assert e2.status_code in (200, 201), f"Expected event creation OK after approve, got {e2.status_code} {e2.text[:200]}"


# --- 4. Control actions: start_review / revoke / request_reverification -----
def test_control_actions_lifecycle_and_audit(biz_user):
    tok = biz_user["token"]
    me = _upsert_profile(tok)
    biz_id = me["business"]["id"]

    # submit verification → Pending Review
    requests.post(f"{API}/business/me/verification", json={
        "legal_name": "QA Biz Legal", "country": "Australia", "abn": "12345678901",
        "email": f"legal-{uuid.uuid4().hex[:6]}@{DOMAIN}", "phone": "+61400000000",
        "address": "123 Test St, Melbourne VIC 3000",
        "primary_contact": "QA Contact", "document_name": "abn.pdf",
    }, headers=_auth_hdr(tok))

    adm = _admin_token()
    ahdr = {"Authorization": f"Bearer {adm}", "Content-Type": "application/json"}
    db = _db()

    # get owner user_id
    biz_row = db.business_profiles.find_one({"id": biz_id})
    owner_id = biz_row["user_id"]

    def _post(action, note="qa"):
        r = requests.post(f"{API}/control/businesses/{biz_id}/verification",
                          json={"action": action, "note": note}, headers=ahdr)
        assert r.status_code == 200, f"{action}: {r.status_code} {r.text[:300]}"
        return r.json()

    # start_review → In Review, NO business_verification_start_review email template exists,
    # but the current mapping still calls notify_user_action with tpl=None for start_review.
    before_emails = db.email_events.count_documents(
        {"user_id": owner_id, "template": {"$regex": "^business_verification"}})
    j1 = _post("start_review")
    assert j1["status"] == "In Review"
    after_emails = db.email_events.count_documents(
        {"user_id": owner_id, "template": {"$regex": "^business_verification"}})
    # start_review has tpl=None → no NEW verification email event should be recorded
    assert after_emails == before_emails, "start_review should not send an email"

    # revoke → Revoked
    j2 = _post("revoke", note="Compliance")
    assert j2["status"] == "Revoked"

    # request_reverification → Reverification Required + email business_verification_more_info
    j3 = _post("request_reverification", note="Please resubmit ABN")
    assert j3["status"] == "Reverification Required"
    ev = db.email_events.find_one(
        {"user_id": owner_id, "template": "business_verification_more_info"})
    assert ev is not None, "expected business_verification_more_info email event"

    # reinstate → Verified
    j4 = _post("reinstate")
    assert j4["status"] == "Verified"

    # each of the 4 actions audited (target_id=biz_id)
    audits = list(db.admin_audit_logs.find(
        {"target_id": biz_id,
         "action": {"$in": ["business_verification_start_review",
                            "business_verification_revoke",
                            "business_verification_request_reverification",
                            "business_verification_reinstate"]}}))
    actions_seen = {a["action"] for a in audits}
    for a in ("business_verification_start_review", "business_verification_revoke",
              "business_verification_request_reverification",
              "business_verification_reinstate"):
        assert a in actions_seen, f"missing audit for {a}: got {actions_seen}"

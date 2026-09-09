"""
Iter80 Business Platform — end-to-end API integration test.
Exercises the same public preview backend the mobile/web UI hits.
The mobile UI itself is verified separately via Playwright; this file
proves the wire-level flows the UI depends on.
"""
import os
import time
import uuid
import pymongo
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else None
if not BASE:
    # Fall back to frontend/.env (test harness runs from /app)
    from dotenv import dotenv_values
    BASE = dotenv_values("/app/frontend/.env")["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = os.environ.get("DB_NAME") or "test_database"

RAND = uuid.uuid4().hex[:6]
BIZ_EMAIL = f"qa.ta80.{RAND}@example.com"
PERSONA_EMAIL = f"qa.ta80.persona{RAND}@example.com"
PWD = "Password123!"

state = {}


@pytest.fixture(scope="module")
def mongo():
    c = pymongo.MongoClient(MONGO_URL)
    db = c[DB_NAME]
    yield db
    # Cleanup after all tests
    for email in [BIZ_EMAIL, PERSONA_EMAIL]:
        u = db.users.find_one({"email": email})
        if u:
            uid = u["id"]
            db.users.delete_many({"email": email})
            db.consent_records.delete_many({"user_id": uid})
            db.notifications.delete_many({"user_id": uid})
            db.email_events.delete_many({"user_id": uid})
            db.email_deliveries.delete_many({"user_id": uid})
            db.business_profiles.delete_many({"user_id": uid})
            db.business_verifications.delete_many({"user_id": uid})
    db.events.delete_many({"title": {"$in": ["TA Blue Networking", "TA Desktop Event"]}})
    db.event_attendees.delete_many({})  # attendee rows for missing events are safe leftovers
    c.close()


def _headers(tok):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {tok}"}


# ---- FLOW 1 — signup with account_type=business + verify-email gate ------
def test_1_business_signup(mongo):
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": BIZ_EMAIL, "password": PWD, "name": "QA TA Biz Private",
        "display_name": "TABizQA", "account_type": "business",
        "date_of_birth": "1990-01-01", "accept_policies": True,
    })
    assert r.status_code in (200, 201), r.text
    d = r.json()
    assert "access_token" in d
    state["biz_token"] = d["access_token"]
    state["biz_user_id"] = d["user"]["id"]
    assert d["user"]["account_type"] == "business"
    assert d["user"]["email_verified"] is False


def test_2_email_verify_via_mongo(mongo):
    mongo.users.update_one({"id": state["biz_user_id"]},
                           {"$set": {"email_verified": True, "email_verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")}})
    me = requests.get(f"{BASE}/api/auth/me", headers=_headers(state["biz_token"])).json()
    assert me["email_verified"] is True
    assert me["account_type"] == "business"


# ---- FLOW 2 — business setup + sandbox subscription activation -----------
def test_3_business_profile_setup():
    body = {
        "name": "TA Park Hotel", "category": "Hotel", "email": BIZ_EMAIL,
        "location_display": "Melbourne CBD",
        "description": "A cosy inner-city hotel with a garden bar and rooftop lounge for QA testing.",
        "logo_url": "https://picsum.photos/seed/orrbbitlogo/200",
        "cover_url": "https://picsum.photos/seed/orrbbitcover/800/400",
        "lat": -37.8136, "lng": 144.9631,
    }
    r = requests.post(f"{BASE}/api/business/me", json=body, headers=_headers(state["biz_token"]))
    assert r.status_code in (200, 201), r.text
    prof = r.json()
    biz = prof.get("business") or prof
    assert biz.get("name") == "TA Park Hotel"
    # Persist verification
    ov = requests.get(f"{BASE}/api/business/me", headers=_headers(state["biz_token"])).json()
    assert ov["business"]["category"] == "Hotel"


def test_4_activate_sandbox_subscription():
    r = requests.post(f"{BASE}/api/business/subscription/activate", json={"platform": "sandbox"},
                      headers=_headers(state["biz_token"]))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True or (d.get("subscription") or {}).get("status") == "active", d
    # Iter81: publishing now also requires APPROVED verification — set it for flow tests
    import pymongo as _pm
    _pm.MongoClient(MONGO_URL)[DB_NAME].business_profiles.update_one(
        {"user_id": state["biz_user_id"]}, {"$set": {"verification_status": "Verified"}})


# ---- FLOW 3 — Business event create (blue banner, offer, host_type) ------
def test_5_business_event_create():
    body = {
        "title": "TA Blue Networking", "category": "Business Networking",
        "start_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 3600)),
        "end_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 4 * 3600)),
        "location_display": "QA venue", "description": "Networking evening at TA Park Hotel.",
        "offer": "2-for-1 drinks",
        "lat": -37.8136, "lng": 144.9631,
    }
    r = requests.post(f"{BASE}/api/events", json=body, headers=_headers(state["biz_token"]))
    assert r.status_code in (200, 201), r.text
    ev = r.json()
    state["biz_event_id"] = ev["id"]
    assert ev.get("host_type") == "business"
    assert ev.get("offer") == "2-for-1 drinks"


# ---- FLOW 4 — Personal user sees blue business event on Nearby -----------
def test_6_personal_account(mongo):
    r = requests.post(f"{BASE}/api/auth/register", json={
        "email": PERSONA_EMAIL, "password": PWD, "name": "TA Persona",
        "display_name": "TAPersona", "account_type": "personal",
        "date_of_birth": "1995-05-05", "accept_policies": True,
    })
    assert r.status_code in (200, 201), r.text
    state["persona_token"] = r.json()["access_token"]
    state["persona_id"] = r.json()["user"]["id"]
    # Fully seed the persona so radar accepts them: verified + bio + interests + photos + city
    mongo.users.update_one({"id": state["persona_id"]}, {"$set": {
        "email_verified": True, "bio": "QA persona used for iter80 business platform tests, hi!",
        "interests": ["coffee", "networking", "reading"],
        "photos": ["https://picsum.photos/seed/p1/300", "https://picsum.photos/seed/p2/300", "https://picsum.photos/seed/p3/300"],
        "city": "Melbourne", "home_city": "Melbourne", "country": "AU",
        "lat": -37.8136, "lng": 144.9631, "profile_required_complete": True,
    }})


def test_7_nearby_events_shows_blue_biz():
    r = requests.get(f"{BASE}/api/events/nearby?lat=-37.8136&lng=144.9631&radius_km=25",
                     headers=_headers(state["persona_token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    events = data.get("events") if isinstance(data, dict) else data
    ids = [e.get("id") for e in events]
    assert state["biz_event_id"] in ids, f"Business event not in nearby list: {ids[:5]}"
    biz = next(e for e in events if e["id"] == state["biz_event_id"])
    assert biz.get("host_type") == "business"
    assert biz.get("offer") == "2-for-1 drinks"


# ---- FLOW 5 — Desktop create + sync + cancel ------------------------------
def test_8_desktop_create_and_cancel():
    body = {
        "title": "TA Desktop Event", "category": "Workshop",
        "start_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 2 * 24 * 3600)),
        "end_datetime": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 2 * 24 * 3600 + 3 * 3600)),
        "location_display": "TA Park Hotel", "description": "Desktop-created event for QA sync test.",
        "lat": -37.8136, "lng": 144.9631,
    }
    r = requests.post(f"{BASE}/api/events", json=body, headers=_headers(state["biz_token"]))
    assert r.status_code in (200, 201), r.text
    eid = r.json()["id"]
    state["desktop_event_id"] = eid
    mine = requests.get(f"{BASE}/api/events/mine", headers=_headers(state["biz_token"])).json()
    titles = [e["title"] for e in (mine.get("hosting") or mine.get("events") or [])]
    assert "TA Desktop Event" in titles

    # Cancel
    r = requests.post(f"{BASE}/api/events/{eid}/cancel", headers=_headers(state["biz_token"]))
    assert r.status_code == 200, r.text
    ev = requests.get(f"{BASE}/api/events/{eid}", headers=_headers(state["biz_token"])).json()
    assert ev["status"] in ("cancelled", "CANCELLED"), ev

    # Persona should not see it in nearby
    near = requests.get(f"{BASE}/api/events/nearby?lat=-37.8136&lng=144.9631&radius_km=25",
                         headers=_headers(state["persona_token"])).json()
    events = near.get("events") if isinstance(near, dict) else near
    assert eid not in [e["id"] for e in events]


# ---- FLOW 6 — Control Centre listing via preview backend ------------------
def test_9_control_center_businesses():
    r = requests.post(f"{BASE}/api/control/auth/login",
                      json={"email": "qa-admin@intro.control", "password": "Qa!hpgOlIndvj0UbVWk"})
    assert r.status_code == 200, r.text
    j = r.json()
    tok = j.get("token") or j.get("access_token")
    assert tok, f"No token in control login response: {j}"
    r = requests.get(f"{BASE}/api/control/businesses",
                     headers={"Authorization": f"Bearer {tok}", "X-Admin-Mode": "live"})
    assert r.status_code == 200, r.text
    data = r.json()
    biz = data.get("businesses") if isinstance(data, dict) else data
    names = [b.get("name") for b in biz]
    assert "TA Park Hotel" in names, f"TA Park Hotel not listed: sample={names[:5]}"


# ---- FLOW 7 — Regression: demo login unaffected ---------------------------
def test_10_demo_login_still_works():
    r = requests.post(f"{BASE}/api/auth/demo-login", json={})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["account_type"] == "personal"
    assert d["user"].get("is_demo") is True

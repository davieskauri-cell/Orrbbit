"""Business platform E2E backend QA (Iter80).

Covers: business signup → profile → verification → control approval → event
publish → personal joins → filters → completion → review eligibility →
rating aggregation → moderation → deletion cascade / orphan rule.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"
MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]

TAG = uuid.uuid4().hex[:8]
BIZ_EMAIL = f"qa.biz.{TAG}@example.com"
P1_EMAIL = f"qa.p1.{TAG}@example.com"
P2_EMAIL = f"qa.p2.{TAG}@example.com"
LAT, LNG = -37.8136, 144.9631


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def _register(email, name, display, account_type="personal"):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Password123!", "name": name, "display_name": display,
        "account_type": account_type, "date_of_birth": "1990-01-01",
        "accept_policies": True}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    DB.users.update_one({"id": d["user"]["id"]}, {"$set": {"email_verified": True}})
    return d


def _admin_token():
    import re as _re
    creds = open("/app/memory/test_credentials.md").read()
    m = _re.search(r"QA Admin.*?`([^`]+)`\s*/\s*`([^`]+)`", creds)
    email, pw = m.group(1), m.group(2)
    r = requests.post(f"{API}/control/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"], pw


@pytest.fixture(scope="module")
def ctx():
    biz = _register(BIZ_EMAIL, "QA Biz Owner Private", "ParkHotelOwner", "business")
    p1 = _register(P1_EMAIL, "QA Person One", "Pia")
    p2 = _register(P2_EMAIL, "QA Person Two", "Rui")
    state = {"biz": biz, "p1": p1, "p2": p2}
    yield state
    ids = [biz["user"]["id"], p1["user"]["id"], p2["user"]["id"]]
    ev_ids = [e["id"] for e in DB.events.find({"creator_user_id": {"$in": ids}}, {"id": 1})]
    DB.event_attendees.delete_many({"event_id": {"$in": ev_ids}})
    DB.event_reviews.delete_many({"event_id": {"$in": ev_ids}})
    DB.events.delete_many({"id": {"$in": ev_ids}})
    DB.business_verifications.delete_many({"user_id": {"$in": ids}})
    DB.business_profiles.delete_many({"user_id": {"$in": ids}})
    DB.users.delete_many({"id": {"$in": ids}})
    DB.consent_records.delete_many({"user_id": {"$in": ids}})
    DB.notifications.delete_many({"user_id": {"$in": ids}})
    DB.email_deliveries.delete_many({"to_email": {"$in": [BIZ_EMAIL, P1_EMAIL, P2_EMAIL]}})
    DB.email_events.delete_many({"user_id": {"$in": ids}})
    DB.analytics_events.delete_many({"user_id": {"$in": ids}})


def test_01_business_signup_and_profile(ctx):
    biz = ctx["biz"]
    assert biz["user"]["account_type"] == "business"
    assert biz["user"]["profile_required_complete"] is True  # own setup gate instead
    r = requests.post(f"{API}/business/me", json={
        "name": "The Park Hotel QA", "category": "Hotel", "email": BIZ_EMAIL,
        "location_display": "Melbourne CBD", "description": "QA hotel venue for events and happy hours.",
        "logo_url": "https://picsum.photos/seed/qalogo/200", "cover_url": "https://picsum.photos/seed/qacover/800/400",
        "lat": LAT, "lng": LNG, "website": "https://parkhotel.example.com",
    }, headers=_hdr(biz["access_token"]), timeout=30)
    assert r.status_code == 200, r.text
    b = r.json()["business"]
    assert b["verification_status"] == "Not Submitted"
    ctx["biz_id"] = b["id"]
    # staging subscription (sandbox billing mode) — $5.99 entitlement, no real charge
    r_sub = requests.post(f"{API}/business/subscription/activate", json={"platform": "sandbox"},
                          headers=_hdr(biz["access_token"]), timeout=30)
    assert r_sub.status_code == 200 and r_sub.json()["subscription"]["status"] == "active"
    assert r_sub.json()["subscription"]["sandbox"] is True
    # personal accounts cannot access business endpoints
    r2 = requests.get(f"{API}/business/me", headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    assert r2.status_code == 403


def test_02_business_hidden_from_people_radar(ctx):
    DB.users.update_one({"id": ctx["biz"]["user"]["id"]}, {"$set": {
        "lat": LAT, "lng": LNG, "visible": True, "photos": ["x"] * 3,
        "bio": "long enough bio to pass all people gates for discovery here"}})
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG},
                     headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    ids = {u["id"] for u in r.json()["users"]}
    assert ctx["biz"]["user"]["id"] not in ids


def test_03_verification_flow_and_control_approval(ctx):
    biz = ctx["biz"]
    r = requests.post(f"{API}/business/me/verification", json={
        "legal_name": "Park Hotel QA Pty Ltd", "abn": "12 345 678 901",
        "address": "123 Collins St", "document_name": "registration.pdf",
    }, headers=_hdr(biz["access_token"]), timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "Pending Review"
    atk, apw = _admin_token()
    ctx["atk"], ctx["apw"] = atk, apw
    lst = requests.get(f"{API}/control/businesses", params={"status": "Pending Review"},
                       headers=_hdr(atk), timeout=30).json()["businesses"]
    assert any(b["id"] == ctx["biz_id"] for b in lst)
    r2 = requests.post(f"{API}/control/businesses/{ctx['biz_id']}/verification",
                       json={"action": "approve", "note": "QA approval"}, headers=_hdr(atk), timeout=60)
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "Verified"
    comm = r2.json()["communication"]
    assert comm["notification"] in ("sent", "duplicate_skipped")
    assert comm["email"] in ("sent", "skipped", "suppressed", "failed")  # delivery status recorded
    det = requests.get(f"{API}/control/businesses/{ctx['biz_id']}", headers=_hdr(atk), timeout=30).json()
    assert det["business"]["verification_status"] == "Verified"
    assert det["verifications"][0]["document_name"] == "registration.pdf"  # admin-only visibility
    # public payload never exposes documents
    pub = requests.get(f"{API}/business/public/{ctx['biz_id']}",
                       headers=_hdr(ctx["p1"]["access_token"]), timeout=30).json()
    assert pub["verified"] is True and "document_name" not in str(pub)


def test_04_business_event_create_and_filters(ctx):
    biz = ctx["biz"]
    now = datetime.now(timezone.utc)
    def mk(title, cat, start_h, offer=None, tok=None):
        r = requests.post(f"{API}/events", json={
            "title": title, "category": cat, "lat": LAT, "lng": LNG,
            "location_display": "QA venue", "offer": offer,
            "start_datetime": (now + timedelta(hours=start_h)).isoformat(),
            "end_datetime": (now + timedelta(hours=start_h + 2)).isoformat(),
        }, headers=_hdr(tok or biz["access_token"]), timeout=30)
        assert r.status_code == 200, r.text
        return r.json()
    b1 = mk("QA Biz Networking Night", "Business Networking", 3)
    b2 = mk("QA Friday Happy Hour", "Food Deals / Discounts", 5, offer="20% off selected drinks 5-7pm")
    p1ev = mk("QA Personal Fitness Run", "Fitness", 4, tok=ctx["p1"]["access_token"])
    ctx["b1"], ctx["b2"], ctx["p1ev"] = b1, b2, p1ev
    assert b1["host_type"] == "business" and b1["host"]["name"] == "The Park Hotel QA"
    assert b1["host"]["verified"] is True and b1["business_id"] == ctx["biz_id"]
    assert b2["offer"] == "20% off selected drinks 5-7pm"
    assert p1ev["host_type"] == "personal" and p1ev["host"]["name"] == "Pia"
    tok2 = ctx["p2"]["access_token"]
    def nearby(**params):
        r = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG, **params},
                         headers=_hdr(tok2), timeout=30)
        return {e["title"]: e for e in r.json()["events"]}
    all_ev = nearby()
    assert {"QA Biz Networking Night", "QA Friday Happy Hour", "QA Personal Fitness Run"} <= set(all_ev)
    biz_only = nearby(host_type="business")
    assert "QA Biz Networking Night" in biz_only and "QA Personal Fitness Run" not in biz_only
    pers_only = nearby(host_type="personal")
    assert "QA Personal Fitness Run" in pers_only and "QA Friday Happy Hour" not in pers_only
    combo = nearby(host_type="business", category="Food Deals / Discounts")
    assert set(k for k in combo if k.startswith("QA ")) == {"QA Friday Happy Hour"}
    today = nearby(date="today", host_type="business")
    assert "QA Biz Networking Night" in today
    tomorrow = nearby(date="tomorrow")
    assert "QA Biz Networking Night" not in tomorrow


def test_05_join_attendee_management(ctx):
    ev_id = ctx["b1"]["id"]
    for p in ("p1", "p2"):
        r = requests.post(f"{API}/events/{ev_id}/join", headers=_hdr(ctx[p]["access_token"]), timeout=30)
        assert r.status_code == 200 and r.json()["join_status"] == "accepted"
    atts = requests.get(f"{API}/events/{ev_id}/attendees",
                        headers=_hdr(ctx["biz"]["access_token"]), timeout=30).json()
    names = {a["name"] for a in atts["attendees"]}
    assert {"Pia", "Rui"} <= names  # display names only, never full names
    ov = requests.get(f"{API}/business/me/overview", headers=_hdr(ctx["biz"]["access_token"]), timeout=30).json()
    assert ov["people_going"] >= 2 and ov["active_events"] >= 2
    assert ov["business_name"] == "The Park Hotel QA" and ov["verified"] is True


def test_06_review_eligibility_and_rating(ctx):
    ev_id = ctx["b1"]["id"]
    # p2 cancels attendance BEFORE event ends → loses eligibility, no review request
    requests.post(f"{API}/events/{ev_id}/leave", headers=_hdr(ctx["p2"]["access_token"]), timeout=30)
    # not ended yet → blocked
    r = requests.post(f"{API}/events/{ev_id}/review", json={"rating": 5},
                      headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    assert r.status_code == 403
    # end the event, trigger lazy completion via nearby fetch
    past = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    DB.events.update_one({"id": ev_id}, {"$set": {"end_datetime": past}})
    requests.get(f"{API}/events/{ev_id}", headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    # eligible attendee got the review request notification; cancelled attendee did not
    assert DB.notifications.find_one({"user_id": ctx["p1"]["user"]["id"], "type": "review_request",
                                      "event_id": ev_id})
    assert not DB.notifications.find_one({"user_id": ctx["p2"]["user"]["id"], "type": "review_request",
                                          "event_id": ev_id})
    # review request email attempt recorded for eligible attendee
    assert DB.email_events.find_one({"user_id": ctx["p1"]["user"]["id"],
                                     "template": "business_review_request"})
    el = requests.get(f"{API}/events/{ev_id}/review/eligibility",
                      headers=_hdr(ctx["p1"]["access_token"]), timeout=30).json()
    assert el["eligible"] is True and el["event"]["business_name"] == "The Park Hotel QA"
    # cancelled attendee blocked server-side even if a notification were queued
    r2 = requests.post(f"{API}/events/{ev_id}/review", json={"rating": 4},
                       headers=_hdr(ctx["p2"]["access_token"]), timeout=30)
    assert r2.status_code == 403
    # eligible submits
    r3 = requests.post(f"{API}/events/{ev_id}/review",
                       json={"rating": 5, "text": "Great night!", "tags": ["Great atmosphere"]},
                       headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    assert r3.status_code == 200
    ctx["review_id"] = r3.json()["review_id"]
    # duplicate blocked
    r4 = requests.post(f"{API}/events/{ev_id}/review", json={"rating": 1},
                       headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    assert r4.status_code == 403
    # aggregation on public profile
    pub = requests.get(f"{API}/business/public/{ctx['biz_id']}",
                       headers=_hdr(ctx["p2"]["access_token"]), timeout=30).json()
    assert pub["average_rating"] == 5.0 and pub["review_count"] == 1
    assert pub["rating_distribution"]["5"] == 1
    assert pub["reviews"][0]["reviewer_name"] == "Pia"


def test_07_review_moderation(ctx):
    atk = ctx["atk"]
    rid = ctx["review_id"]
    requests.post(f"{API}/reviews/{rid}/report", json={"reason": "test report"},
                  headers=_hdr(ctx["biz"]["access_token"]), timeout=30)
    reported = requests.get(f"{API}/control/business-reviews", params={"filter": "Reported"},
                            headers=_hdr(atk), timeout=30).json()["reviews"]
    assert any(r["id"] == rid for r in reported)
    r = requests.post(f"{API}/control/business-reviews/{rid}/action",
                      json={"action": "remove", "reason": "QA moderation"}, headers=_hdr(atk), timeout=30)
    assert r.status_code == 200
    pub = requests.get(f"{API}/business/public/{ctx['biz_id']}",
                       headers=_hdr(ctx["p2"]["access_token"]), timeout=30).json()
    assert pub["review_count"] == 0  # removed review no longer counts
    r2 = requests.post(f"{API}/control/business-reviews/{rid}/action",
                       json={"action": "restore"}, headers=_hdr(atk), timeout=30)
    assert r2.status_code == 200
    assert DB.admin_audit_logs.find_one({"action": "review_remove", "target_id": rid})


def test_08_ownership_security(ctx):
    # p1 (personal) cannot edit the business event; another biz cannot either
    ev_id = ctx["b2"]["id"]
    now = datetime.now(timezone.utc)
    full = {"title": "hacked", "category": "Social", "lat": LAT, "lng": LNG,
            "location_display": "x", "start_datetime": (now + timedelta(hours=1)).isoformat(),
            "end_datetime": (now + timedelta(hours=2)).isoformat()}
    r = requests.put(f"{API}/events/{ev_id}", json=full,
                     headers=_hdr(ctx["p1"]["access_token"]), timeout=30)
    assert r.status_code in (403, 404)
    r2 = requests.post(f"{API}/events/{ev_id}/cancel", headers=_hdr(ctx["p2"]["access_token"]), timeout=30)
    assert r2.status_code in (403, 404)


def test_09_subscription_gate(ctx):
    # expired subscription blocks NEW event publishing (history untouched)
    DB.business_profiles.update_one({"id": ctx["biz_id"]}, {"$set": {"subscription.status": "expired"}})
    now = datetime.now(timezone.utc)
    r = requests.post(f"{API}/events", json={
        "title": "QA Blocked Event", "category": "Social", "lat": LAT, "lng": LNG,
        "location_display": "x", "start_datetime": (now + timedelta(hours=2)).isoformat(),
        "end_datetime": (now + timedelta(hours=4)).isoformat(),
    }, headers=_hdr(ctx["biz"]["access_token"]), timeout=30)
    assert r.status_code == 403
    sub = requests.get(f"{API}/business/subscription", headers=_hdr(ctx["biz"]["access_token"]), timeout=30).json()
    assert sub["product_id"] == "orrbbit_business_monthly" and sub["price"] == "$5.99/month"
    assert sub["status"] == "expired" and sub["can_publish"] is False
    DB.business_profiles.update_one({"id": ctx["biz_id"]}, {"$set": {"subscription.status": "not_subscribed"}})


def test_10_business_deletion_cascade(ctx):
    # attendee joins the still-active happy hour, then admin deletes the business account
    ev_id = ctx["b2"]["id"]
    requests.post(f"{API}/events/{ev_id}/join", headers=_hdr(ctx["p2"]["access_token"]), timeout=30)
    requests.post(f"{API}/control/auth/reauth", json={"password": ctx["apw"]},
                  headers=_hdr(ctx["atk"]), timeout=30)  # high-risk action gate
    r = requests.post(f"{API}/control/users/{ctx['biz']['user']['id']}/action",
                      json={"action": "delete", "reason": "QA cascade"}, headers=_hdr(ctx["atk"]), timeout=60)
    assert r.status_code == 200, r.text
    ev = DB.events.find_one({"id": ev_id})
    assert ev["status"] == "cancelled"
    # discovery no longer returns it
    near = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG},
                        headers=_hdr(ctx["p2"]["access_token"]), timeout=30).json()["events"]
    assert all(e["id"] != ev_id for e in near)
    # attendee notified
    assert DB.notifications.find_one({"user_id": ctx["p2"]["user"]["id"],
                                      "$or": [{"event_id": ev_id}, {"body": {"$regex": "Happy Hour"}}]})

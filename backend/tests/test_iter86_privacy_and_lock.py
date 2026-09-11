"""Iter86 QA — Business platform LOCK + personal event privacy update.

Covers the changed spec:
1. Business platform full lock (403 on protected endpoints, /me/overview zeroed
   with only status+subscription, /me/reviews 403, /me/analytics 403,
   POST /api/events 403) while non-Verified. After Control Centre approval
   → analytics/reviews 200 and (given active sandbox subscription) event
   publish succeeds.
2. Personal event address privacy: join_type='approval' events redact
   location_display + coarsen distance/bearing to 100m/45deg for viewers
   who are NOT host and NOT accepted attendees. Everyone events show
   the address normally.
3. Approval / decline notifications carry no address.
4. Host attendee list includes declined (was missing before iter86).
5. Approval email CTA link is DIRECTLY .../business/dashboard (never
   the /api/email/open interstitial).
"""
import os
import re
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
    DB.users.update_one({"id": d["user"]["id"]}, {"$set": {"email_verified": True, "lat": LAT, "lng": LNG}})
    return d


def _admin_token():
    creds = open("/app/memory/test_credentials.md").read()
    m = re.search(r"QA Admin.*?`([^`]+)`\s*/\s*`([^`]+)`", creds)
    email, pw = m.group(1), m.group(2)
    r = requests.post(f"{API}/control/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"], pw


@pytest.fixture(scope="module")
def ctx():
    biz = _register(f"qa.biz86.{TAG}@example.com", "QA Biz86 Owner", "Biz86", "business")
    host = _register(f"qa.host86.{TAG}@example.com", "QA Host86", "Hosty")
    v1 = _register(f"qa.v186.{TAG}@example.com", "QA Viewer1", "V1")
    v2 = _register(f"qa.v286.{TAG}@example.com", "QA Viewer2", "V2")
    state = {"biz": biz, "host": host, "v1": v1, "v2": v2}
    yield state
    ids = [state[k]["user"]["id"] for k in ("biz", "host", "v1", "v2")]
    ev_ids = [e["id"] for e in DB.events.find({"creator_user_id": {"$in": ids}}, {"id": 1})]
    DB.event_attendees.delete_many({"event_id": {"$in": ev_ids}})
    DB.events.delete_many({"id": {"$in": ev_ids}})
    DB.business_verifications.delete_many({"user_id": {"$in": ids}})
    DB.business_profiles.delete_many({"user_id": {"$in": ids}})
    DB.users.delete_many({"id": {"$in": ids}})
    DB.notifications.delete_many({"user_id": {"$in": ids}})
    DB.email_events.delete_many({"user_id": {"$in": ids}})
    DB.email_deliveries.delete_many({"user_id": {"$in": ids}})
    DB.consent_records.delete_many({"user_id": {"$in": ids}})


# --------------------------------------------------------------------- BUSINESS LOCK

def test_01_biz_lock_in_progress(ctx):
    biz = ctx["biz"]
    r = requests.post(f"{API}/business/me", json={
        "name": "QA86 Hotel", "category": "Hotel", "email": biz["user"]["email"],
        "location_display": "Melbourne CBD", "description": "QA lock test business.",
        "logo_url": "https://picsum.photos/seed/qa86logo/200",
        "cover_url": "https://picsum.photos/seed/qa86cover/800/400",
        "lat": LAT, "lng": LNG, "website": "https://qa86.example.com",
    }, headers=_hdr(biz["access_token"]), timeout=30)
    assert r.status_code == 200, r.text
    ctx["biz_id"] = r.json()["business"]["id"]
    # subscription active so ONLY verification (not billing) locks event publish
    r_sub = requests.post(f"{API}/business/subscription/activate",
                          json={"platform": "sandbox"}, headers=_hdr(biz["access_token"]), timeout=30)
    assert r_sub.status_code == 200

    # In Progress → overview redacted / analytics 403 / reviews 403 / event 403
    ov = requests.get(f"{API}/business/me/overview", headers=_hdr(biz["access_token"]), timeout=30)
    assert ov.status_code == 200
    d = ov.json()
    assert d["verified"] is False
    assert d["verification_status"] == "In Progress"
    assert d["active_events"] == 0 and d["people_going"] == 0 and d["event_views"] == 0
    assert d["can_publish"] is False

    an = requests.get(f"{API}/business/me/analytics", headers=_hdr(biz["access_token"]), timeout=30)
    assert an.status_code == 403

    rv = requests.get(f"{API}/business/me/reviews", headers=_hdr(biz["access_token"]), timeout=30)
    assert rv.status_code == 403

    now = datetime.now(timezone.utc)
    ev = requests.post(f"{API}/events", json={
        "title": "Should Be Blocked", "category": "Business Networking", "lat": LAT, "lng": LNG,
        "location_display": "Blocked venue",
        "start_datetime": (now + timedelta(hours=2)).isoformat(),
        "end_datetime": (now + timedelta(hours=4)).isoformat(),
    }, headers=_hdr(biz["access_token"]), timeout=30)
    assert ev.status_code == 403


def test_02_biz_lock_pending_review(ctx):
    biz = ctx["biz"]
    r = requests.post(f"{API}/business/me/verification", json={
        "legal_name": "QA86 Hotel Pty Ltd", "abn": "12 345 678 902",
        "country": "Australia", "phone": "+61 3 8888 8888", "primary_contact": "QA Owner",
        "address": "42 QA St", "document_name": "registration.pdf",
    }, headers=_hdr(biz["access_token"]), timeout=30)
    assert r.status_code == 200 and r.json()["status"] == "Pending Review"

    ov = requests.get(f"{API}/business/me/overview", headers=_hdr(biz["access_token"]), timeout=30).json()
    assert ov["verification_status"] == "Pending Review"
    assert ov["can_publish"] is False and ov["verified"] is False
    assert ov["active_events"] == 0 and ov["event_views"] == 0

    assert requests.get(f"{API}/business/me/analytics", headers=_hdr(biz["access_token"]), timeout=30).status_code == 403
    assert requests.get(f"{API}/business/me/reviews", headers=_hdr(biz["access_token"]), timeout=30).status_code == 403


def test_03_biz_approve_unlocks(ctx):
    atk, _ = _admin_token()
    ctx["atk"] = atk
    r = requests.post(f"{API}/control/businesses/{ctx['biz_id']}/verification",
                      json={"action": "approve", "note": "QA86 approve"},
                      headers=_hdr(atk), timeout=60)
    assert r.status_code == 200 and r.json()["status"] == "Verified"

    # notification created + email event with template business_verification_approved
    assert DB.notifications.find_one({"user_id": ctx["biz"]["user"]["id"],
                                      "type": {"$regex": "business_verification"}})
    assert DB.email_events.find_one({"user_id": ctx["biz"]["user"]["id"],
                                     "template": "business_verification_approved"})

    # analytics + reviews now accessible
    an = requests.get(f"{API}/business/me/analytics", headers=_hdr(ctx["biz"]["access_token"]), timeout=30)
    assert an.status_code == 200
    rv = requests.get(f"{API}/business/me/reviews", headers=_hdr(ctx["biz"]["access_token"]), timeout=30)
    assert rv.status_code == 200

    ov = requests.get(f"{API}/business/me/overview", headers=_hdr(ctx["biz"]["access_token"]), timeout=30).json()
    assert ov["verified"] is True and ov["verification_status"] == "Verified"


def test_04_approval_email_cta_direct_dashboard(ctx):
    """Preview endpoint must render CTA <a href='.../business/dashboard'>
    NOT the /api/email/open interstitial."""
    atk = ctx["atk"]
    r = requests.get(f"{API}/control/email/templates/business_verification_approved/preview",
                     headers=_hdr(atk), timeout=30)
    assert r.status_code == 200, r.text
    payload = r.json()
    # response shape varies (html vs {html:..})
    html = payload.get("html") if isinstance(payload, dict) else str(payload)
    if not html and isinstance(payload, dict):
        html = payload.get("preview", {}).get("html") or str(payload)
    assert "Access Business Dashboard" in html
    # There should be a direct href ending with /business/dashboard
    hrefs = re.findall(r'href="([^"]+)"', html)
    assert any(h.rstrip("/").endswith("/business/dashboard") for h in hrefs), f"No direct dashboard href: {hrefs}"
    # And no /api/email/open interstitial should be used for THIS CTA
    # (email/open may still exist in tracking pixel — allow but not on CTA <a>)
    dashboard_hrefs = [h for h in hrefs if "business/dashboard" in h]
    for h in dashboard_hrefs:
        assert "/api/email/open" not in h, f"CTA still routes through /api/email/open: {h}"


# --------------------------------------------------------------------- PERSONAL EVENT PRIVACY

@pytest.fixture(scope="module")
def personal_events(ctx):
    """Create one everyone + one approval-required personal event owned by host."""
    now = datetime.now(timezone.utc)
    tok = ctx["host"]["access_token"]

    def mk(title, join_type, loc_disp):
        r = requests.post(f"{API}/events", json={
            "title": title, "category": "Social", "lat": LAT, "lng": LNG,
            "location_display": loc_disp, "join_type": join_type,
            "start_datetime": (now + timedelta(hours=3)).isoformat(),
            "end_datetime": (now + timedelta(hours=5)).isoformat(),
        }, headers=_hdr(tok), timeout=30)
        assert r.status_code == 200, r.text
        return r.json()

    pub = mk(f"QA86 Public Event {TAG}", "everyone", "123 Public St, Melbourne")
    priv = mk(f"QA86 Approval Event {TAG}", "approval", "555 Secret Lane, Melbourne")
    return {"pub": pub, "priv": priv}


def test_05_everyone_event_shows_address(ctx, personal_events):
    ev_id = personal_events["pub"]["id"]
    r = requests.get(f"{API}/events/{ev_id}", headers=_hdr(ctx["v1"]["access_token"]), timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["location_display"] == "123 Public St, Melbourne"
    assert d.get("location_locked") is False
    # nearby also unredacted
    nb = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG},
                      headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    match = next((e for e in nb["events"] if e["id"] == ev_id), None)
    assert match is not None
    assert match["location_display"] == "123 Public St, Melbourne"


def test_06_approval_event_locked_for_non_attendee(ctx, personal_events):
    ev_id = personal_events["priv"]["id"]
    r = requests.get(f"{API}/events/{ev_id}", headers=_hdr(ctx["v1"]["access_token"]), timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["location_locked"] is True
    assert "Secret" not in d["location_display"]
    assert d["location_display"].startswith("General area only")
    # distance coarsened to 100m step, bearing to 45deg step
    assert d["distance"] % 100 == 0 and d["distance"] >= 100
    assert d["bearing"] % 45 == 0
    # NEVER exposes lat/lng
    assert "lat" not in d and "lng" not in d
    # nearby scan should also be locked and not leak "Secret Lane"
    nb = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG},
                      headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    for e in nb["events"]:
        if e["id"] == ev_id:
            assert e["location_locked"] is True
            assert "Secret" not in e["location_display"]


def test_07_pending_request_still_locked(ctx, personal_events):
    ev_id = personal_events["priv"]["id"]
    # request to join → pending (approval type)
    r = requests.post(f"{API}/events/{ev_id}/join",
                      headers=_hdr(ctx["v1"]["access_token"]), timeout=30)
    assert r.status_code == 200
    assert r.json()["join_status"] == "pending"
    d = requests.get(f"{API}/events/{ev_id}",
                     headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    assert d["location_locked"] is True
    assert "Secret" not in d["location_display"]
    assert d["my_status"] == "pending"


def test_08_host_sees_pending_and_declined_sections(ctx, personal_events):
    ev_id = personal_events["priv"]["id"]
    # v2 also requests
    requests.post(f"{API}/events/{ev_id}/join",
                  headers=_hdr(ctx["v2"]["access_token"]), timeout=30)
    atts = requests.get(f"{API}/events/{ev_id}/attendees",
                        headers=_hdr(ctx["host"]["access_token"]), timeout=30).json()
    assert atts["is_host"] is True
    statuses = {a["id"]: a["join_status"] for a in atts["attendees"]}
    assert statuses.get(ctx["v1"]["user"]["id"]) == "pending"
    assert statuses.get(ctx["v2"]["user"]["id"]) == "pending"

    # host declines v2 → declined should still appear in host attendee payload
    dec = requests.post(f"{API}/events/{ev_id}/requests/{ctx['v2']['user']['id']}/decline",
                        headers=_hdr(ctx["host"]["access_token"]), timeout=30)
    assert dec.status_code == 200 and dec.json()["join_status"] == "declined"

    # host accepts v1
    acc = requests.post(f"{API}/events/{ev_id}/requests/{ctx['v1']['user']['id']}/accept",
                        headers=_hdr(ctx["host"]["access_token"]), timeout=30)
    assert acc.status_code == 200 and acc.json()["join_status"] == "accepted"

    atts2 = requests.get(f"{API}/events/{ev_id}/attendees",
                         headers=_hdr(ctx["host"]["access_token"]), timeout=30).json()
    s = {a["id"]: a["join_status"] for a in atts2["attendees"]}
    assert s.get(ctx["v1"]["user"]["id"]) == "accepted"
    assert s.get(ctx["v2"]["user"]["id"]) == "declined"

    # non-host viewer sees only accepted
    atts3 = requests.get(f"{API}/events/{ev_id}/attendees",
                         headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    for a in atts3["attendees"]:
        assert a["join_status"] == "accepted"
    assert atts3["is_host"] is False


def test_09_accepted_sees_exact_address_declined_stays_locked(ctx, personal_events):
    ev_id = personal_events["priv"]["id"]
    # accepted viewer v1 unlocked
    d1 = requests.get(f"{API}/events/{ev_id}",
                      headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    assert d1["location_locked"] is False
    assert d1["location_display"] == "555 Secret Lane, Melbourne"

    # declined viewer v2 remains locked, no "Secret" leak
    d2 = requests.get(f"{API}/events/{ev_id}",
                      headers=_hdr(ctx["v2"]["access_token"]), timeout=30).json()
    assert d2["location_locked"] is True
    assert "Secret" not in d2["location_display"]

    # notifications carry no address text
    accept_n = DB.notifications.find_one({"user_id": ctx["v1"]["user"]["id"],
                                          "type": "event_accepted", "event_id": ev_id})
    assert accept_n is not None
    assert "Secret" not in (accept_n.get("body") or "") and "Secret Lane" not in (accept_n.get("body") or "")
    assert "approved" in (accept_n.get("title") or "").lower() or "🎉" in (accept_n.get("title") or "")

    decline_n = DB.notifications.find_one({"user_id": ctx["v2"]["user"]["id"],
                                           "type": "event_declined", "event_id": ev_id})
    assert decline_n is not None
    assert "Secret" not in (decline_n.get("body") or "")
    assert "location remains private" in (decline_n.get("body") or "").lower()


def test_10_revoke_relocks_immediately(ctx, personal_events):
    """Host removes v1 → v1 must lose exact address instantly."""
    ev_id = personal_events["priv"]["id"]
    rm = requests.post(f"{API}/events/{ev_id}/requests/{ctx['v1']['user']['id']}/remove",
                       headers=_hdr(ctx["host"]["access_token"]), timeout=30)
    assert rm.status_code == 200
    d = requests.get(f"{API}/events/{ev_id}",
                     headers=_hdr(ctx["v1"]["access_token"]), timeout=30).json()
    assert d["location_locked"] is True
    assert "Secret" not in d["location_display"]


def test_11_host_always_sees_own_address(ctx, personal_events):
    ev_id = personal_events["priv"]["id"]
    d = requests.get(f"{API}/events/{ev_id}",
                     headers=_hdr(ctx["host"]["access_token"]), timeout=30).json()
    assert d["is_host"] is True
    assert d["location_locked"] is False
    assert d["location_display"] == "555 Secret Lane, Melbourne"

"""Iter60 — People Mode Events + Radar hotspots regression."""
import uuid
from datetime import datetime, timedelta, timezone

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"
db = pymongo.MongoClient(benv["MONGO_URL"])[benv["DB_NAME"]]

LAT, LNG = -37.8136, 144.9631


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _iso(**kw):
    return (datetime.now(timezone.utc) + timedelta(**kw)).isoformat()


def _register(tag):
    email = f"iter60-{tag}-{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!60x", "name": f"Iter60 {tag}",
        "date_of_birth": "1994-04-04", "accept_policies": True}, timeout=15)
    tok = r.json().get("access_token") or r.json().get("token")
    uid = r.json()["user"]["id"]
    db.users.update_one({"id": uid}, {"$set": {"email_verified": True, "lat": LAT, "lng": LNG}})
    return tok, uid


def _mk(tok, **over):
    body = {"title": "Friday Knock-Off Drinks", "description": "Good vibes, cold drinks and new faces.",
            "category": "Social", "lat": LAT + 0.001, "lng": LNG + 0.001,
            "location_display": "Fed Square area", "visibility_radius": 500,
            "start_datetime": _iso(hours=2), "end_datetime": _iso(hours=5),
            "capacity": None, "join_type": "everyone"}
    body.update(over)
    r = requests.post(f"{API}/events", headers=_h(tok), json=body, timeout=15)
    assert r.status_code == 200, r.text[:200]
    return r.json()


@pytest.fixture(scope="module")
def actors():
    host = _register("host")
    guest = _register("guest")
    yield host, guest
    ids = [u["id"] for u in db.users.find({"email": {"$regex": "^iter60-"}})]
    evs = [e["id"] for e in db.events.find({"creator_user_id": {"$in": ids}})]
    db.event_attendees.delete_many({"event_id": {"$in": evs}})
    db.events.delete_many({"id": {"$in": evs}})
    db.reports.delete_many({"reporter_id": {"$in": ids}})
    db.users.delete_many({"id": {"$in": ids}})


def test_create_and_privacy_no_coords_leak(actors):
    (ht, _), (gt, _) = actors
    ev = _mk(ht)
    assert "lat" not in ev and "lng" not in ev, "event payload must NEVER leak coordinates"
    d = requests.get(f"{API}/events/{ev['id']}", headers=_h(gt), timeout=15).json()
    assert "lat" not in d and "lng" not in d
    assert d["distance"] % 10 == 0  # quantized approximate distance
    # invalid category / bad times rejected
    r = requests.post(f"{API}/events", headers=_h(ht), json={
        "title": "x", "category": "Nope", "lat": LAT, "lng": LNG,
        "start_datetime": _iso(hours=1), "end_datetime": _iso(hours=2)}, timeout=15)
    assert r.status_code == 400


def test_nearby_geo_bounded(actors):
    (ht, _), (gt, _) = actors
    near = _mk(ht, title="Near Event")
    far = _mk(ht, title="Far Event", lat=LAT + 0.05, lng=LNG + 0.05)  # ~7km away
    res = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(gt), timeout=15).json()
    ids = [e["id"] for e in res["events"]]
    assert near["id"] in ids and far["id"] not in ids
    # category filter
    res2 = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG, "category": "Fitness"}, headers=_h(gt), timeout=15).json()
    assert near["id"] not in [e["id"] for e in res2["events"]]


def test_join_leave_capacity_and_double_tap(actors):
    (ht, hid), (gt, gid) = actors
    ev = _mk(ht, title="Tiny Event", capacity=1)
    r1 = requests.post(f"{API}/events/{ev['id']}/join", headers=_h(gt), timeout=15)
    assert r1.status_code == 200 and r1.json()["join_status"] == "accepted"
    # double tap is idempotent
    r2 = requests.post(f"{API}/events/{ev['id']}/join", headers=_h(gt), timeout=15)
    assert r2.status_code == 200 and r2.json()["join_status"] == "accepted"
    assert db.event_attendees.count_documents({"event_id": ev["id"], "user_id": gid}) == 1
    # full event rejects a third
    xt, _ = _register("extra")
    r3 = requests.post(f"{API}/events/{ev['id']}/join", headers=_h(xt), timeout=15)
    assert r3.status_code == 409
    # host can't join own event
    assert requests.post(f"{API}/events/{ev['id']}/join", headers=_h(ht), timeout=15).status_code == 400
    # leave reopens the spot
    requests.post(f"{API}/events/{ev['id']}/leave", headers=_h(gt), timeout=15)
    assert requests.post(f"{API}/events/{ev['id']}/join", headers=_h(xt), timeout=15).status_code == 200


def test_approval_flow(actors):
    (ht, hid), (gt, gid) = actors
    ev = _mk(ht, title="Approval Event", join_type="approval")
    r = requests.post(f"{API}/events/{ev['id']}/join", headers=_h(gt), timeout=15)
    assert r.json()["join_status"] == "pending"
    # host sees pending attendee, guest not counted as going yet
    atts = requests.get(f"{API}/events/{ev['id']}/attendees", headers=_h(ht), timeout=15).json()
    assert atts["is_host"] and any(a["id"] == gid and a["join_status"] == "pending" for a in atts["attendees"])
    d = requests.get(f"{API}/events/{ev['id']}", headers=_h(gt), timeout=15).json()
    assert d["going"] == 0 and d["my_status"] == "pending"
    requests.post(f"{API}/events/{ev['id']}/requests/{gid}/accept", headers=_h(ht), timeout=15)
    d2 = requests.get(f"{API}/events/{ev['id']}", headers=_h(gt), timeout=15).json()
    assert d2["going"] == 1 and d2["my_status"] == "accepted"
    # host removes attendee
    requests.post(f"{API}/events/{ev['id']}/requests/{gid}/remove", headers=_h(ht), timeout=15)
    assert requests.get(f"{API}/events/{ev['id']}", headers=_h(gt), timeout=15).json()["going"] == 0
    # non-host cannot manage
    assert requests.post(f"{API}/events/{ev['id']}/requests/{gid}/accept", headers=_h(gt), timeout=15).status_code == 403


def test_edit_cancel_and_notify(actors):
    (ht, _), (gt, gid) = actors
    ev = _mk(ht, title="To Cancel")
    requests.post(f"{API}/events/{ev['id']}/join", headers=_h(gt), timeout=15)
    # edit — host only
    assert requests.put(f"{API}/events/{ev['id']}", headers=_h(gt), json={**{k: ev[k] for k in ["title", "description", "category", "location_display", "visibility_radius", "start_datetime", "end_datetime", "capacity", "join_type"]}, "lat": LAT, "lng": LNG}, timeout=15).status_code == 403
    r = requests.put(f"{API}/events/{ev['id']}", headers=_h(ht), json={"title": "Renamed", "description": "", "category": "Social", "lat": LAT, "lng": LNG, "location_display": "", "visibility_radius": 500, "start_datetime": ev["start_datetime"], "end_datetime": ev["end_datetime"], "capacity": None, "join_type": "everyone"}, timeout=15)
    assert r.status_code == 200 and r.json()["title"] == "Renamed"
    # cancel notifies attendees, never deletes
    requests.post(f"{API}/events/{ev['id']}/cancel", headers=_h(ht), timeout=15)
    assert db.events.find_one({"id": ev["id"]})["status"] == "cancelled"
    assert db.notifications.count_documents({"user_id": gid, "type": "event_cancelled"}) >= 1
    # cancelled event can't be joined
    assert requests.post(f"{API}/events/{ev['id']}/join", headers=_h(gt), timeout=15).status_code == 400


def test_expiry_completed_and_my_events(actors):
    (ht, _), (gt, _) = actors
    past = _mk(ht, title="Past Event", start_datetime=_iso(hours=-4), end_datetime=_iso(hours=-1))
    res = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(gt), timeout=15).json()
    assert past["id"] not in [e["id"] for e in res["events"]], "ended events must leave the radar"
    assert db.events.find_one({"id": past["id"]})["status"] == "completed"  # kept, not deleted
    mine = requests.get(f"{API}/events/mine", headers=_h(ht), timeout=15).json()
    assert any(e["id"] == past["id"] for e in mine["past"])


def test_report_event_reuses_moderation(actors):
    (ht, hid), (gt, _) = actors
    ev = _mk(ht, title="Report Me")
    r = requests.post(f"{API}/events/{ev['id']}/report", headers=_h(gt), json={"reason": "Spam"}, timeout=15)
    assert r.status_code == 200
    rep = db.reports.find_one({"event_id": ev["id"]})
    assert rep and rep["kind"] == "event" and rep["reported_id"] == hid

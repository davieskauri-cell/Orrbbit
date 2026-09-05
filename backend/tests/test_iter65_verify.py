"""Iter65 verification: event photo E2E, notification meta for ALL event types, vibe persistence.
Run: EXPO_PUBLIC_BACKEND_URL=... python -m pytest tests/test_iter65_verify.py -v
Cleans up everything it creates.
"""
import os
import requests

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/") + "/api"
PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
PHOTO2 = PHOTO[:-8] + "AAKp//2Q=="

created_event_ids = []


def login(email):
    r = requests.post(f"{BASE}/auth/demo-login", json={"email": email}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def me(h):
    return requests.get(f"{BASE}/auth/me", headers=h, timeout=15).json()


def mk_event(h, lat, lng, join_type="everyone", cover=PHOTO, cap=None):
    from datetime import datetime, timedelta, timezone
    st = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    en = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    body = {"title": "QA-ITER65 Test Event", "description": "qa", "category": "Coffee / Drinks",
            "lat": lat, "lng": lng, "location_display": "QA spot", "visibility_radius": 500,
            "start_datetime": st, "end_datetime": en, "join_type": join_type,
            "cover_image": cover, "capacity": cap}
    r = requests.post(f"{BASE}/events", json=body, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    ev = r.json()
    created_event_ids.append(ev["id"])
    return ev, body


def notifs(h):
    return requests.get(f"{BASE}/notifications", headers=h, timeout=15).json().get("items", [])


def find_notif(h, ntype, event_id):
    return next((n for n in notifs(h) if n.get("type") == ntype and n.get("event_id") == event_id), None)


HOST = login("kauri@intro.demo")
G1 = login("james@intro.demo")
G2 = login("sarah@intro.demo")
HME = me(HOST)
LAT, LNG = HME.get("lat") or -37.8136, HME.get("lng") or 144.9631


def test_01_photo_create_and_persist():
    ev, _ = mk_event(HOST, LAT, LNG)
    assert ev["cover_image"] == PHOTO
    # detail (fresh fetch = persisted in DB)
    d = requests.get(f"{BASE}/events/{ev['id']}", headers=G1, timeout=15).json()
    assert d["cover_image"] == PHOTO
    # nearby includes it
    nb = requests.get(f"{BASE}/events/nearby", params={"lat": LAT, "lng": LNG}, headers=G1, timeout=15).json()
    mine = next((e for e in nb["events"] if e["id"] == ev["id"]), None)
    assert mine and mine["cover_image"] == PHOTO


def test_02_photo_edit_change_and_remove():
    ev, body = mk_event(HOST, LAT, LNG)
    # change photo
    r = requests.put(f"{BASE}/events/{ev['id']}", json={**body, "cover_image": PHOTO2}, headers=HOST, timeout=15)
    assert r.status_code == 200, r.text
    d = requests.get(f"{BASE}/events/{ev['id']}", headers=HOST, timeout=15).json()
    assert d["cover_image"] == PHOTO2, "changed photo must persist"
    # remove photo
    r = requests.put(f"{BASE}/events/{ev['id']}", json={**body, "cover_image": None}, headers=HOST, timeout=15)
    assert r.status_code == 200
    d = requests.get(f"{BASE}/events/{ev['id']}", headers=HOST, timeout=15).json()
    assert d["cover_image"] is None, "removed photo must persist"


def test_03_notification_meta_all_types():
    # approval event: request -> host notif; accept -> guest notif; decline -> guest notif
    ev, body = mk_event(HOST, LAT, LNG, join_type="approval")
    eid = ev["id"]
    requests.post(f"{BASE}/events/{eid}/join", headers=G1, timeout=15)
    requests.post(f"{BASE}/events/{eid}/join", headers=G2, timeout=15)
    n = find_notif(HOST, "event_join_request", eid)
    assert n, "host must get event_join_request with event_id"
    g1id, g2id = me(G1)["id"], me(G2)["id"]
    requests.post(f"{BASE}/events/{eid}/requests/{g1id}/accept", headers=HOST, timeout=15)
    requests.post(f"{BASE}/events/{eid}/requests/{g2id}/decline", headers=HOST, timeout=15)
    assert find_notif(G1, "event_accepted", eid), "guest must get event_accepted with event_id"
    assert find_notif(G2, "event_declined", eid), "declined guest must get event_declined with event_id"
    # edit -> accepted attendee notified with event_id
    requests.put(f"{BASE}/events/{eid}", json={**body, "title": "QA-ITER65 Test Event v2"}, headers=HOST, timeout=15)
    assert find_notif(G1, "event_updated", eid), "attendee must get event_updated with event_id"
    # leave -> host notified
    requests.post(f"{BASE}/events/{eid}/leave", headers=G1, timeout=15)
    assert find_notif(HOST, "event_left", eid), "host must get event_left with event_id"
    # cancel -> remaining attendees notified (G1 left, so re-join via everyone event below covers joined)
    ev2, _ = mk_event(HOST, LAT, LNG, join_type="everyone")
    requests.post(f"{BASE}/events/{ev2['id']}/join", headers=G1, timeout=15)
    assert find_notif(HOST, "event_joined", ev2["id"]), "host must get event_joined with event_id"
    requests.post(f"{BASE}/events/{ev2['id']}/cancel", headers=HOST, timeout=15)
    assert find_notif(G1, "event_cancelled", ev2["id"]), "attendee must get event_cancelled with event_id"


def test_04_deleted_event_fallback():
    # a notification pointing at a gone event -> detail returns 404 (frontend shows error+Back, no crash)
    r = requests.get(f"{BASE}/events/nonexistent-id-qa", headers=G1, timeout=15)
    assert r.status_code == 404


def test_05_vibe_change_persists():
    orig = me(G1).get("vibe")
    for v in ["relationship", "coffee_drinks", "new_friends", "gym_buddy", "open_to_chat", "networking"]:
        r = requests.put(f"{BASE}/users/me/state", json={"vibe": v}, headers=G1, timeout=15)
        assert r.status_code == 200, r.text
        assert me(G1)["vibe"] == v, f"vibe {v} must persist on fresh /auth/me"
    requests.put(f"{BASE}/users/me/state", json={"vibe": orig or "networking"}, headers=G1, timeout=15)
    assert me(G1)["vibe"] == (orig or "networking")


def test_99_cleanup():
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import dotenv_values
    cfg = dotenv_values("/app/backend/.env")

    async def clean():
        cli = AsyncIOMotorClient(cfg["MONGO_URL"])
        db = cli[cfg.get("DB_NAME", "test_database")]
        evs = await db.events.find({"title": {"$regex": "^QA-ITER65"}}, {"id": 1}).to_list(100)
        ids = [e["id"] for e in evs]
        await db.events.delete_many({"id": {"$in": ids}})
        await db.event_attendees.delete_many({"event_id": {"$in": ids}})
        await db.notifications.delete_many({"event_id": {"$in": ids}})
        # any residue from earlier QA seeds
        stale = await db.events.find({"title": {"$regex": "QA|TEST|Iter6", "$options": "i"}}, {"id": 1, "title": 1}).to_list(50)
        print("Remaining QA-like events:", [s["title"] for s in stale])
        cli.close()

    asyncio.run(clean())

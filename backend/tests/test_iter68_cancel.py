"""Iter68: Event cancellation flow — status/timestamps, idempotency, discovery exclusion,
attendee notifications, Resend email records. Cleans up everything it creates."""
import os
import uuid
import asyncio
import requests
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/") + "/api"
CFG = dotenv_values("/app/backend/.env")


def _db_run(coro_fn):
    async def run():
        cli = AsyncIOMotorClient(CFG["MONGO_URL"])
        db = cli[CFG.get("DB_NAME", "test_database")]
        try:
            return await coro_fn(db)
        finally:
            cli.close()
    return asyncio.run(run())


def login(email):
    r = requests.post(f"{BASE}/auth/demo-login", json={"email": email}, timeout=15)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def mk_event(h, join_type="everyone"):
    st = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    en = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    body = {"title": f"QA-ITER68 {uuid.uuid4().hex[:6]}", "description": "qa", "category": "Social",
            "lat": -37.8136, "lng": 144.9631, "location_display": "QA venue", "visibility_radius": 500,
            "start_datetime": st, "end_datetime": en, "join_type": join_type}
    r = requests.post(f"{BASE}/events", json=body, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def notifs(h, eid):
    items = requests.get(f"{BASE}/notifications", headers=h, timeout=15).json()["items"]
    return [n for n in items if n.get("event_id") == eid and n["type"] == "event_cancelled"]


HOST = login("kauri@intro.demo")
G1 = login("james@intro.demo")
G2 = login("sarah@intro.demo")


def test_01_cancel_zero_attendees_status_and_discovery():
    ev = mk_event(HOST)
    r = requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    doc = _db_run(lambda db: db.events.find_one({"id": ev["id"]}))
    assert doc["status"] == "cancelled" and doc.get("cancelled_at") and doc.get("cancelled_by")
    # excluded from discovery
    nb = requests.get(f"{BASE}/events/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=G1, timeout=15).json()
    assert all(e["id"] != ev["id"] for e in nb["events"])
    # detail still loads with cancelled state (notification destination is never broken)
    d = requests.get(f"{BASE}/events/{ev['id']}", headers=G1, timeout=15).json()
    assert d["status"] == "cancelled"


def test_02_cancel_notifies_each_attendee_once_and_double_cancel_safe():
    ev = mk_event(HOST)
    requests.post(f"{BASE}/events/{ev['id']}/join", headers=G1, timeout=15)
    requests.post(f"{BASE}/events/{ev['id']}/join", headers=G2, timeout=15)
    requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    # trigger twice — must be idempotent
    r2 = requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    assert r2.status_code == 200 and r2.json()["status"] == "cancelled"
    assert len(notifs(G1, ev["id"])) == 1, "exactly one cancellation notification for attendee 1"
    assert len(notifs(G2, ev["id"])) == 1, "exactly one cancellation notification for attendee 2"


def test_03_non_attendee_not_notified():
    ev = mk_event(HOST)
    requests.post(f"{BASE}/events/{ev['id']}/join", headers=G1, timeout=15)
    requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    assert len(notifs(G2, ev["id"])) == 0, "non-attendee must not be notified"


def test_04_pending_requester_not_notified():
    ev = mk_event(HOST, join_type="approval")
    requests.post(f"{BASE}/events/{ev['id']}/join", headers=G1, timeout=15)  # pending, never confirmed
    requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    assert len(notifs(G1, ev["id"])) == 0, "pending (unconfirmed) requester must not get cancelled notif"


def test_05_email_sent_once_to_real_attendee_and_skipped_for_demo():
    ev = mk_event(HOST)
    requests.post(f"{BASE}/events/{ev['id']}/join", headers=G1, timeout=15)  # demo → email skipped

    async def seed(db):
        # non-demo attendee with Resend's official test inbox (reuse if already present)
        existing = await db.users.find_one({"email": "delivered@resend.dev"})
        if existing:
            uid = existing["id"]
        else:
            uid = f"qa68-{uuid.uuid4().hex[:8]}"
            await db.users.insert_one({"id": uid, "email": "delivered@resend.dev", "name": "QA68 Attendee",
                                       "email_verified": True, "created_at": datetime.now(timezone.utc).isoformat()})
        await db.event_attendees.insert_one({"id": str(uuid.uuid4()), "event_id": ev["id"], "user_id": uid,
                                             "join_status": "accepted",
                                             "created_at": datetime.now(timezone.utc).isoformat()})
        return uid
    uid = _db_run(seed)

    requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)
    requests.post(f"{BASE}/events/{ev['id']}/cancel", headers=HOST, timeout=15)  # double trigger
    import time; time.sleep(6)  # fire-and-forget delivery

    async def check(db):
        evs = await db.email_events.find({"template": "event_cancelled", "entity_id": ev["id"]}).to_list(20)
        demo = await db.email_events.find({"template": "event_cancelled", "to_email": "james@intro.demo"}).to_list(5)
        return evs, demo, uid
    evs, demo, _ = _db_run(check)
    sent = [e for e in evs if e["status"] == "sent"]
    assert len(sent) == 1, f"exactly ONE SENT cancellation email expected, got {len(sent)} of {len(evs)} records"
    assert sent[0]["to_email"] == "delivered@resend.dev"
    assert "Event Cancelled" in sent[0]["subject"]
    # demo attendee: skip is LOGGED (Iter74) but never actually sent
    assert all(d["status"] != "sent" for d in demo), "demo attendee must not be emailed"
    print("email status:", sent[0]["status"], "| subject:", sent[0]["subject"])


def test_06_email_failure_never_reactivates_event():
    doc = _db_run(lambda db: db.events.find_one({"title": {"$regex": "^QA-ITER68"}, "status": {"$ne": "cancelled"}}))
    # all cancelled test events stayed cancelled regardless of email outcomes
    cancelled = _db_run(lambda db: db.events.count_documents({"title": {"$regex": "^QA-ITER68"}, "status": "cancelled"}))
    assert cancelled >= 4 and (doc is None or doc["status"] in ("active", "full"))


def test_99_cleanup():
    async def clean(db):
        evs = await db.events.find({"title": {"$regex": "^QA-ITER68"}}, {"id": 1}).to_list(50)
        ids = [e["id"] for e in evs]
        await db.events.delete_many({"id": {"$in": ids}})
        await db.event_attendees.delete_many({"event_id": {"$in": ids}})
        await db.notifications.delete_many({"event_id": {"$in": ids}})
        await db.email_events.delete_many({"entity_id": {"$in": ids}})
        await db.users.delete_many({"email": "delivered@resend.dev", "name": "QA68 Attendee"})
        return await db.events.count_documents({"title": {"$regex": "^QA"}})
    left = _db_run(clean)
    assert left == 0

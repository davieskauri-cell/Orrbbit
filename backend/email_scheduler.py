"""Orrbbit scheduled email processor — runs as a background asyncio task.

Every cycle it processes (all idempotent, duplicate-safe via EmailService keys):
- Unread pro-message fallback (>=30 min unread, conversation not opened, batched
  into one email per conversation, max one per session per recipient per day).
- Unread connection-request reminder (pending > 24h, sent once per request).
- Session reminders 24h / 1h before pro_sessions.scheduled_at (future-proof:
  fires automatically when bookings gain a scheduled time; once per period).
- Credential expiring (<=30 days) / expired emails for approved verifications.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

CYCLE_SECONDS = 300
UNREAD_MIN_AGE_MIN = 30


def _now():
    return datetime.now(timezone.utc)


def _iso(dt=None):
    return (dt or _now()).isoformat()


async def _user(db, uid):
    return await db.users.find_one({"id": uid})


async def process_unread_messages(db, svc):
    """Batch unread pro messages older than 30 min into one fallback email."""
    cutoff = _iso(_now() - timedelta(minutes=UNREAD_MIN_AGE_MIN))
    day_bucket = _now().strftime("%Y%m%d")
    pipeline = [
        {"$match": {"read": False, "created_at": {"$lte": cutoff}}},
        {"$group": {"_id": {"session_id": "$session_id", "from": "$from_user_id"},
                    "count": {"$sum": 1}}},
        {"$limit": 100},
    ]
    async for grp in db.pro_messages.aggregate(pipeline):
        session_id = grp["_id"]["session_id"]
        sender_id = grp["_id"]["from"]
        s = await db.pro_sessions.find_one({"id": session_id})
        if not s or s.get("status") not in ("active", "follow_up"):
            continue
        recipient_id = s["professional_id"] if sender_id == s["requester_id"] else s["requester_id"]
        recipient = await _user(db, recipient_id)
        sender = await _user(db, sender_id)
        if not recipient or not sender:
            continue
        n = grp["count"]
        await svc.send("unread_messages", user=recipient, entity_id=session_id,
                       idempotency_key=f"unread_messages:{recipient_id}:{session_id}:{day_bucket}",
                       ctx={"other_name": sender.get("name"), "count": n,
                            "plural": "s" if n != 1 else "", "session_id": session_id})


async def process_unread_requests(db, svc):
    """Remind professionals of pending connection requests older than 24h (once)."""
    cutoff = _iso(_now() - timedelta(hours=24))
    week_ago = _iso(_now() - timedelta(days=7))
    reqs = await db.pro_requests.find(
        {"status": "pending", "created_at": {"$lte": cutoff, "$gte": week_ago}}).to_list(100)
    for r in reqs:
        pro = await _user(db, r["to_user_id"])
        if not pro:
            continue
        await svc.send("unread_request_reminder", user=pro, entity_id=r["id"],
                       idempotency_key=f"unread_request_reminder:{r['id']}",
                       ctx={"count_label": "1 connection request"})


async def process_session_reminders(db, svc):
    """24h / 1h reminders for sessions with a scheduled_at time (once per period)."""
    now = _now()
    horizon = _iso(now + timedelta(hours=25))
    sessions = await db.pro_sessions.find(
        {"scheduled_at": {"$gte": _iso(now), "$lte": horizon},
         "status": {"$nin": ["completed", "cancelled"]}}).to_list(200)
    for s in sessions:
        try:
            sched = datetime.fromisoformat(s["scheduled_at"])
            if sched.tzinfo is None:
                sched = sched.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
        delta = sched - now
        period = None
        if timedelta(0) < delta <= timedelta(hours=1, minutes=10):
            period = "1h"
        elif timedelta(hours=23) < delta <= timedelta(hours=25):
            period = "24h"
        if not period:
            continue
        when = sched.strftime("%a %d %b, %I:%M %p UTC")
        for uid, other_id in ((s["requester_id"], s["professional_id"]),
                              (s["professional_id"], s["requester_id"])):
            u, other = await _user(db, uid), await _user(db, other_id)
            if not u or not other:
                continue
            await svc.send(f"session_reminder_{period}", user=u, entity_id=s["id"],
                           idempotency_key=f"session_reminder_{period}:{uid}:{s['id']}",
                           ctx={"other_name": other.get("name"), "when": when, "session_id": s["id"]})


async def process_credential_expiry(db, svc):
    """Email professionals whose approved credentials expire within 30 days or expired."""
    today = _now().date()
    soon = (today + timedelta(days=30)).isoformat()
    subs = await db.verification_submissions.find(
        {"status": "Approved", "documents.expiry_date": {"$lte": soon}}).to_list(200)
    for sub in subs:
        dates = [d.get("expiry_date") for d in sub.get("documents", []) if d.get("expiry_date")]
        if not dates:
            continue
        exp = min(dates)
        u = await _user(db, sub["user_id"])
        if not u:
            continue
        if exp >= today.isoformat():
            await svc.send("credential_expiring", user=u, entity_id=sub["id"],
                           idempotency_key=f"credential_expiring:{sub['id']}:{exp}",
                           ctx={"expiry": exp})
    expired = await db.verification_submissions.find({"status": "Expired"}).to_list(200)
    for sub in expired:
        u = await _user(db, sub["user_id"])
        if not u:
            continue
        await svc.send("credential_expired", user=u, entity_id=sub["id"],
                       idempotency_key=f"credential_expired:{sub['id']}")


async def _acquire_lease(db) -> bool:
    """Cross-instance lease so only one backend runs a cycle at a time.
    (Duplicate emails are additionally prevented by EmailService idempotency keys.)"""
    now = _now()
    res = await db.config.update_one(
        {"key": "email_scheduler_lease",
         "$or": [{"lease_until": {"$lt": _iso(now)}}, {"lease_until": None}]},
        {"$set": {"lease_until": _iso(now + timedelta(seconds=CYCLE_SECONDS - 30))}},
    )
    if res.modified_count:
        return True
    if not await db.config.find_one({"key": "email_scheduler_lease"}):
        await db.config.update_one(
            {"key": "email_scheduler_lease"},
            {"$setOnInsert": {"lease_until": _iso(now + timedelta(seconds=CYCLE_SECONDS - 30))}},
            upsert=True)
        return True
    return False


async def run_cycle(db, svc):
    if not await _acquire_lease(db):
        return  # another instance holds the lease
    for job in (process_unread_messages, process_unread_requests,
                process_session_reminders, process_credential_expiry):
        try:
            await job(db, svc)
        except Exception as e:  # noqa: BLE001
            logger.error("Email scheduler job %s failed: %s", job.__name__, e)
    await db.config.update_one({"key": "email_scheduler"},
                               {"$set": {"last_run": _iso()}}, upsert=True)


async def scheduler_loop(db, svc):
    await asyncio.sleep(20)  # let the app finish booting/seeding
    while True:
        await run_cycle(db, svc)
        await asyncio.sleep(CYCLE_SECONDS)


def start(db, svc):
    asyncio.get_running_loop().create_task(scheduler_loop(db, svc))
    logger.info("Email scheduler started (every %ss)", CYCLE_SECONDS)

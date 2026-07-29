"""Login security email triggers — new device + suspicious login detection."""
import hashlib
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


async def login_security(db, svc, user: dict, ip: str, ua: str):
    """After a successful login: alert on suspicious activity (5+ recent failures)
    and on logins from a previously unseen device. Never blocks login."""
    if user.get("is_demo"):
        return
    uid = user["id"]
    now = datetime.now(timezone.utc)
    when = now.strftime("%a %d %b %Y, %H:%M UTC")

    # suspicious: 5+ failed attempts in the last 15 minutes before this success
    since = (now - timedelta(minutes=15)).isoformat()
    failures = await db.login_failures.count_documents(
        {"email": user["email"], "created_at": {"$gte": since}})
    if failures >= 5:
        await svc.send("suspicious_login", user=user,
                       idempotency_key=f"suspicious_login:{uid}:{now.strftime('%Y%m%d%H')}")
    await db.login_failures.delete_many({"email": user["email"]})

    # new device: hash of ip + user-agent
    device_hash = hashlib.sha256(f"{ip}|{ua}".encode()).hexdigest()
    known = await db.known_devices.find_one({"user_id": uid, "hash": device_hash})
    if known:
        await db.known_devices.update_one({"user_id": uid, "hash": device_hash},
                                          {"$set": {"last_seen": now.isoformat()}})
        return
    prior = await db.known_devices.count_documents({"user_id": uid})
    await db.known_devices.insert_one({
        "user_id": uid, "hash": device_hash, "ua": (ua or "")[:160], "ip": ip,
        "first_seen": now.isoformat(), "last_seen": now.isoformat(),
    })
    if prior >= 1:  # first-ever device is not "new"
        device = (ua or "Unknown device")[:60]
        await svc.send("new_device_login", user=user,
                       ctx={"when": when, "device": device},
                       idempotency_key=f"new_device:{uid}:{device_hash}")

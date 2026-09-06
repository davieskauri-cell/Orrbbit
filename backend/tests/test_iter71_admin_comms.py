"""Iter71: central admin→user comms service (notify_user_action).
In-app + Resend + audit delivery status, duplicate protection, reporter privacy,
internal actions excluded. Cleans up everything it creates."""
import os
import uuid
import asyncio
import requests
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/") + "/api"
CFG = dotenv_values("/app/backend/.env")
ADMIN_EMAIL, ADMIN_PW = "qa-admin@intro.control", "Qa!hpgOlIndvj0UbVWk"


def _db(coro_fn):
    async def run():
        cli = AsyncIOMotorClient(CFG["MONGO_URL"])
        db = cli[CFG.get("DB_NAME", "test_database")]
        try:
            return await coro_fn(db)
        finally:
            cli.close()
    return asyncio.run(run())


r = requests.post(f"{BASE}/control/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
_tok = r.json()["token"]
AH = {"Authorization": f"Bearer {_tok}", "X-Admin-Mode": "demo"}
AH_LIVE = {**AH, "X-Admin-Mode": "live"}
# high-risk actions (ban/delete) require a recent re-auth
requests.post(f"{BASE}/control/auth/reauth", json={"password": ADMIN_PW}, headers=AH, timeout=15)

JAMES = _db(lambda db: db.users.find_one({"email": "james@intro.demo"}, {"id": 1}))["id"]
SARAH = _db(lambda db: db.users.find_one({"email": "sarah@intro.demo"}, {"id": 1}))["id"]
START = datetime.now(timezone.utc).isoformat()


def notifs_for(uid, ntype=None):
    async def q(db):
        f = {"user_id": uid, "created_at": {"$gte": START}}
        if ntype:
            f["type"] = ntype
        return await db.notifications.find(f, {"_id": 0}).to_list(50)
    return _db(q)


def audits(action, target_id=None):
    async def q(db):
        f = {"action": action, "at": {"$gte": START}}
        if target_id:
            f["target_id"] = {"$regex": f"^{target_id}"}
        return await db.admin_audit_logs.find(f, {"_id": 0}).to_list(50)
    return _db(q)


def test_01_suspend_reinstate_notify_and_audit():
    rr = requests.post(f"{BASE}/control/users/{JAMES}/action", json={"action": "suspend", "reason": "qa71"}, headers=AH, timeout=20)
    assert rr.status_code == 200, rr.text
    d = rr.json()["delivery"]
    assert d["notification"] == "sent" and d["email"] in ("skipped", "sent"), d  # demo → email skipped, action still succeeded
    u = _db(lambda db: db.users.find_one({"id": JAMES}, {"admin_status": 1}))
    assert u["admin_status"] == "hidden_pending_review", "action must stand regardless of email outcome"
    assert len(notifs_for(JAMES, "admin_user_suspend")) == 1
    a = audits("user_suspend")
    assert a and a[-1]["new_value"]["notification_status"] == "sent" and "email_status" in a[-1]["new_value"]
    # reinstate
    rr = requests.post(f"{BASE}/control/users/{JAMES}/action", json={"action": "unsuspend"}, headers=AH, timeout=20)
    assert rr.json()["delivery"]["notification"] == "sent"
    assert _db(lambda db: db.users.find_one({"id": JAMES}, {"admin_status": 1}))["admin_status"] is None
    n = notifs_for(JAMES, "admin_user_unsuspend")
    assert n and "restored" in n[0]["body"]


def test_02_ban_and_unban():
    rr = requests.post(f"{BASE}/control/users/{JAMES}/action", json={"action": "ban", "reason": "qa71"}, headers=AH, timeout=20)
    assert rr.status_code == 200 and rr.json()["delivery"]["notification"] == "sent"
    assert _db(lambda db: db.users.find_one({"id": JAMES}, {"admin_status": 1}))["admin_status"] == "banned"
    n = notifs_for(JAMES, "admin_user_ban")
    assert n and "appeal" in n[0]["body"].lower()
    requests.post(f"{BASE}/control/users/{JAMES}/action", json={"action": "unban"}, headers=AH, timeout=20)
    assert _db(lambda db: db.users.find_one({"id": JAMES}, {"admin_status": 1}))["admin_status"] is None


def test_03_duplicate_protection():
    # two rapid suspends → exactly ONE notification (1-minute dedupe window)
    requests.post(f"{BASE}/control/users/{SARAH}/action", json={"action": "suspend"}, headers=AH, timeout=20)
    r2 = requests.post(f"{BASE}/control/users/{SARAH}/action", json={"action": "suspend"}, headers=AH, timeout=20)
    assert r2.json()["delivery"]["notification"] == "duplicate_skipped"
    assert len(notifs_for(SARAH, "admin_user_suspend")) == 1
    requests.post(f"{BASE}/control/users/{SARAH}/action", json={"action": "unsuspend"}, headers=AH, timeout=20)


def test_04_report_warn_and_reporter_privacy():
    rid = str(uuid.uuid4())
    _db(lambda db: db.reports.insert_one({"id": rid, "reporter_id": SARAH, "user_id": JAMES,
                                          "reason": "qa71", "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()}))
    rr = requests.post(f"{BASE}/control/reports/{rid}/action", json={"action": "warn", "reason": "Please keep chats respectful."}, headers=AH, timeout=20)
    assert rr.status_code == 200, rr.text
    tn = notifs_for(JAMES, "admin_warning")
    assert tn and "respectful" in tn[-1]["body"]
    # reporter gets privacy-safe outcome only — never the target's account details
    rn = notifs_for(SARAH, "report_outcome")
    assert rn, "reporter must get an outcome notification"
    assert "appropriate action" in rn[-1]["body"] and "James" not in rn[-1]["body"] and "suspend" not in rn[-1]["body"].lower()
    a = audits("report_outcome_notice")
    assert a and a[-1]["new_value"]["notification_status"] == "sent"


def test_05_verification_approve_and_more_info():
    sid = f"qa71-sub-{uuid.uuid4().hex[:6]}"
    _db(lambda db: db.verification_submissions.insert_one({
        "id": sid, "user_id": JAMES, "profession": "QA Plumber", "categories": ["Plumbing"],
        "status": "Pending Review", "documents": [], "submitted_at": datetime.now(timezone.utc).isoformat()}))
    rr = requests.post(f"{BASE}/control/verifications/{sid}/decision", json={"action": "approve", "note": ""}, headers=AH, timeout=20)
    assert rr.status_code == 200 and rr.json()["delivery"]["notification"] == "sent", rr.text
    assert notifs_for(JAMES, "verification_approve")
    rr = requests.post(f"{BASE}/control/verifications/{sid}/decision", json={"action": "more_info", "note": "Please add licence expiry."}, headers=AH, timeout=20)
    assert rr.status_code == 200 and rr.json()["delivery"]["notification"] == "sent"
    n = notifs_for(JAMES, "verification_more_info")
    assert n and "licence expiry" in n[-1]["body"]
    a = audits("verification_approve")
    assert a and "email_status" in a[-1]["new_value"]


def test_06_content_removed():
    hid = str(uuid.uuid4())
    _db(lambda db: db.help_requests.insert_one({"id": hid, "user_id": JAMES, "public_summary": "qa71 help",
                                                "status": "open", "created_at": datetime.now(timezone.utc).isoformat()}))
    rr = requests.post(f"{BASE}/control/help-requests/{hid}/action", json={"action": "delete", "reason": "qa71"}, headers=AH, timeout=20)
    assert rr.status_code == 200 and rr.json()["delivery"]["notification"] == "sent", rr.text
    n = notifs_for(JAMES, "admin_help_request_delete")
    assert n and "removed" in n[-1]["body"]


def test_07_email_attempted_and_failure_never_blocks_action():
    u = _db(lambda db: db.users.find_one({"email": "delivered@resend.dev"}, {"id": 1}))
    assert u, "resend test user must exist"
    rr = requests.post(f"{BASE}/control/users/{u['id']}/action", json={"action": "suspend", "reason": "qa71"}, headers=AH_LIVE, timeout=30)
    assert rr.status_code == 200, rr.text
    d = rr.json()["delivery"]
    assert d["email"] in ("sent", "failed"), f"real Resend attempt must be made + status recorded: {d}"
    # regardless of email outcome the action stands, and the attempt is logged in email_events
    assert _db(lambda db: db.users.find_one({"id": u["id"]}, {"admin_status": 1}))["admin_status"] == "hidden_pending_review"
    ev = _db(lambda db: db.email_events.find_one({"template": "account_restricted", "to_email": "delivered@resend.dev",
                                                  "created_at": {"$gte": START}}, {"_id": 0, "status": 1, "failure_reason": 1}))
    assert ev and ev["status"] == d["email"], ev
    if ev["status"] == "failed":
        assert ev.get("failure_reason"), "failure must be logged with a reason"
        print("NOTE: Resend rejected the Preview API key:", ev["failure_reason"][:80])
    # reinstate + confirm action stood the whole time
    requests.post(f"{BASE}/control/users/{u['id']}/action", json={"action": "unsuspend"}, headers=AH_LIVE, timeout=30)
    assert _db(lambda db: db.users.find_one({"id": u["id"]}, {"admin_status": 1}))["admin_status"] is None


def test_08_internal_actions_no_comms():
    before = len(notifs_for(JAMES))
    requests.get(f"{BASE}/control/users/{JAMES}", headers=AH, timeout=20)   # profile view
    requests.get(f"{BASE}/control/reports", headers=AH, timeout=20)          # report list view
    assert len(notifs_for(JAMES)) == before, "internal admin views must not notify users"


def test_99_cleanup():
    async def clean(db):
        await db.notifications.delete_many({"created_at": {"$gte": START}, "dedupe_key": {"$exists": True}})
        await db.notifications.delete_many({"created_at": {"$gte": START}, "user_id": {"$in": [JAMES, SARAH]},
                                            "type": {"$regex": "^(admin_|verification_|report_outcome)"}})
        await db.reports.delete_many({"reason": "qa71"})
        await db.verification_submissions.delete_many({"profession": "QA Plumber"})
        await db.help_requests.delete_many({"public_summary": "qa71 help"})
        await db.admin_audit_logs.delete_many({"at": {"$gte": START}, "action": {"$regex": "^(user_|report_|verification_|help_request_)"}})
        await db.email_events.delete_many({"created_at": {"$gte": START}, "to_email": "delivered@resend.dev"})
        for uid in (JAMES, SARAH):
            await db.users.update_one({"id": uid}, {"$set": {"admin_status": None}})
        j = await db.users.find_one({"id": JAMES}, {"admin_status": 1})
        return j["admin_status"]
    assert _db(clean) is None

"""Orrbbit Professional connection flow — structured requests, sessions, messaging, reviews.

Flow: Discover → Preview → Send Connection Request → Professional Accepts →
Session (conversation unlocks) → Complete → Review.

Messaging only unlocks after a professional accepts a request.
Mounted under /api/professional. Reuses server.py auth, users, notifications.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from email_service import fire as _es_fire

pro_flow_router = APIRouter(prefix="/api/professional")

REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"]
SESSION_STATUSES = ["active", "follow_up", "completed", "cancelled"]

# rate limits for connection requests (anti-spam)
MAX_PENDING_REQUESTS = 5
MAX_REQUESTS_PER_HOUR = 10


def _deps():
    """Late import to avoid a circular import (server.py includes this router)."""
    import server
    return server


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


# --------------------------- rating helpers ---------------------------
async def pro_rating(db, professional_id: str) -> dict:
    """Real aggregate rating from completed-session reviews. Never fabricated."""
    rows = await db.pro_reviews.find({"professional_id": professional_id}).to_list(500)
    if not rows:
        return {"rating": None, "review_count": 0, "top_rated": False, "recommend_pct": None, "completed_sessions": 0}
    avg = round(sum(r["rating"] for r in rows) / len(rows), 1)
    recs = [r for r in rows if r.get("recommend") is not None]
    rec_pct = round(100 * sum(1 for r in recs if r["recommend"]) / len(recs)) if recs else None
    completed = await db.pro_sessions.count_documents({"professional_id": professional_id, "status": "completed"})
    return {
        "rating": avg,
        "review_count": len(rows),
        "top_rated": avg >= 4.5 and len(rows) >= 5,
        "recommend_pct": rec_pct,
        "completed_sessions": completed,
    }


async def _user_brief(db, user_id: str) -> dict:
    u = await db.users.find_one({"id": user_id}, {"hashed_password": 0, "_id": 0}) or {}
    return {
        "id": user_id, "name": u.get("name"), "age": u.get("age"),
        "photo_url": u.get("photo_url"), "distance": u.get("demo_dist"),
    }


async def _assert_participant(db, session: dict, user_id: str):
    if user_id not in (session["requester_id"], session["professional_id"]):
        raise HTTPException(status_code=403, detail="Not part of this session")


# --------------------------- connection requests ---------------------------
class ProConnectIn(BaseModel):
    professional_user_id: str
    category: str = Field(min_length=1, max_length=80)
    message: Optional[str] = Field(default="", max_length=300)


def bind(server):
    """Bind endpoints with server dependencies (called from server.py after definitions)."""
    db = server.db
    get_current_user = server.get_current_user
    notify = server.notify
    get_blocked_ids = server.get_blocked_ids

    @pro_flow_router.post("/connect")
    async def send_pro_request(body: ProConnectIn, user: dict = Depends(get_current_user)):
        """Structured connection request to a professional. Chat stays locked until accepted."""
        await server.feature_gate("connections")
        if body.professional_user_id == user["id"]:
            raise HTTPException(status_code=400, detail="You can't connect with yourself")
        blocked = await get_blocked_ids(user["id"])
        if body.professional_user_id in blocked:
            raise HTTPException(status_code=403, detail="Unavailable")
        pro = await server._pro_public(body.professional_user_id, user)
        if not pro or not pro.get("verified_by_intro"):
            raise HTTPException(status_code=404, detail="Professional not available")
        server._check_banned(body.message or "")

        # already in an open session together
        existing_session = await db.pro_sessions.find_one({
            "requester_id": user["id"], "professional_id": body.professional_user_id,
            "status": {"$in": ["active", "follow_up"]},
        })
        if existing_session:
            return {"status": "connected", "session_id": existing_session["id"]}

        # no duplicate active requests to the same professional
        dup = await db.pro_requests.find_one({
            "from_user_id": user["id"], "to_user_id": body.professional_user_id, "status": "pending",
        })
        if dup:
            return {"status": "pending", "request_id": dup["id"]}

        # rate limiting / spam prevention
        pending_count = await db.pro_requests.count_documents({"from_user_id": user["id"], "status": "pending"})
        if pending_count >= MAX_PENDING_REQUESTS:
            raise HTTPException(status_code=429, detail="You have too many pending requests. Wait for replies first.")
        hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        recent = await db.pro_requests.count_documents({"from_user_id": user["id"], "created_at": {"$gte": hour_ago}})
        if recent >= MAX_REQUESTS_PER_HOUR:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

        req = {
            "id": str(uuid.uuid4()),
            "from_user_id": user["id"],
            "to_user_id": body.professional_user_id,
            "category": body.category,
            "message": (body.message or "").strip(),
            "status": "pending",
            "created_at": _now_iso(),
            "responded_at": None,
        }
        await db.pro_requests.insert_one(dict(req))
        await notify(body.professional_user_id, "pro_request_received", "New connection request",
                     f"{user.get('name')} needs help with {body.category}.")
        pro_user = await db.users.find_one({"id": body.professional_user_id})
        if pro_user:
            _es_fire(server.email_service.send(
                "help_request_received", user=pro_user, entity_id=req["id"],
                ctx={"other_name": user.get("name"), "category": body.category,
                     "category_part": f" about {body.category}" if body.category else "",
                     "message": (body.message or "").strip()[:200]}))
        return {"status": "pending", "request_id": req["id"]}

    @pro_flow_router.get("/connect/requests")
    async def list_pro_requests(user: dict = Depends(get_current_user)):
        """Sent + received professional connection requests with statuses."""
        blocked = await get_blocked_ids(user["id"])
        sent_raw = await db.pro_requests.find({"from_user_id": user["id"]}).to_list(200)
        recv_raw = await db.pro_requests.find({"to_user_id": user["id"]}).to_list(200)

        async def row(r, other_id, include_pro=False):
            out = {
                "id": r["id"], "status": r["status"], "category": r["category"],
                "message": r.get("message", ""), "created_at": r["created_at"],
                "responded_at": r.get("responded_at"),
                "user": await _user_brief(db, other_id),
            }
            sess = await db.pro_sessions.find_one({"request_id": r["id"]}, {"_id": 0, "id": 1})
            out["session_id"] = sess["id"] if sess else None
            if include_pro:
                pro = await server._pro_public(other_id, user)
                if pro:
                    out["professional"] = {
                        "profession": pro.get("profession"),
                        "verified_by_intro": pro.get("verified_by_intro"),
                    }
            return out

        sent = [await row(r, r["to_user_id"], include_pro=True)
                for r in sorted(sent_raw, key=lambda x: x["created_at"], reverse=True)
                if r["to_user_id"] not in blocked]
        received = [await row(r, r["from_user_id"])
                    for r in sorted(recv_raw, key=lambda x: x["created_at"], reverse=True)
                    if r["from_user_id"] not in blocked]
        return {"sent": sent, "received": received,
                "pending_received": sum(1 for r in received if r["status"] == "pending"),
                "pending_sent": sum(1 for r in sent if r["status"] == "pending")}

    @pro_flow_router.post("/connect/requests/{req_id}/accept")
    async def accept_pro_request(req_id: str, user: dict = Depends(get_current_user)):
        """Professional accepts → session created, conversation unlocks. Idempotent."""
        r = await db.pro_requests.find_one({"id": req_id, "to_user_id": user["id"]})
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")
        ok, _ = await server._active_pro(user["id"])
        if not ok:
            raise HTTPException(status_code=403, detail="Professional verification is required to accept requests")
        if r["status"] == "declined":
            raise HTTPException(status_code=400, detail="Request was already declined")
        existing = await db.pro_sessions.find_one({"request_id": req_id}, {"_id": 0})
        if existing:
            return {"ok": True, "session": existing}
        session = {
            "id": str(uuid.uuid4()),
            "request_id": req_id,
            "requester_id": r["from_user_id"],
            "professional_id": user["id"],
            "category": r["category"],
            "status": "active",
            "created_at": _now_iso(),
            "completed_at": None,
        }
        await db.pro_sessions.insert_one(dict(session))
        await db.pro_requests.update_one({"id": req_id}, {"$set": {"status": "accepted", "responded_at": _now_iso()}})
        await notify(r["from_user_id"], "pro_request_accepted", "Request accepted",
                     f"{user.get('name')} accepted your request. You can now start the conversation.")
        requester = await db.users.find_one({"id": r["from_user_id"]})
        if requester:
            _es_fire(server.email_service.send(
                "help_request_accepted", user=requester, entity_id=session["id"],
                ctx={"other_name": user.get("name"), "category": r.get("category") or "your",
                     "session_id": session["id"]}))
        session.pop("_id", None)
        return {"ok": True, "session": session}

    @pro_flow_router.post("/connect/requests/{req_id}/decline")
    async def decline_pro_request(req_id: str, user: dict = Depends(get_current_user)):
        r = await db.pro_requests.find_one({"id": req_id, "to_user_id": user["id"]})
        if not r:
            raise HTTPException(status_code=404, detail="Request not found")
        if r["status"] != "pending":
            raise HTTPException(status_code=400, detail="Request already handled")
        await db.pro_requests.update_one({"id": req_id}, {"$set": {"status": "declined", "responded_at": _now_iso()}})
        # neutral message — no private decline reason exposed
        await notify(r["from_user_id"], "pro_request_declined", "Request update",
                     "The professional isn't available for this request right now.")
        return {"ok": True}

    # --------------------------- sessions ---------------------------
    @pro_flow_router.get("/sessions")
    async def list_sessions(user: dict = Depends(get_current_user)):
        rows = await db.pro_sessions.find({
            "$or": [{"requester_id": user["id"]}, {"professional_id": user["id"]}],
        }).to_list(200)
        out = []
        for s in sorted(rows, key=lambda x: x["created_at"], reverse=True):
            other_id = s["professional_id"] if s["requester_id"] == user["id"] else s["requester_id"]
            last = await db.pro_messages.find_one({"session_id": s["id"]}, {"_id": 0}, sort=[("created_at", -1)])
            unread = await db.pro_messages.count_documents({"session_id": s["id"], "from_user_id": other_id, "read": False})
            review = await db.pro_reviews.find_one({"session_id": s["id"]}, {"_id": 0, "rating": 1})
            item = {
                "id": s["id"], "category": s["category"], "status": s["status"],
                "created_at": s["created_at"], "completed_at": s.get("completed_at"),
                "i_am": "requester" if s["requester_id"] == user["id"] else "professional",
                "other": await _user_brief(db, other_id),
                "last_message": {"text": last["text"], "created_at": last["created_at"], "mine": last["from_user_id"] == user["id"]} if last else None,
                "unread": unread,
                "reviewed": bool(review),
            }
            pro = await server._pro_public(s["professional_id"], user)
            if pro:
                item["professional"] = {
                    "user_id": s["professional_id"], "profession": pro.get("profession"),
                    "verified_by_intro": pro.get("verified_by_intro"),
                    "availability": pro.get("availability"), "response_time": pro.get("response_time"),
                    **(await pro_rating(db, s["professional_id"])),
                }
            out.append(item)
        return {"sessions": out, "unread_total": sum(s["unread"] for s in out)}

    @pro_flow_router.get("/sessions/{session_id}")
    async def get_session(session_id: str, user: dict = Depends(get_current_user)):
        s = await db.pro_sessions.find_one({"id": session_id}, {"_id": 0})
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        await _assert_participant(db, s, user["id"])
        other_id = s["professional_id"] if s["requester_id"] == user["id"] else s["requester_id"]
        s["i_am"] = "requester" if s["requester_id"] == user["id"] else "professional"
        s["other"] = await _user_brief(db, other_id)
        pro = await server._pro_public(s["professional_id"], user)
        if pro:
            s["professional"] = {
                "user_id": s["professional_id"], "profession": pro.get("profession"),
                "verified_by_intro": pro.get("verified_by_intro"),
                "availability": pro.get("availability"), "response_time": pro.get("response_time"),
                **(await pro_rating(db, s["professional_id"])),
            }
        review = await db.pro_reviews.find_one({"session_id": session_id}, {"_id": 0, "rating": 1, "review": 1, "recommend": 1})
        s["review"] = review
        return s

    class SessionUpdateIn(BaseModel):
        status: str

    @pro_flow_router.put("/sessions/{session_id}")
    async def update_session(session_id: str, body: SessionUpdateIn, user: dict = Depends(get_current_user)):
        if body.status not in SESSION_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        s = await db.pro_sessions.find_one({"id": session_id})
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        await _assert_participant(db, s, user["id"])
        if s["status"] in ("completed", "cancelled") and body.status != s["status"]:
            raise HTTPException(status_code=400, detail="This session is closed")
        upd = {"status": body.status}
        if body.status == "completed":
            upd["completed_at"] = _now_iso()
        await db.pro_sessions.update_one({"id": session_id}, {"$set": upd})
        other_id = s["professional_id"] if s["requester_id"] == user["id"] else s["requester_id"]
        if body.status in ("completed", "cancelled"):
            await notify(other_id, f"pro_session_{body.status}", f"Session {body.status}",
                         f"{user.get('name')} marked your session as {body.status.replace('_', ' ')}.")
            other = await db.users.find_one({"id": other_id})
            if body.status == "completed":
                if other:
                    _es_fire(server.email_service.send(
                        "session_completed", user=other, entity_id=session_id,
                        idempotency_key=f"session_completed:{other_id}:{session_id}",
                        ctx={"other_name": user.get("name"), "session_id": session_id}))
                requester = user if s["requester_id"] == user["id"] else other
                pro_user = other if s["requester_id"] == user["id"] else user
                if requester and pro_user:
                    _es_fire(server.email_service.send(
                        "leave_review", user=requester, entity_id=session_id,
                        idempotency_key=f"leave_review:{session_id}",
                        ctx={"other_name": pro_user.get("name"), "session_id": session_id}))
            elif other:
                _es_fire(server.email_service.send(
                    "request_cancelled", user=other, entity_id=session_id,
                    idempotency_key=f"request_cancelled:{other_id}:{session_id}",
                    ctx={"other_name": user.get("name"), "category": s.get("category") or "connection"}))
        return {"ok": True, "status": body.status}

    # --------------------------- messaging (unlocks after acceptance only) ---------------------------
    @pro_flow_router.get("/sessions/{session_id}/messages")
    async def list_messages(session_id: str, user: dict = Depends(get_current_user)):
        s = await db.pro_sessions.find_one({"id": session_id})
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        await _assert_participant(db, s, user["id"])
        msgs = await db.pro_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
        await db.pro_messages.update_many(
            {"session_id": session_id, "from_user_id": {"$ne": user["id"]}, "read": False},
            {"$set": {"read": True}},
        )
        return {"messages": msgs, "session_status": s["status"]}

    class MessageIn(BaseModel):
        text: str = Field(min_length=1, max_length=1000)

    @pro_flow_router.post("/sessions/{session_id}/messages")
    async def send_message(session_id: str, body: MessageIn, user: dict = Depends(get_current_user)):
        s = await db.pro_sessions.find_one({"id": session_id})
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        await _assert_participant(db, s, user["id"])
        if s["status"] not in ("active", "follow_up"):
            raise HTTPException(status_code=403, detail="Messaging is closed for this session")
        other_id = s["professional_id"] if s["requester_id"] == user["id"] else s["requester_id"]
        blocked = await get_blocked_ids(user["id"])
        if other_id in blocked:
            raise HTTPException(status_code=403, detail="Unavailable")
        server._check_banned(body.text)
        msg = {
            "id": str(uuid.uuid4()), "session_id": session_id,
            "from_user_id": user["id"], "text": body.text.strip(),
            "created_at": _now_iso(), "read": False,
        }
        await db.pro_messages.insert_one(dict(msg))
        await notify(other_id, "pro_session_message", "New message",
                     f"{user.get('name')}: {body.text[:60]}")
        msg.pop("_id", None)
        return msg

    # --------------------------- reviews (real completed sessions only) ---------------------------
    class ReviewIn(BaseModel):
        rating: int = Field(ge=1, le=5)
        review: Optional[str] = Field(default="", max_length=600)
        recommend: Optional[bool] = None

    @pro_flow_router.post("/sessions/{session_id}/review")
    async def review_session(session_id: str, body: ReviewIn, user: dict = Depends(get_current_user)):
        s = await db.pro_sessions.find_one({"id": session_id})
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        if s["requester_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the requester can review a session")
        if s["status"] != "completed":
            raise HTTPException(status_code=400, detail="You can review only completed sessions")
        if await db.pro_reviews.find_one({"session_id": session_id}):
            raise HTTPException(status_code=400, detail="You have already reviewed this session")
        server._check_banned(body.review or "")
        doc = {
            "id": str(uuid.uuid4()), "session_id": session_id,
            "professional_id": s["professional_id"], "requester_id": user["id"],
            "rating": body.rating, "review": (body.review or "").strip(),
            "recommend": body.recommend, "created_at": _now_iso(),
        }
        await db.pro_reviews.insert_one(dict(doc))
        await notify(s["professional_id"], "pro_review_received", "New review",
                     f"{user.get('name')} rated your session {body.rating}/5.")
        pro_user = await db.users.find_one({"id": s["professional_id"]})
        if pro_user:
            review_txt = (body.review or "").strip()
            _es_fire(server.email_service.send(
                "review_received", user=pro_user, entity_id=doc["id"],
                ctx={"other_name": user.get("name"), "rating": body.rating,
                     "review_part": f': "{review_txt[:140]}"' if review_txt else "."}))
        doc.pop("_id", None)
        return doc


# --------------------------- demo seeding (demo users only, never live) ---------------------------
PRO_FLOW_DEMO_VERSION = 2


async def seed_pro_flow_demo(server, force: bool = False):
    db = server.db
    marker = await db.meta.find_one({"key": "pro_flow_demo_version"})
    if marker and marker.get("value") == PRO_FLOW_DEMO_VERSION and not force:
        return
    demo_ids = [u["id"] async for u in db.users.find({"is_demo": True}, {"id": 1})]
    if demo_ids:
        for coll in (db.pro_requests, db.pro_sessions, db.pro_messages, db.pro_reviews):
            await coll.delete_many({"$or": [
                {"from_user_id": {"$in": demo_ids}}, {"to_user_id": {"$in": demo_ids}},
                {"requester_id": {"$in": demo_ids}}, {"professional_id": {"$in": demo_ids}},
            ]})

    async def uid(email):
        u = await db.users.find_one({"email": email}, {"id": 1})
        return u["id"] if u else None

    # 1) seed realistic review history for verified DEMO professionals
    profs = await db.professional_profiles.find({"is_draft": {"$ne": True}}).to_list(300)
    reviewer_pool = [i for i in demo_ids][:40]
    snippets = [
        "Really knowledgeable and easy to talk to.", "Sorted my problem quickly.",
        "Clear advice, would use again.", "Professional and responsive.",
        "Great local find — highly recommend.", "Explained everything simply.",
        "Fast reply and genuinely helpful.", "Knew exactly what to do.",
    ]
    for p in profs:
        owner = await db.users.find_one({"id": p["user_id"]}, {"is_demo": 1})
        if not owner or not owner.get("is_demo"):
            continue  # never fabricate data for live professionals
        ver = await server._verification_status(p["user_id"])
        if ver.get("status") != "Approved":
            continue
        seedn = (sum(ord(c) for c in p["user_id"]) % 6) + 3  # 3-8 reviews, deterministic
        for i in range(seedn):
            reviewer = reviewer_pool[(i * 7 + seedn) % max(1, len(reviewer_pool))] if reviewer_pool else None
            if not reviewer or reviewer == p["user_id"]:
                continue
            rating = 5 if (i + seedn) % 3 else 4
            sess_id = str(uuid.uuid4())
            created = (datetime.now(timezone.utc) - timedelta(days=3 + i * 9)).isoformat()
            await db.pro_sessions.insert_one({
                "id": sess_id, "request_id": str(uuid.uuid4()),
                "requester_id": reviewer, "professional_id": p["user_id"],
                "category": p.get("primary_category", "Other"), "status": "completed",
                "created_at": created, "completed_at": created, "demo_seed": True,
            })
            await db.pro_reviews.insert_one({
                "id": str(uuid.uuid4()), "session_id": sess_id,
                "professional_id": p["user_id"], "requester_id": reviewer,
                "rating": rating, "review": snippets[(i + seedn) % len(snippets)],
                "recommend": True, "created_at": created, "demo_seed": True,
            })

    # 2) demo@intro.demo gets a live-feeling workflow: pending request + active session with messages
    alex = await uid("demo@intro.demo")
    sana = await uid("sana@radar.intro.demo")   # verified HR pro
    dev = await uid("dev@radar.intro.demo")     # verified IT pro
    if alex and sana:
        await db.pro_requests.insert_one({
            "id": str(uuid.uuid4()), "from_user_id": alex, "to_user_id": sana,
            "category": "HR Advice", "message": "Need guidance on managing a difficult team situation.",
            "status": "pending", "created_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "responded_at": None, "demo_seed": True,
        })
    if alex and dev:
        req_id = str(uuid.uuid4())
        sess_id = str(uuid.uuid4())
        t0 = datetime.now(timezone.utc) - timedelta(hours=20)
        await db.pro_requests.insert_one({
            "id": req_id, "from_user_id": alex, "to_user_id": dev,
            "category": "IT Support", "message": "My small business website keeps going down.",
            "status": "accepted", "created_at": t0.isoformat(),
            "responded_at": (t0 + timedelta(minutes=42)).isoformat(), "demo_seed": True,
        })
        await db.pro_sessions.insert_one({
            "id": sess_id, "request_id": req_id, "requester_id": alex, "professional_id": dev,
            "category": "IT Support", "status": "active",
            "created_at": (t0 + timedelta(minutes=42)).isoformat(), "completed_at": None, "demo_seed": True,
        })
        msgs = [
            (dev, "Hi Alex, happy to help. When did the outages start?", 45),
            (alex, "About a week ago — usually in the evenings.", 60),
            (dev, "Sounds like a hosting resource limit. Can you share your provider?", 75),
        ]
        for sender, text, mins in msgs:
            await db.pro_messages.insert_one({
                "id": str(uuid.uuid4()), "session_id": sess_id, "from_user_id": sender,
                "text": text, "created_at": (t0 + timedelta(minutes=mins)).isoformat(),
                "read": sender != dev, "demo_seed": True,
            })
    await db.meta.update_one({"key": "pro_flow_demo_version"},
                             {"$set": {"value": PRO_FLOW_DEMO_VERSION, "at": _now_iso()}}, upsert=True)

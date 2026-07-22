"""IntroYu Control Centre — Phase 2 modules.

Connections, Chats moderation, Radar insights, Notifications composer,
Analytics, Feature Flags, App Config, Emergency Controls, System Health.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
import uuid
import time
import shutil

from control_center import (
    db, control_router as _p1, get_current_admin, require_perm, require_super_admin,
    get_mode, user_filter, uid_filter, demo_user_ids, audit, _check_recent_reauth,
    _client_info, now, now_iso, ROLE_PERMS,
)

control_p2_router = APIRouter(prefix="/api/control")

# Extend role permissions for Phase 2 modules
for role, extra in {
    "operations": {"connections", "chats", "radar", "notifications", "analytics", "flags", "system"},
    "moderation": {"chats", "connections"},
    "support": {"connections", "chats"},
    "verification": {"radar"},
    "marketing": {"notifications", "analytics", "radar"},
    "analytics": {"analytics", "radar"},
    "finance": {"analytics"},
}.items():
    ROLE_PERMS[role] = ROLE_PERMS[role] | extra


class NotificationIn(BaseModel):
    title: str
    body: str
    audience: str  # everyone | professionals | people_mode | professional_mode | city | category
    city: Optional[str] = None
    category: Optional[str] = None
    scheduled_at: Optional[str] = None  # ISO datetime


class FlagUpdateIn(BaseModel):
    enabled: bool


class ConfigUpdateIn(BaseModel):
    key: str
    value: str


# ----------------------------- Connections -----------------------------
@control_p2_router.get("/connections")
async def control_connections(status: Optional[str] = None, page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
                              admin: dict = Depends(require_perm("connections")), mode: str = Depends(get_mode)):
    linked = await uid_filter(mode, "from_user_id")
    f: dict = {"kind": "request", **linked}
    nowi = now_iso()
    if status == "pending":
        f.update({"status": "new", "expires_at": {"$gte": nowi}})
    elif status == "accepted":
        f["status"] = "accepted"
    elif status == "rejected":
        f["status"] = "declined"
    elif status == "expired":
        f.update({"status": "new", "expires_at": {"$lt": nowi}})
    total = await db.pings.count_documents(f)
    rows = await db.pings.find(f, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    ids = [r["from_user_id"] for r in rows] + [r["to_user_id"] for r in rows]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "email": 1, "photo_url": 1, "city": 1})}
    for r in rows:
        fu, tu = users.get(r["from_user_id"], {}), users.get(r["to_user_id"], {})
        r["from_user"] = {"id": r["from_user_id"], "name": fu.get("name"), "photo_url": fu.get("photo_url"), "city": fu.get("city")}
        r["to_user"] = {"id": r["to_user_id"], "name": tu.get("name"), "photo_url": tu.get("photo_url")}
        r["display_status"] = "expired" if (r["status"] == "new" and (r.get("expires_at") or "9") < nowi) else ("pending" if r["status"] == "new" else ("rejected" if r["status"] == "declined" else r["status"]))
    counts = {
        "pending": await db.pings.count_documents({"kind": "request", **linked, "status": "new", "expires_at": {"$gte": nowi}}),
        "accepted": await db.pings.count_documents({"kind": "request", **linked, "status": "accepted"}),
        "rejected": await db.pings.count_documents({"kind": "request", **linked, "status": "declined"}),
        "expired": await db.pings.count_documents({"kind": "request", **linked, "status": "new", "expires_at": {"$lt": nowi}}),
        "active_matches": await db.matches.count_documents({**(await uid_filter(mode, "user_a")), "active": True}),
    }
    return {"total": total, "page": page, "limit": limit, "items": rows, "counts": counts}


# ----------------------------- Chats (moderation, read-only) -----------------------------
@control_p2_router.get("/chats")
async def control_chats(user_id: Optional[str] = None, admin: dict = Depends(require_perm("chats")), mode: str = Depends(get_mode)):
    f: dict = dict(await uid_filter(mode, "user_a"))
    if user_id:
        f = {"$or": [{"user_a": user_id}, {"user_b": user_id}]}
    matches = await db.matches.find(f, {"_id": 0}).sort("created_at", -1).to_list(100)
    ids = [m["user_a"] for m in matches] + [m["user_b"] for m in matches]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "photo_url": 1})}
    convos = []
    for m in matches:
        msg_count = await db.messages.count_documents({"match_id": m["id"]})
        convos.append({
            "match_id": m["id"], "created_at": m.get("created_at"), "active": m.get("active", False),
            "participants": [
                {"id": m["user_a"], "name": users.get(m["user_a"], {}).get("name"), "photo_url": users.get(m["user_a"], {}).get("photo_url")},
                {"id": m["user_b"], "name": users.get(m["user_b"], {}).get("name"), "photo_url": users.get(m["user_b"], {}).get("photo_url")},
            ],
            "message_count": msg_count,
        })
    return {"items": convos, "messaging_launched": await db.messages.count_documents({}) > 0}


@control_p2_router.get("/chats/{match_id}/messages")
async def control_chat_messages(match_id: str, request: Request, admin: dict = Depends(require_perm("chats")), mode: str = Depends(get_mode)):
    """Read-only conversation view for report investigations. Viewing is itself audited. Messages are NEVER editable."""
    msgs = await db.messages.find({"match_id": match_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    ip, _ = _client_info(request)
    await audit(admin, "chat_viewed", "chat", match_id, new_value={"messages": len(msgs)}, ip=ip, mode=mode)
    return {"items": msgs}


# ----------------------------- Radar insights -----------------------------
@control_p2_router.get("/radar-insights")
async def radar_insights(kind: str = "people", admin: dict = Depends(require_perm("radar")), mode: str = Depends(get_mode)):
    uf = user_filter(mode)
    linked = await uid_filter(mode)
    d24 = (now() - timedelta(hours=24)).isoformat()

    async def group(coll, match, field, limit=10):
        rows = await db[coll].aggregate([
            {"$match": match}, {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}, {"$limit": limit},
        ]).to_list(limit)
        return [{"label": r["_id"] or "Unknown", "count": r["count"]} for r in rows]

    if kind == "professional":
        pros_f = {**linked, "is_draft": {"$ne": True}}
        pro_users = [p["user_id"] for p in await db.professional_profiles.find(pros_f, {"user_id": 1}).to_list(1000)]
        active_pros = await db.users.count_documents({"id": {"$in": pro_users}, "last_active": {"$gte": d24}})
        sample = await db.professional_profiles.find(pros_f, {"_id": 0, "user_id": 1, "profession": 1, "primary_category": 1, "availability": 1}).to_list(20)
        names = {u["id"]: u async for u in db.users.find({"id": {"$in": [s["user_id"] for s in sample]}}, {"id": 1, "name": 1, "city": 1, "last_active": 1, "photo_url": 1})}
        for s2 in sample:
            u = names.get(s2["user_id"], {})
            s2.update({"name": u.get("name"), "city": u.get("city"), "last_active": u.get("last_active"), "photo_url": u.get("photo_url")})
        return {
            "kind": kind,
            "stats": {
                "professionals": await db.professional_profiles.count_documents(pros_f),
                "active_24h": active_pros,
                "open_help_requests": await db.help_requests.count_documents({**linked, "status": "active"}),
                "available_now": await db.professional_profiles.count_documents({**pros_f, "availability": "Available now"}),
            },
            "by_category": await group("professional_profiles", pros_f, "primary_category"),
            "requests_by_category": await group("help_requests", {**linked, "status": "active"}, "category"),
            "hot_areas": await group("users", {"id": {"$in": pro_users}}, "city"),
            "sample": sample,
        }

    active_f = {**uf, "visible": True, "admin_status": {"$nin": ["banned", "hidden_pending_review"]}}
    sample_users = await db.users.find({**active_f, "last_active": {"$gte": d24}},
                                       {"_id": 0, "id": 1, "name": 1, "vibe": 1, "city": 1, "last_active": 1, "photo_url": 1}).sort("last_active", -1).to_list(20)
    return {
        "kind": "people",
        "stats": {
            "visible_users": await db.users.count_documents(active_f),
            "active_24h": await db.users.count_documents({**active_f, "last_active": {"$gte": d24}}),
            "ghost_mode": await db.users.count_documents({**uf, "ghost_mode": True}),
            "paused": await db.users.count_documents({**uf, "paused": True}),
        },
        "by_vibe": await group("users", active_f, "vibe"),
        "hot_areas": await group("users", active_f, "city"),
        "by_intent": await group("users", {**active_f, "intent": {"$ne": None}}, "intent"),
        "sample": sample_users,
    }


# ----------------------------- Notifications composer -----------------------------
async def _resolve_audience(body: NotificationIn, mode: str) -> list:
    uf = user_filter(mode)
    f = {**uf, "admin_status": {"$nin": ["banned"]}}
    if body.audience == "professionals":
        linked = await uid_filter(mode)
        pro_ids = [p["user_id"] for p in await db.professional_profiles.find({**linked, "is_draft": {"$ne": True}}, {"user_id": 1}).to_list(2000)]
        f["id"] = {"$in": pro_ids}
    elif body.audience == "people_mode":
        f["app_mode"] = {"$ne": "professional"}
    elif body.audience == "professional_mode":
        f["app_mode"] = "professional"
    elif body.audience == "city":
        if not body.city:
            raise HTTPException(status_code=400, detail="City is required for a city audience")
        f["city"] = body.city
    elif body.audience == "category":
        if not body.category:
            raise HTTPException(status_code=400, detail="Category is required for a category audience")
        linked = await uid_filter(mode)
        pro_ids = [p["user_id"] for p in await db.professional_profiles.find({**linked, "primary_category": body.category}, {"user_id": 1}).to_list(2000)]
        f["id"] = {"$in": pro_ids}
    elif body.audience != "everyone":
        raise HTTPException(status_code=400, detail="Invalid audience")
    return [u["id"] async for u in db.users.find(f, {"id": 1})]


async def _deliver(campaign: dict):
    docs = [{
        "id": str(uuid.uuid4()), "user_id": uid, "type": "announcement",
        "title": campaign["title"], "body": campaign["body"], "read": False, "created_at": now_iso(),
        "campaign_id": campaign["id"],
    } for uid in campaign["target_user_ids"]]
    if docs:
        await db.notifications.insert_many(docs)
    await db.admin_notifications.update_one({"id": campaign["id"]}, {"$set": {
        "status": "sent", "delivered": len(docs), "sent_at": now_iso(),
        "push_status": "mocked (push provider not configured — delivered as in-app notifications)",
    }})


@control_p2_router.post("/notifications")
async def create_notification(body: NotificationIn, request: Request,
                              admin: dict = Depends(require_perm("notifications")), mode: str = Depends(get_mode)):
    if not body.title.strip() or not body.body.strip():
        raise HTTPException(status_code=400, detail="Title and message are required")
    targets = await _resolve_audience(body, mode)
    campaign = {
        "id": str(uuid.uuid4()), "title": body.title.strip(), "body": body.body.strip(),
        "audience": body.audience, "city": body.city, "category": body.category,
        "targeted": len(targets), "target_user_ids": targets, "delivered": 0,
        "status": "scheduled" if body.scheduled_at and body.scheduled_at > now_iso() else "sending",
        "scheduled_at": body.scheduled_at, "mode": mode,
        "created_by": admin["email"], "created_at": now_iso(),
    }
    await db.admin_notifications.insert_one(dict(campaign))
    if campaign["status"] == "sending":
        await _deliver(campaign)
    ip, _ = _client_info(request)
    await audit(admin, "notification_created", "notification", campaign["id"],
                new_value={"title": body.title, "audience": body.audience, "targeted": len(targets), "scheduled_at": body.scheduled_at}, ip=ip, mode=mode)
    return {"ok": True, "id": campaign["id"], "targeted": len(targets), "status": "scheduled" if campaign["status"] == "scheduled" else "sent"}


@control_p2_router.get("/notifications")
async def list_notifications(admin: dict = Depends(require_perm("notifications")), mode: str = Depends(get_mode)):
    # lazily deliver due scheduled campaigns
    due = await db.admin_notifications.find({"status": "scheduled", "scheduled_at": {"$lte": now_iso()}}).to_list(20)
    for c in due:
        await _deliver(c)
    rows = await db.admin_notifications.find({"mode": mode}, {"_id": 0, "target_user_ids": 0}).sort("created_at", -1).to_list(100)
    cities = await db.users.distinct("city", user_filter(mode))
    categories = await db.professional_profiles.distinct("primary_category", await uid_filter(mode))
    return {"items": rows, "cities": sorted([c for c in cities if c]), "categories": sorted([c for c in categories if c])}


# ----------------------------- Analytics -----------------------------
@control_p2_router.get("/analytics")
async def control_analytics(admin: dict = Depends(require_perm("analytics")), mode: str = Depends(get_mode)):
    uf = user_filter(mode)
    linked = await uid_filter(mode)
    from_uid = await uid_filter(mode, "from_user_id")
    today = now().date().isoformat()
    d7, d30 = (now() - timedelta(days=7)).isoformat(), (now() - timedelta(days=30)).isoformat()

    async def series(coll, base, field="created_at", days=30):
        since = (now() - timedelta(days=days)).isoformat()
        rows = await db[coll].find({**base, field: {"$gte": since}}, {field: 1}).to_list(5000)
        b: dict = {}
        for r in rows:
            b[(r.get(field) or "")[:10]] = b.get((r.get(field) or "")[:10], 0) + 1
        return [{"date": (now() - timedelta(days=i)).date().isoformat(), "count": b.get((now() - timedelta(days=i)).date().isoformat(), 0)} for i in range(days - 1, -1, -1)]

    async def group(coll, match, field, limit=8):
        rows = await db[coll].aggregate([{"$match": match}, {"$group": {"_id": f"${field}", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": limit}]).to_list(limit)
        return [{"label": r["_id"] or "Unknown", "count": r["count"]} for r in rows]

    total = await db.users.count_documents(uf)
    completed = await db.users.count_documents({**uf, "bio": {"$nin": [None, ""]}})
    engaged_ids = set(await db.pings.distinct("from_user_id", from_uid)) | set(await db.help_requests.distinct("user_id", linked))
    connected = len(set(await db.matches.distinct("user_a", await uid_filter(mode, "user_a"))))

    # retention: weekly signup cohorts vs still-active in last 7 days
    cohorts = []
    for w in range(4):
        start = (now() - timedelta(weeks=w + 1)).isoformat()
        end = (now() - timedelta(weeks=w)).isoformat()
        size = await db.users.count_documents({**uf, "created_at": {"$gte": start, "$lt": end}})
        retained = await db.users.count_documents({**uf, "created_at": {"$gte": start, "$lt": end}, "last_active": {"$gte": d7}})
        cohorts.append({"cohort": f"{w + 1}w ago", "size": size, "retained": retained, "rate": round(retained / size * 100) if size else None})

    return {
        "kpis": {
            "dau": await db.users.count_documents({**uf, "last_active": {"$gte": today}}),
            "wau": await db.users.count_documents({**uf, "last_active": {"$gte": d7}}),
            "mau": await db.users.count_documents({**uf, "last_active": {"$gte": d30}}),
            "connections_30d": await db.matches.count_documents({**(await uid_filter(mode, "user_a")), "created_at": {"$gte": d30}}),
            "pings_30d": await db.pings.count_documents({**from_uid, "created_at": {"$gte": d30}}),
            "help_requests_30d": await db.help_requests.count_documents({**linked, "created_at": {"$gte": d30}}),
            "session_length": None,  # not tracked yet
        },
        "series": {
            "signups": await series("users", uf),
            "connections": await series("matches", await uid_filter(mode, "user_a")),
            "pings": await series("pings", from_uid),
            "help_requests": await series("help_requests", linked),
            "professional_growth": await series("professional_profiles", linked),
        },
        "popular_categories": await group("help_requests", linked, "category"),
        "popular_locations": await group("users", uf, "city"),
        "professional_categories": await group("professional_profiles", {**linked, "is_draft": {"$ne": True}}, "primary_category"),
        "retention_cohorts": cohorts,
        "funnel": [
            {"stage": "Registered", "count": total},
            {"stage": "Completed profile", "count": completed},
            {"stage": "Engaged (ping / request)", "count": len(engaged_ids)},
            {"stage": "Connected", "count": connected},
        ],
    }


# ----------------------------- Feature flags + Emergency controls -----------------------------
FLAG_DEFS = [
    {"key": "registration", "label": "Registration", "desc": "New user sign-ups", "emergency": True},
    {"key": "connections", "label": "Connections", "desc": "Connection requests between users", "emergency": True},
    {"key": "messaging", "label": "Messaging", "desc": "In-app messaging (when launched)", "emergency": True},
    {"key": "help_requests", "label": "Help Requests", "desc": "Posting professional help requests", "emergency": True},
    {"key": "professional_mode", "label": "Professional Mode", "desc": "The entire professional side of the app"},
    {"key": "radar", "label": "Radar", "desc": "The nearby discovery radar"},
    {"key": "verification", "label": "Professional Verification", "desc": "Credential submission and review", "emergency": True},
    {"key": "push_notifications", "label": "Push Notifications", "desc": "Outbound push (currently mocked)", "emergency": True},
    {"key": "payments", "label": "Payments", "desc": "Payment processing (not configured)"},
    {"key": "subscriptions", "label": "Subscriptions", "desc": "Subscription plans (not configured)"},
    {"key": "ai_features", "label": "AI Features", "desc": "AI-powered features"},
    {"key": "beta_features", "label": "Beta Features", "desc": "Experimental features for beta users"},
    {"key": "maintenance_mode", "label": "Maintenance Mode", "desc": "Blocks all gated app actions with a maintenance message", "emergency": True, "inverted": True},
]
REAUTH_FLAGS = {"maintenance_mode", "registration"}


@control_p2_router.get("/feature-flags")
async def get_feature_flags(admin: dict = Depends(require_perm("flags"))):
    stored = {f["key"]: f async for f in db.feature_flags.find({})}
    out = []
    for d in FLAG_DEFS:
        s = stored.get(d["key"], {})
        default = False if d.get("inverted") else True
        out.append({**d, "enabled": s.get("enabled", default), "updated_by": s.get("updated_by"), "updated_at": s.get("updated_at")})
    return {"items": out}


@control_p2_router.put("/feature-flags/{key}")
async def update_feature_flag(key: str, body: FlagUpdateIn, request: Request, admin: dict = Depends(require_perm("flags"))):
    d = next((f for f in FLAG_DEFS if f["key"] == key), None)
    if not d:
        raise HTTPException(status_code=400, detail="Unknown flag")
    if key in REAUTH_FLAGS:
        fresh = await db.admin_users.find_one({"id": admin["id"]})
        _check_recent_reauth(fresh)
    old = await db.feature_flags.find_one({"key": key})
    await db.feature_flags.update_one(
        {"key": key},
        {"$set": {"key": key, "enabled": body.enabled, "updated_by": admin["email"], "updated_at": now_iso()}},
        upsert=True)
    ip, _ = _client_info(request)
    await audit(admin, "feature_flag_updated", "feature_flag", key,
                old_value={"enabled": old.get("enabled") if old else None}, new_value={"enabled": body.enabled}, ip=ip)
    return {"ok": True, "key": key, "enabled": body.enabled}


# ----------------------------- App configuration -----------------------------
CONFIG_DEFS = [
    {"key": "search_radius_max", "label": "Maximum search radius (m)", "default": "500"},
    {"key": "max_visible_users", "label": "Maximum visible users on radar", "default": "100"},
    {"key": "credential_expiry_reminder_days", "label": "Credential expiry reminders (days before)", "default": "90,60,30"},
    {"key": "free_plan_radius", "label": "Free plan max radius (m)", "default": "50"},
    {"key": "plus_plan_radius", "label": "Plus plan max radius (m)", "default": "100"},
    {"key": "pro_plan_radius", "label": "Pro plan max radius (m)", "default": "500"},
    {"key": "min_age", "label": "Minimum registration age", "default": "18"},
    {"key": "maintenance_message", "label": "Maintenance mode message", "default": "IntroYu is briefly down for maintenance. Please try again soon."},
]


@control_p2_router.get("/app-config")
async def get_app_config(admin: dict = Depends(get_current_admin)):
    stored = {c["key"]: c async for c in db.app_config.find({})}
    return {"items": [{**d, "value": stored.get(d["key"], {}).get("value", d["default"]),
                       "updated_by": stored.get(d["key"], {}).get("updated_by"),
                       "updated_at": stored.get(d["key"], {}).get("updated_at")} for d in CONFIG_DEFS]}


@control_p2_router.put("/app-config")
async def update_app_config(body: ConfigUpdateIn, request: Request, admin: dict = Depends(require_super_admin())):
    d = next((c for c in CONFIG_DEFS if c["key"] == body.key), None)
    if not d:
        raise HTTPException(status_code=400, detail="Unknown config key")
    old = await db.app_config.find_one({"key": body.key})
    await db.app_config.update_one({"key": body.key}, {"$set": {"key": body.key, "value": body.value, "updated_by": admin["email"], "updated_at": now_iso()}}, upsert=True)
    ip, _ = _client_info(request)
    await audit(admin, "app_config_updated", "app_config", body.key,
                old_value={"value": old.get("value") if old else d["default"]}, new_value={"value": body.value}, ip=ip)
    return {"ok": True}


# ----------------------------- System health -----------------------------
@control_p2_router.get("/system-health")
async def system_health(admin: dict = Depends(require_perm("system"))):
    t0 = time.time()
    try:
        await db.command("ping")
        db_ok, db_ms = True, round((time.time() - t0) * 1000, 1)
    except Exception:
        db_ok, db_ms = False, None
    du = shutil.disk_usage("/")
    mem = {}
    try:
        with open("/proc/meminfo") as fh:
            for line in fh:
                k, v = line.split(":", 1)
                if k in ("MemTotal", "MemAvailable"):
                    mem[k] = int(v.strip().split()[0]) // 1024  # MB
    except Exception:
        pass
    colls = {}
    for c in ("users", "pings", "matches", "help_requests", "professional_profiles", "verification_submissions", "reports", "notifications", "admin_audit_logs"):
        colls[c] = await db[c].count_documents({})
    scheduled = await db.admin_notifications.find({"status": "scheduled"}, {"_id": 0, "id": 1, "title": 1, "scheduled_at": 1, "targeted": 1}).to_list(20)
    recent_fails = await db.admin_login_audit.count_documents({"success": False, "at": {"$gte": (now() - timedelta(hours=24)).isoformat()}})
    jobs = [
        {"name": "Credential expiry monitor", "type": "lazy (runs on verification reads)", "status": "healthy", "last_run": now_iso()},
        {"name": "Scheduled notifications dispatcher", "type": "lazy (runs on notification reads)", "status": "healthy", "queued": len(scheduled)},
        {"name": "Demo data seeder", "type": "startup", "status": "healthy"},
    ]
    return {
        "services": {
            "api": {"status": "operational", "latency_ms": db_ms},
            "database": {"status": "operational" if db_ok else "down", "latency_ms": db_ms},
            "storage": {"status": "operational", "used_gb": round((du.total - du.free) / 1e9, 1), "total_gb": round(du.total / 1e9, 1), "used_pct": round((du.total - du.free) / du.total * 100)},
            "email": {"status": "not_configured"},
            "push_notifications": {"status": "mocked"},
            "memory": {"status": "operational", "total_mb": mem.get("MemTotal"), "available_mb": mem.get("MemAvailable")},
        },
        "collections": colls,
        "background_jobs": jobs,
        "queues": {"scheduled_notifications": scheduled},
        "security": {"failed_admin_logins_24h": recent_fails},
        "crash_reports": [],
    }

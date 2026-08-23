"""Orrbbit Control Centre — admin portal backend (Phase 1).

Separate admin auth domain (JWT token_type=control_access), role-based permissions,
LIVE/DEMO data isolation, full audit logging. Mounted under /api/control.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Header, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
import time
import jwt as pyjwt

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

CONTROL_JWT_SECRET = os.environ.get("CONTROL_JWT_SECRET", os.environ["JWT_SECRET"] + "-control")
JWT_ALGO = "HS256"
TOKEN_EXPIRE_HOURS = 8
REAUTH_WINDOW_MINUTES = 5
LOCK_THRESHOLD = 5
LOCK_MINUTES = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

from email_service import fire as _es_fire  # noqa: E402


async def _email_user(template: str, user_id: str, ctx: dict | None = None, entity_id: str | None = None):
    """Send a moderation/verification email via the central EmailService (fire-and-forget)."""
    import control_email as _ce
    if _ce._svc is None:
        return
    u = await db.users.find_one({"id": user_id})
    if u:
        _es_fire(_ce._svc.send(template, user=u, ctx=ctx or {}, entity_id=entity_id))

control_router = APIRouter(prefix="/api/control")

ROLES = ["super_admin", "operations", "verification", "support", "moderation", "marketing", "finance", "analytics"]

# Module permissions per role. super_admin implicitly has everything.
ROLE_PERMS = {
    "operations": {"dashboard", "users", "professionals", "verifications", "help_requests", "reports", "activity", "search"},
    "verification": {"dashboard", "professionals", "verifications", "activity", "search"},
    "support": {"dashboard", "users", "help_requests", "activity", "search"},
    "moderation": {"dashboard", "users", "reports", "help_requests", "activity", "search"},
    "marketing": {"dashboard", "activity", "search"},
    "finance": {"dashboard", "activity", "search"},
    "analytics": {"dashboard", "activity", "search"},
}
HIGH_RISK_ACTIONS = {"ban", "delete"}


def now():
    return datetime.now(timezone.utc)


def now_iso():
    return now().isoformat()


# ----------------------------- Models -----------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ReauthIn(BaseModel):
    password: str


class UserActionIn(BaseModel):
    action: str  # suspend | unsuspend | ban | unban | delete | force_logout | verify_email | reset_password
    reason: Optional[str] = ""


class DecisionIn(BaseModel):
    action: str  # approve | reject | more_info | suspend | renew | mark_expired | revoke
    note: Optional[str] = ""


class HelpRequestActionIn(BaseModel):
    action: str  # close | delete | feature | unfeature
    reason: Optional[str] = ""


class ReportActionIn(BaseModel):
    action: str  # warn | suspend | ban | dismiss
    reason: Optional[str] = ""


class AdminCreateIn(BaseModel):
    email: EmailStr
    password: str
    role: str


# ----------------------------- Bootstrap -----------------------------
async def bootstrap_control_admin():
    """One-time secure seed of the first Super Admin from env vars. Never re-runs once any admin exists."""
    if await db.admin_users.count_documents({}) > 0:
        return
    email = os.environ.get("CONTROL_BOOTSTRAP_EMAIL")
    password = os.environ.get("CONTROL_BOOTSTRAP_PASSWORD")
    if not email or not password:
        return
    await db.admin_users.insert_one({
        "id": str(uuid.uuid4()), "email": email.lower(), "hashed_password": pwd_context.hash(password),
        "role": "super_admin", "is_active": True, "must_change_password": True,
        "failed_login_count": 0, "lockout_until": None, "last_reauth_at": None,
        "created_at": now_iso(), "updated_at": now_iso(), "last_login_at": None, "last_login_ip": None,
    })
    await db.admin_audit_logs.insert_one({
        "id": str(uuid.uuid4()), "admin_id": "system", "admin_email": "system",
        "action": "bootstrap_super_admin_created", "target_type": "admin", "target_id": email.lower(),
        "old_value": None, "new_value": {"role": "super_admin", "must_change_password": True},
        "ip": None, "mode": "live", "at": now_iso(),
    })


# ----------------------------- Auth core -----------------------------
def _make_token(admin: dict) -> str:
    return pyjwt.encode({
        "sub": admin["id"], "email": admin["email"], "role": admin["role"],
        "token_type": "control_access", "must_change_password": admin.get("must_change_password", False),
        "exp": now() + timedelta(hours=TOKEN_EXPIRE_HOURS), "iat": now(),
    }, CONTROL_JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_admin(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if cred is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(cred.credentials, CONTROL_JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("token_type") != "control_access":
        raise HTTPException(status_code=401, detail="Invalid token")
    admin = await db.admin_users.find_one({"id": payload.get("sub")})
    if not admin or not admin.get("is_active", True):
        raise HTTPException(status_code=401, detail="Invalid token")
    if admin.get("force_logout_after") and payload.get("iat"):
        if datetime.fromtimestamp(payload["iat"], tz=timezone.utc) < datetime.fromisoformat(admin["force_logout_after"]):
            raise HTTPException(status_code=401, detail="Session expired")
    return admin


def require_perm(perm: str):
    async def dep(admin: dict = Depends(get_current_admin)) -> dict:
        role = admin.get("role")
        if role != "super_admin" and perm not in ROLE_PERMS.get(role, set()):
            raise HTTPException(status_code=403, detail="Insufficient privileges")
        if admin.get("must_change_password"):
            raise HTTPException(status_code=403, detail="Password change required")
        return admin
    return dep


def require_super_admin():
    async def dep(admin: dict = Depends(get_current_admin)) -> dict:
        if admin.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Super Admin only")
        if admin.get("must_change_password"):
            raise HTTPException(status_code=403, detail="Password change required")
        return admin
    return dep


def _check_recent_reauth(admin: dict):
    ts = admin.get("last_reauth_at")
    if not ts or (now() - datetime.fromisoformat(ts)) > timedelta(minutes=REAUTH_WINDOW_MINUTES):
        raise HTTPException(status_code=428, detail="Re-authentication required")


def _client_info(request: Request):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else None)
    return ip, request.headers.get("user-agent")


async def audit(admin: dict, action: str, target_type: str, target_id, old_value=None, new_value=None, ip=None, mode="live"):
    await db.admin_audit_logs.insert_one({
        "id": str(uuid.uuid4()), "admin_id": admin["id"], "admin_email": admin["email"],
        "action": action, "target_type": target_type, "target_id": target_id,
        "old_value": old_value, "new_value": new_value, "ip": ip, "mode": mode, "at": now_iso(),
    })


# ----------------------------- LIVE/DEMO isolation -----------------------------
def get_mode(x_admin_mode: Optional[str] = Header(default="live")) -> str:
    # LIVE is the safe default: real production data must never be hidden because
    # a client failed to send the mode header. Demo data is strictly opt-in.
    return "demo" if x_admin_mode == "demo" else "live"


def user_filter(mode: str) -> dict:
    return {"is_demo": True} if mode == "demo" else {"is_demo": {"$ne": True}}


_demo_ids_cache = {"ids": None, "at": 0.0}


async def demo_user_ids() -> set:
    if _demo_ids_cache["ids"] is None or time.time() - _demo_ids_cache["at"] > 60:
        rows = await db.users.find({"is_demo": True}, {"id": 1}).to_list(2000)
        _demo_ids_cache["ids"] = {r["id"] for r in rows}
        _demo_ids_cache["at"] = time.time()
    return _demo_ids_cache["ids"]


async def uid_filter(mode: str, field: str = "user_id") -> dict:
    ids = await demo_user_ids()
    return {field: {"$in": list(ids)}} if mode == "demo" else {field: {"$nin": list(ids)}}


def strip(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("hashed_password", None)
    return doc


def admin_public(a: dict) -> dict:
    return {"id": a["id"], "email": a["email"], "role": a["role"], "is_active": a.get("is_active", True),
            "must_change_password": a.get("must_change_password", False), "last_login_at": a.get("last_login_at"),
            "created_at": a.get("created_at")}


# ----------------------------- Auth endpoints -----------------------------
@control_router.post("/auth/login")
async def control_login(body: LoginIn, request: Request):
    ip, ua = _client_info(request)
    ts = now()
    admin = await db.admin_users.find_one({"email": body.email.lower()})

    async def log_attempt(success: bool, reason: str):
        await db.admin_login_audit.insert_one({
            "id": str(uuid.uuid4()), "email": body.email.lower(), "admin_id": admin["id"] if admin else None,
            "success": success, "reason": reason, "ip": ip, "user_agent": ua, "at": ts.isoformat(),
        })

    if admin:
        lo = admin.get("lockout_until")
        if lo and ts < datetime.fromisoformat(lo):
            await log_attempt(False, "locked_out")
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    if not admin or not pwd_context.verify(body.password, admin["hashed_password"]) or not admin.get("is_active", True):
        if admin:
            failed = admin.get("failed_login_count", 0) + 1
            upd = {"failed_login_count": failed}
            if failed >= LOCK_THRESHOLD:
                upd["lockout_until"] = (ts + timedelta(minutes=LOCK_MINUTES)).isoformat()
            await db.admin_users.update_one({"id": admin["id"]}, {"$set": upd})
        await log_attempt(False, "invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await db.admin_users.update_one({"id": admin["id"]}, {"$set": {
        "failed_login_count": 0, "lockout_until": None, "last_login_at": ts.isoformat(), "last_login_ip": ip,
    }})
    await log_attempt(True, "login_success")
    return {"token": _make_token(admin), "admin": admin_public(admin),
            "must_change_password": admin.get("must_change_password", False)}


@control_router.post("/auth/change-password")
async def control_change_password(body: ChangePasswordIn, request: Request, admin: dict = Depends(get_current_admin)):
    if not pwd_context.verify(body.current_password, admin["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if len(body.new_password) < 10 or body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters and different from the current one")
    await db.admin_users.update_one({"id": admin["id"]}, {"$set": {
        "hashed_password": pwd_context.hash(body.new_password), "must_change_password": False,
        "updated_at": now_iso(), "failed_login_count": 0, "lockout_until": None,
    }})
    ip, _ = _client_info(request)
    await audit(admin, "password_changed", "admin", admin["id"], ip=ip)
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    return {"ok": True, "token": _make_token(fresh), "admin": admin_public(fresh)}


@control_router.get("/auth/me")
async def control_me(admin: dict = Depends(get_current_admin)):
    return admin_public(admin)


@control_router.post("/auth/reauth")
async def control_reauth(body: ReauthIn, request: Request, admin: dict = Depends(get_current_admin)):
    if not pwd_context.verify(body.password, admin["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.admin_users.update_one({"id": admin["id"]}, {"$set": {"last_reauth_at": now_iso()}})
    ip, _ = _client_info(request)
    await audit(admin, "reauth", "admin", admin["id"], ip=ip)
    return {"ok": True, "valid_minutes": REAUTH_WINDOW_MINUTES}


@control_router.post("/auth/logout")
async def control_logout(request: Request, admin: dict = Depends(get_current_admin)):
    ip, _ = _client_info(request)
    await audit(admin, "logout", "admin", admin["id"], ip=ip)
    return {"ok": True}


# ----------------------------- Dashboard -----------------------------
def _day_key(iso: str) -> str:
    return (iso or "")[:10]


@control_router.get("/status")
async def control_status(request: Request, admin: dict = Depends(get_current_admin)):
    """Operational status panel. Environment derived from request host server-side.
    Real (non-demo) data only. No secrets exposed."""
    host = (request.headers.get("host") or "").lower()
    environment = "preview" if ("preview" in host or "localhost" in host) else "production"
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    day_ago = (now() - timedelta(hours=24)).isoformat()
    last_sent = await db.email_events.find_one({"status": "sent"}, {"_id": 0, "created_at": 1},
                                               sort=[("created_at", -1)])
    recent_failed = await db.email_events.count_documents({"status": "failed", "created_at": {"$gte": day_ago}})
    recent_sent = await db.email_events.count_documents({"status": "sent", "created_at": {"$gte": day_ago}})
    real = {"is_demo": {"$ne": True}}
    return {
        "environment": environment,
        "backend": "connected",  # this endpoint responding proves the API is up
        "database": "connected" if db_ok else "disconnected",
        "email_provider": "error" if (recent_failed > 0 and recent_sent == 0) else "healthy",
        "email_failures_24h": recent_failed,
        "last_successful_email": (last_sent or {}).get("created_at"),
        "active_users_24h": await db.users.count_documents({**real, "last_active": {"$gte": day_ago}}),
        "open_reports": await db.reports.count_documents({"status": {"$in": ["new", "open", "pending"]}}),
        "pending_credential_reviews": await db.verification_submissions.count_documents(
            {"status": "Pending Review",
             "user_id": {"$nin": await db.users.distinct("id", {"is_demo": True})}}),
        "demo_data_excluded": True,
    }


async def _daily_series(coll, base_filter: dict, days: int = 30, date_field: str = "created_at"):
    since = (now() - timedelta(days=days)).isoformat()
    rows = await db[coll].find({**base_filter, date_field: {"$gte": since}}, {date_field: 1}).to_list(5000)
    buckets = {}
    for r in rows:
        buckets[_day_key(r.get(date_field, ""))] = buckets.get(_day_key(r.get(date_field, "")), 0) + 1
    out = []
    for i in range(days - 1, -1, -1):
        d = (now() - timedelta(days=i)).date().isoformat()
        out.append({"date": d, "count": buckets.get(d, 0)})
    return out


@control_router.get("/dashboard")
async def control_dashboard(admin: dict = Depends(require_perm("dashboard")), mode: str = Depends(get_mode)):
    uf = user_filter(mode)
    ids = await demo_user_ids()
    linked = {"$in": list(ids)} if mode == "demo" else {"$nin": list(ids)}
    today = now().date().isoformat()
    d30 = (now() - timedelta(days=30)).isoformat()
    d15m = (now() - timedelta(minutes=15)).isoformat()

    total_users = await db.users.count_documents(uf)
    online = await db.users.count_documents({**uf, "last_active": {"$gte": d15m}})
    new_today = await db.users.count_documents({**uf, "created_at": {"$gte": today}})
    dau = await db.users.count_documents({**uf, "last_active": {"$gte": today}})
    mau = await db.users.count_documents({**uf, "last_active": {"$gte": d30}})
    pros = await db.professional_profiles.count_documents({"user_id": linked, "is_draft": {"$ne": True}})
    verified_pros = len(await db.verification_submissions.distinct("user_id", {"user_id": linked, "status": "Approved"}))
    pending_ver = await db.verification_submissions.count_documents({"user_id": linked, "status": "Pending"})
    expired_creds = await db.verification_submissions.count_documents({"user_id": linked, "status": "Expired"})
    d30f = (now() + timedelta(days=30)).date().isoformat()
    expiring_soon = await db.verification_submissions.count_documents({
        "user_id": linked, "status": "Approved", "documents.expiry_date": {"$lte": d30f, "$gte": today}})
    help_reqs = await db.help_requests.count_documents({"user_id": linked, "status": "active"})
    conns_today = await db.matches.count_documents({"user_id": linked, "created_at": {"$gte": today}})
    pings_today = await db.pings.count_documents({"created_at": {"$gte": today}, "from_user_id": linked})
    reports_pending = await db.reports.count_documents({"reporter_id": linked, "status": {"$in": [None, "pending", "open"]}})

    try:
        await db.command("ping")
        db_status = "operational"
    except Exception:
        db_status = "down"

    return {
        "mode": mode,
        "kpis": {
            "total_users": total_users, "online_users": online, "new_users_today": new_today,
            "dau": dau, "mau": mau, "professionals": pros, "verified_professionals": verified_pros,
            "pending_verification": pending_ver, "expired_credentials": expired_creds,
            "expiring_soon": expiring_soon, "help_requests": help_reqs,
            "connections_today": conns_today, "messages_today": pings_today,
            "reports_pending": reports_pending,
            "subscriptions": None, "revenue": None,  # payment integration not configured
        },
        "system": {
            "server": "operational", "database": db_status, "api": "operational",
            "storage": "operational", "email": "not_configured", "push_notifications": "mocked",
            "payments": "not_configured",
        },
        "graphs": {
            "user_growth": await _daily_series("users", uf),
            "connections": await _daily_series("matches", {"user_id": linked}),
            "messages": await _daily_series("pings", {"from_user_id": linked}),
            "help_requests": await _daily_series("help_requests", {"user_id": linked}),
            "professional_growth": await _daily_series("professional_profiles", {"user_id": linked}),
            "reports": await _daily_series("reports", {"reporter_id": linked}),
        },
    }


# ----------------------------- Activity feed -----------------------------
@control_router.get("/activity")
async def control_activity(category: Optional[str] = None, window: str = "today",
                           admin: dict = Depends(require_perm("activity")), mode: str = Depends(get_mode)):
    since_map = {"live": timedelta(minutes=30), "today": timedelta(days=1), "7d": timedelta(days=7), "30d": timedelta(days=30)}
    since = (now() - since_map.get(window, timedelta(days=1))).isoformat()
    ids = await demo_user_ids()
    linked = {"$in": list(ids)} if mode == "demo" else {"$nin": list(ids)}
    uf = user_filter(mode)
    items = []

    async def user_names(user_ids):
        rows = await db.users.find({"id": {"$in": list(set(user_ids))}}, {"id": 1, "name": 1, "city": 1}).to_list(500)
        return {r["id"]: r for r in rows}

    if category in (None, "users"):
        for u in await db.users.find({**uf, "created_at": {"$gte": since}}, {"id": 1, "name": 1, "city": 1, "created_at": 1}).sort("created_at", -1).to_list(50):
            items.append({"type": "user_registered", "category": "users", "name": u.get("name"),
                          "location": u.get("city"), "time": u["created_at"], "status": "new",
                          "link": {"module": "users", "id": u["id"]}})
    if category in (None, "verification"):
        subs = await db.verification_submissions.find({"user_id": linked, "$or": [{"submitted_at": {"$gte": since}}, {"reviewed_at": {"$gte": since}}]}).to_list(50)
        names = await user_names([s["user_id"] for s in subs])
        for s in subs:
            n = names.get(s["user_id"], {})
            t = "verification_submitted" if not s.get("reviewed_at") or s.get("reviewed_at", "") < s.get("submitted_at", "") else f"credential_{s.get('status', '').lower()}"
            items.append({"type": t, "category": "verification", "name": n.get("name"),
                          "location": n.get("city"), "time": s.get("reviewed_at") or s.get("submitted_at"),
                          "status": s.get("status"), "link": {"module": "verifications", "id": s["id"]}})
    if category in (None, "professionals"):
        rows = await db.help_requests.find({"user_id": linked, "created_at": {"$gte": since}}).sort("created_at", -1).to_list(50)
        names = await user_names([r["user_id"] for r in rows])
        for r in rows:
            n = names.get(r["user_id"], {})
            items.append({"type": "help_request_posted", "category": "professionals", "name": n.get("name"),
                          "location": n.get("city"), "time": r["created_at"], "status": r.get("status"),
                          "extra": r.get("category"), "link": {"module": "help-requests", "id": r["id"]}})
    if category in (None, "connections"):
        rows = await db.matches.find({"user_id": linked, "created_at": {"$gte": since}}).sort("created_at", -1).to_list(50)
        names = await user_names([r.get("user_id") for r in rows])
        for r in rows:
            n = names.get(r.get("user_id"), {})
            items.append({"type": "connection_accepted", "category": "connections", "name": n.get("name"),
                          "location": n.get("city"), "time": r["created_at"], "status": "accepted",
                          "link": {"module": "users", "id": r.get("user_id")}})
    if category in (None, "reports"):
        rows = await db.reports.find({"reporter_id": linked, "created_at": {"$gte": since}}).sort("created_at", -1).to_list(50)
        names = await user_names([r.get("reporter_id") for r in rows])
        for r in rows:
            n = names.get(r.get("reporter_id"), {})
            items.append({"type": "report_submitted", "category": "reports", "name": n.get("name"),
                          "location": n.get("city"), "time": r["created_at"], "status": r.get("status", "pending"),
                          "extra": r.get("reason"), "link": {"module": "reports", "id": r.get("id") or str(r.get("_id"))}})
    if category in (None, "admin"):
        for a in await db.admin_audit_logs.find({"at": {"$gte": since}}, {"_id": 0}).sort("at", -1).to_list(50):
            items.append({"type": "admin_action", "category": "admin", "name": a.get("admin_email"),
                          "location": None, "time": a["at"], "status": a.get("action"),
                          "extra": f"{a.get('target_type')}:{a.get('target_id')}", "link": {"module": "audit-logs", "id": a.get("id")}})

    items.sort(key=lambda x: x.get("time") or "", reverse=True)
    return {"items": items[:100], "mode": mode, "window": window}


# ----------------------------- Action required -----------------------------
@control_router.get("/action-required")
async def action_required(admin: dict = Depends(require_perm("dashboard")), mode: str = Depends(get_mode)):
    ids = await demo_user_ids()
    linked = {"$in": list(ids)} if mode == "demo" else {"$nin": list(ids)}
    today = now().date().isoformat()
    d30f = (now() + timedelta(days=30)).date().isoformat()

    async def with_users(rows, uid_field="user_id"):
        names = {u["id"]: u async for u in db.users.find({"id": {"$in": [r.get(uid_field) for r in rows]}}, {"id": 1, "name": 1, "email": 1})}
        for r in rows:
            r.pop("_id", None)
            u = names.get(r.get(uid_field), {})
            r["user"] = {"id": r.get(uid_field), "name": u.get("name"), "email": u.get("email")}
        return rows

    pending = await with_users(await db.verification_submissions.find({"user_id": linked, "status": "Pending"}).sort("submitted_at", -1).to_list(20))
    expired = await with_users(await db.verification_submissions.find({"user_id": linked, "status": "Expired"}).sort("reviewed_at", -1).to_list(20))
    expiring = await with_users(await db.verification_submissions.find({"user_id": linked, "status": "Approved", "documents.expiry_date": {"$lte": d30f, "$gte": today}}).to_list(20))
    reports = await with_users(await db.reports.find({"reporter_id": linked, "status": {"$in": [None, "pending", "open"]}}).sort("created_at", -1).to_list(20), "reporter_id")
    return {
        "pending_verifications": pending, "reports_pending": reports,
        "expired_credentials": expired, "expiring_soon": expiring,
        "failed_push_notifications": [], "payment_failures": [], "system_errors": [],
    }


# ----------------------------- Users -----------------------------
@control_router.get("/users")
async def control_users(q: Optional[str] = None, status: Optional[str] = None,
                        page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
                        admin: dict = Depends(require_perm("users")), mode: str = Depends(get_mode)):
    f = dict(user_filter(mode))
    if q:
        f["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}, {"id": q}]
    if status == "suspended":
        f["admin_status"] = "hidden_pending_review"
    elif status == "banned":
        f["admin_status"] = "banned"
    elif status == "active":
        f["admin_status"] = {"$nin": ["banned", "hidden_pending_review"]}
    elif status == "verified_email":
        f["email_verified"] = True
    elif status == "unverified_email":
        f["email_verified"] = {"$ne": True}
    total = await db.users.count_documents(f)
    rows = await db.users.find(f, {"hashed_password": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "items": [strip(r) for r in rows]}


@control_router.get("/users/{user_id}")
async def control_user_detail(user_id: str, admin: dict = Depends(require_perm("users"))):
    u = await db.users.find_one({"id": user_id}, {"hashed_password": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    counts = {
        "connections": await db.matches.count_documents({"$or": [{"user_id": user_id}, {"target_id": user_id}]}),
        "pings_sent": await db.pings.count_documents({"from_user_id": user_id}),
        "pings_received": await db.pings.count_documents({"to_user_id": user_id}),
        "help_requests": await db.help_requests.count_documents({"user_id": user_id}),
        "reports_made": await db.reports.count_documents({"reporter_id": user_id}),
        "reports_against": await db.reports.count_documents({"user_id": user_id}),
        "blocks": await db.blocks.count_documents({"user_id": user_id}),
    }
    prof = await db.professional_profiles.find_one({"user_id": user_id}, {"_id": 0})
    ver = await db.verification_submissions.find_one({"user_id": user_id}, {"_id": 0}, sort=[("submitted_at", -1)])
    logins = await db.admin_login_audit.find({"admin_id": user_id}, {"_id": 0}).to_list(5)
    return {"user": strip(u), "counts": counts, "professional_profile": prof, "verification": ver, "login_history": logins}


@control_router.get("/users/{user_id}/timeline")
async def control_user_timeline(user_id: str, admin: dict = Depends(require_perm("users"))):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    events = [{"type": "registered", "label": "Registered", "time": u.get("created_at")}]
    if u.get("photos") or u.get("bio"):
        events.append({"type": "profile_completed", "label": "Completed profile", "time": u.get("created_at")})
    for r in await db.help_requests.find({"user_id": user_id}, {"_id": 0}).to_list(50):
        events.append({"type": "help_request", "label": f"Posted help request — {r.get('category')}", "time": r.get("created_at"), "detail": r.get("public_summary")})
    for m in await db.matches.find({"user_id": user_id}, {"_id": 0}).to_list(50):
        events.append({"type": "connection", "label": "Connected with a user", "time": m.get("created_at")})
    for s in await db.verification_submissions.find({"user_id": user_id}, {"_id": 0}).to_list(20):
        events.append({"type": "verification", "label": f"Verification {s.get('status')}", "time": s.get("reviewed_at") or s.get("submitted_at")})
    for r in await db.reports.find({"reporter_id": user_id}, {"_id": 0}).to_list(20):
        events.append({"type": "report", "label": f"Reported a user — {r.get('reason')}", "time": r.get("created_at")})
    for a in await db.admin_audit_logs.find({"target_type": "user", "target_id": user_id}, {"_id": 0}).to_list(20):
        events.append({"type": "admin_action", "label": f"Admin action: {a.get('action')}", "time": a.get("at"), "detail": a.get("admin_email")})
    if u.get("last_active"):
        events.append({"type": "last_active", "label": "Last active", "time": u.get("last_active")})
    events = [e for e in events if e.get("time")]
    events.sort(key=lambda e: e["time"], reverse=True)
    return {"events": events}


@control_router.post("/users/{user_id}/action")
async def control_user_action(user_id: str, body: UserActionIn, request: Request,
                              admin: dict = Depends(require_perm("users")), mode: str = Depends(get_mode)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if mode == "live" and u.get("is_demo"):
        raise HTTPException(status_code=400, detail="Demo user cannot be managed in LIVE mode")
    if mode == "demo" and not u.get("is_demo"):
        raise HTTPException(status_code=400, detail="Real user cannot be managed in DEMO mode")
    ip, _ = _client_info(request)
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    old_status = u.get("admin_status")
    result = {"ok": True}

    if body.action in HIGH_RISK_ACTIONS:
        _check_recent_reauth(fresh)

    if body.action == "suspend":
        await db.users.update_one({"id": user_id}, {"$set": {"admin_status": "hidden_pending_review"}})
        await _email_user("account_restricted", user_id)
    elif body.action == "unsuspend" or body.action == "unban":
        await db.users.update_one({"id": user_id}, {"$set": {"admin_status": None}})
        await _email_user("account_restored", user_id)
    elif body.action == "ban":
        await db.users.update_one({"id": user_id}, {"$set": {"admin_status": "banned", "visible": False}})
        await _email_user("account_suspended", user_id)
    elif body.action == "delete":
        await db.users.delete_one({"id": user_id})
        for coll in ("pings", "matches", "saved", "blocks", "hides", "help_requests", "professional_profiles", "verification_submissions", "notifications"):
            await db[coll].delete_many({"$or": [{"user_id": user_id}, {"from_user_id": user_id}, {"to_user_id": user_id}]})
    elif body.action == "force_logout":
        await db.users.update_one({"id": user_id}, {"$set": {"force_logout_after": now_iso()}})
    elif body.action == "verify_email":
        await db.users.update_one({"id": user_id}, {"$set": {"email_verified": True}})
    elif body.action == "reset_password":
        temp = uuid.uuid4().hex[:12] + "!A"
        from server import pwd_context as user_pwd  # same bcrypt context as the app
        await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": user_pwd.hash(temp)}})
        result["temp_password"] = temp
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    await audit(fresh, f"user_{body.action}", "user", user_id,
                old_value={"admin_status": old_status}, new_value={"action": body.action, "reason": body.reason}, ip=ip, mode=mode)
    return result


# ----------------------------- Professionals -----------------------------
@control_router.get("/professionals")
async def control_professionals(q: Optional[str] = None, status: Optional[str] = None,
                                page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
                                admin: dict = Depends(require_perm("professionals")), mode: str = Depends(get_mode)):
    linked = await uid_filter(mode)
    f = {**linked, "is_draft": {"$ne": True}}
    profs = await db.professional_profiles.find(f, {"_id": 0}).sort("created_at", -1).to_list(1000)
    user_ids = [p["user_id"] for p in profs]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": user_ids}}, {"id": 1, "name": 1, "email": 1, "photo_url": 1, "city": 1, "admin_status": 1})}
    subs = await db.verification_submissions.find({"user_id": {"$in": user_ids}}, {"_id": 0, "documents.file_base64": 0}).to_list(2000)
    latest_sub = {}
    for s in sorted(subs, key=lambda x: x.get("submitted_at", "")):
        latest_sub[s["user_id"]] = s
    items = []
    for p in profs:
        u = users.get(p["user_id"], {})
        s = latest_sub.get(p["user_id"])
        expiry = None
        if s:
            dates = [d.get("expiry_date") for d in s.get("documents", []) if d.get("expiry_date")]
            expiry = min(dates) if dates else None
        item = {**p, "user": {"id": p["user_id"], "name": u.get("name"), "email": u.get("email"),
                              "photo_url": u.get("photo_url"), "city": u.get("city"), "admin_status": u.get("admin_status")},
                "verification_status": s.get("status") if s else "Not submitted", "credential_expiry": expiry}
        if q and q.lower() not in ((u.get("name") or "") + (p.get("profession") or "") + (p.get("primary_category") or "")).lower():
            continue
        if status and (s.get("status") if s else "Not submitted") != status:
            continue
        items.append(item)
    total = len(items)
    return {"total": total, "page": page, "limit": limit, "items": items[(page - 1) * limit: page * limit]}


# ----------------------------- Verification queues -----------------------------
_DECISION_MAP = {
    "approve": ("Approved", "Verification approved", "Your professional status has been verified. Orrbbit reviews verified professional credentials annually to help keep information current. Your credential may remain valid for up to 2 years, subject to its actual expiry date."),
    "reject": ("Rejected", "Verification rejected", "Your verification was not approved. See the reviewer note and resubmit."),
    "more_info": ("More Information Required", "More information requested", "The review team needs more information. Check the note and resubmit."),
    "suspend": ("Suspended", "Verification suspended", "Your verification is suspended. Contact support or resubmit updated credentials."),
    "renew": ("Approved", "Verification renewed", "Your verification has been renewed. Your badge stays live."),
    "annual_review": ("Approved", "Annual review completed", "Your annual credential review is complete. Your verified status continues."),
    "mark_expired": ("Expired", "Verification expired", "Your verification was marked expired. Upload updated credentials to continue."),
    "revoke": ("Rejected", "Verification removed", "Your verification badge was removed by the review team."),
}

# decision action → transactional email template
DECISION_EMAIL = {
    "approve": "pro_approved", "renew": "pro_approved",
    "reject": "pro_declined", "revoke": "pro_declined",
    "more_info": "pro_more_info", "suspend": "pro_restricted",
    "annual_review": "annual_review_completed",
    "mark_expired": "credential_expired",
}


async def send_verification_decision_email(sub: dict, action: str, note: str = ""):
    template = DECISION_EMAIL.get(action)
    if not template:
        return
    if action == "renew" and sub.get("status") == "Suspended":
        template = "pro_restored"
    await _email_user(template, sub["user_id"], entity_id=f"{sub['id']}:{action}",
                      ctx={"profession": sub.get("profession") or "professional",
                           "note": (note or "No additional details provided.")[:400]})


@control_router.get("/verifications")
async def control_verifications(status: Optional[str] = None, admin: dict = Depends(require_perm("verifications")), mode: str = Depends(get_mode)):
    linked = await uid_filter(mode)
    f = dict(linked)
    today = now().date().isoformat()
    d30f = (now() + timedelta(days=30)).date().isoformat()
    if status == "expiring_soon":
        f.update({"status": "Approved", "documents.expiry_date": {"$lte": d30f, "$gte": today}})
    elif status == "review_due":
        f.update({"status": "Approved", "credential_next_review_at": {"$lte": now().isoformat()}})
    elif status:
        f["status"] = status
    subs = await db.verification_submissions.find(f, {"_id": 0}).sort("submitted_at", -1).to_list(300)
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": [s["user_id"] for s in subs]}}, {"id": 1, "name": 1, "email": 1, "photo_url": 1})}
    counts = {}
    for st in ("Pending", "Approved", "Rejected", "Expired"):
        counts[st.lower()] = await db.verification_submissions.count_documents({**linked, "status": st})
    counts["expiring_soon"] = await db.verification_submissions.count_documents({**linked, "status": "Approved", "documents.expiry_date": {"$lte": d30f, "$gte": today}})
    for s in subs:
        u = users.get(s["user_id"], {})
        s["user"] = {"id": s["user_id"], "name": u.get("name"), "email": u.get("email"), "photo_url": u.get("photo_url")}
        dates = [d.get("expiry_date") for d in s.get("documents", []) if d.get("expiry_date")]
        s["valid_until"] = min(dates) if dates else None
        s["review_due"] = bool(s.get("credential_next_review_at") and s["credential_next_review_at"][:10] <= today and s.get("status") == "Approved")
    counts["review_due"] = await db.verification_submissions.count_documents(
        {**linked, "status": "Approved", "credential_next_review_at": {"$lte": now().isoformat()}})
    return {"items": subs, "counts": counts}


@control_router.post("/verifications/{sub_id}/decision")
async def control_verification_decision(sub_id: str, body: DecisionIn, request: Request,
                                        admin: dict = Depends(require_perm("verifications")), mode: str = Depends(get_mode)):
    sub = await db.verification_submissions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if body.action not in _DECISION_MAP:
        raise HTTPException(status_code=400, detail="Invalid action")
    new_status, n_title, n_body = _DECISION_MAP[body.action]
    upd = {"status": new_status, "reviewed_at": now_iso(), "reviewer": f"control:{admin['email']}",
           "public_note": (body.note or "") if body.action in ("reject", "more_info", "suspend") else ""}
    if body.action == "renew":
        upd["reminders_sent"] = []
    if body.action in ("approve", "renew"):
        # credential lifecycle: annual review every 12 months, 24-month max validity,
        # the credential's real expiry date always takes precedence
        _doc_dates = [d.get("expiry_date") for d in sub.get("documents", []) if d.get("expiry_date")]
        upd.update({
            "credential_verified_at": now_iso(),
            "credential_last_reviewed_at": now_iso(),
            "credential_next_review_at": (now() + timedelta(days=365)).isoformat(),
            "credential_expiry_date": min(_doc_dates) if _doc_dates else None,
            "credential_review_cycle_months": 12,
            "credential_max_validity_months": 24,
        })
    elif body.action == "annual_review":
        if sub.get("status") != "Approved":
            raise HTTPException(status_code=400, detail="Annual review applies to approved credentials only")
        upd.update({
            "credential_last_reviewed_at": now_iso(),
            "credential_next_review_at": (now() + timedelta(days=365)).isoformat(),
        })
    await db.verification_submissions.update_one(
        {"id": sub_id},
        {"$set": upd, "$push": {"history": {"action": body.action, "by": f"control:{admin['email']}", "note": body.note or "", "at": now_iso()}}})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": sub["user_id"], "type": f"verification_{body.action}",
        "title": n_title, "body": (body.note or n_body), "read": False, "created_at": now_iso()})
    await send_verification_decision_email(sub, body.action, body.note or "")
    ip, _ = _client_info(request)
    await audit(admin, f"verification_{body.action}", "verification", sub_id,
                old_value={"status": sub.get("status")}, new_value={"status": new_status, "note": body.note}, ip=ip, mode=mode)
    return {"ok": True, "status": new_status}


# ----------------------------- Help requests -----------------------------
@control_router.get("/help-requests")
async def control_help_requests(status: Optional[str] = None, category: Optional[str] = None, q: Optional[str] = None,
                                page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
                                admin: dict = Depends(require_perm("help_requests")), mode: str = Depends(get_mode)):
    f = dict(await uid_filter(mode))
    if status:
        f["status"] = status
    if category:
        f["category"] = category
    if q:
        f["public_summary"] = {"$regex": q, "$options": "i"}
    total = await db.help_requests.count_documents(f)
    rows = await db.help_requests.find(f, {"_id": 0}).sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": [r["user_id"] for r in rows]}}, {"id": 1, "name": 1, "email": 1, "city": 1})}
    for r in rows:
        u = users.get(r["user_id"], {})
        r["user"] = {"id": r["user_id"], "name": u.get("name"), "email": u.get("email"), "city": u.get("city")}
    return {"total": total, "page": page, "limit": limit, "items": rows}


@control_router.post("/help-requests/{req_id}/action")
async def control_help_request_action(req_id: str, body: HelpRequestActionIn, request: Request,
                                      admin: dict = Depends(require_perm("help_requests")), mode: str = Depends(get_mode)):
    r = await db.help_requests.find_one({"id": req_id})
    if not r:
        raise HTTPException(status_code=404, detail="Help request not found")
    ip, _ = _client_info(request)
    if body.action == "close":
        await db.help_requests.update_one({"id": req_id}, {"$set": {"status": "closed", "updated_at": now_iso()}})
    elif body.action == "delete":
        fresh = await db.admin_users.find_one({"id": admin["id"]})
        _check_recent_reauth(fresh)
        await db.help_requests.delete_one({"id": req_id})
    elif body.action == "feature":
        await db.help_requests.update_one({"id": req_id}, {"$set": {"featured": True, "updated_at": now_iso()}})
    elif body.action == "unfeature":
        await db.help_requests.update_one({"id": req_id}, {"$set": {"featured": False, "updated_at": now_iso()}})
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    await audit(admin, f"help_request_{body.action}", "help_request", req_id,
                old_value={"status": r.get("status"), "featured": r.get("featured", False)},
                new_value={"action": body.action, "reason": body.reason}, ip=ip, mode=mode)
    return {"ok": True}


# ----------------------------- Reports -----------------------------
@control_router.get("/reports")
async def control_reports(status: Optional[str] = None, admin: dict = Depends(require_perm("reports")), mode: str = Depends(get_mode)):
    f = dict(await uid_filter(mode, "reporter_id"))
    if status == "pending":
        f["status"] = {"$in": [None, "pending", "open"]}
    elif status:
        f["status"] = status
    rows = await db.reports.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)
    ids = [r.get("reporter_id") for r in rows] + [r.get("user_id") for r in rows]
    users = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "email": 1})}
    for r in rows:
        rep, tgt = users.get(r.get("reporter_id"), {}), users.get(r.get("user_id"), {})
        r["reporter"] = {"id": r.get("reporter_id"), "name": rep.get("name"), "email": rep.get("email")}
        r["target"] = {"id": r.get("user_id"), "name": tgt.get("name"), "email": tgt.get("email")}
    return {"items": rows}


@control_router.post("/reports/{report_id}/action")
async def control_report_action(report_id: str, body: ReportActionIn, request: Request,
                                admin: dict = Depends(require_perm("reports")), mode: str = Depends(get_mode)):
    rep = await db.reports.find_one({"id": report_id})
    if not rep:
        raise HTTPException(status_code=404, detail="Report not found")
    ip, _ = _client_info(request)
    target_id = rep.get("user_id")
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    if body.action in ("warn",):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": target_id, "type": "admin_warning",
            "title": "Community guidelines warning", "body": body.reason or "Your recent activity was flagged. Please review the community guidelines.",
            "read": False, "created_at": now_iso()})
        await db.reports.update_one({"id": report_id}, {"$set": {"status": "actioned", "action_taken": "warn"}})
        await _email_user("guidelines_warning", target_id, entity_id=f"{report_id}:warn",
                          ctx={"note": (body.reason or "Your recent activity was flagged by our moderation team.")[:400]})
    elif body.action == "suspend":
        _check_recent_reauth(fresh)
        await db.users.update_one({"id": target_id}, {"$set": {"admin_status": "hidden_pending_review"}})
        await db.reports.update_one({"id": report_id}, {"$set": {"status": "actioned", "action_taken": "suspend"}})
        await _email_user("account_restricted", target_id, entity_id=f"{report_id}:suspend")
    elif body.action == "ban":
        _check_recent_reauth(fresh)
        await db.users.update_one({"id": target_id}, {"$set": {"admin_status": "banned", "visible": False}})
        await db.reports.update_one({"id": report_id}, {"$set": {"status": "actioned", "action_taken": "ban"}})
        await _email_user("account_suspended", target_id, entity_id=f"{report_id}:ban")
    elif body.action == "dismiss":
        await db.reports.update_one({"id": report_id}, {"$set": {"status": "dismissed", "action_taken": "dismiss"}})
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    # outcome email to the reporter (no confidential details shared)
    reporter_id = rep.get("reporter_id")
    if reporter_id and body.action in ("warn", "suspend", "ban", "dismiss"):
        await _email_user("report_outcome", reporter_id, entity_id=f"{report_id}:outcome")
    await audit(admin, f"report_{body.action}", "report", report_id,
                old_value={"status": rep.get("status")}, new_value={"action": body.action, "reason": body.reason, "target_user": target_id}, ip=ip, mode=mode)
    return {"ok": True}


# ----------------------------- Audit logs -----------------------------
@control_router.get("/audit-logs")
async def control_audit_logs(action: Optional[str] = None, admin_email: Optional[str] = None,
                             page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200),
                             admin: dict = Depends(get_current_admin)):
    if admin.get("role") not in ("super_admin", "operations"):
        raise HTTPException(status_code=403, detail="Insufficient privileges")
    f = {}
    if action:
        f["action"] = {"$regex": action, "$options": "i"}
    if admin_email:
        f["admin_email"] = {"$regex": admin_email, "$options": "i"}
    total = await db.admin_audit_logs.count_documents(f)
    rows = await db.admin_audit_logs.find(f, {"_id": 0}).sort("at", -1).skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "items": rows}


# ----------------------------- Global search -----------------------------
@control_router.get("/search")
async def control_search(q: str, admin: dict = Depends(require_perm("search")), mode: str = Depends(get_mode)):
    if not q or len(q) < 2:
        return {"users": [], "professionals": [], "help_requests": [], "reports": []}
    uf = user_filter(mode)
    linked = await uid_filter(mode)
    rx = {"$regex": q, "$options": "i"}
    users = await db.users.find({**uf, "$or": [{"name": rx}, {"email": rx}]}, {"id": 1, "name": 1, "email": 1, "photo_url": 1, "city": 1, "_id": 0}).to_list(6)
    profs = await db.professional_profiles.find({**linked, "$or": [{"profession": rx}, {"primary_category": rx}]}, {"_id": 0, "user_id": 1, "profession": 1, "primary_category": 1}).to_list(6)
    pu = {u["id"]: u async for u in db.users.find({"id": {"$in": [p["user_id"] for p in profs]}}, {"id": 1, "name": 1})}
    for p in profs:
        p["name"] = pu.get(p["user_id"], {}).get("name")
    reqs = await db.help_requests.find({**linked, "$or": [{"public_summary": rx}, {"category": rx}]}, {"_id": 0, "id": 1, "category": 1, "public_summary": 1, "status": 1}).to_list(6)
    reports = await db.reports.find({**(await uid_filter(mode, "reporter_id")), "reason": rx}, {"_id": 0, "id": 1, "reason": 1, "status": 1, "created_at": 1}).to_list(6)
    return {"users": users, "professionals": profs, "help_requests": reqs, "reports": reports}


# ----------------------------- Admin users (Super Admin) -----------------------------
@control_router.get("/admins")
async def list_admins(admin: dict = Depends(require_super_admin())):
    rows = await db.admin_users.find({}, {"_id": 0, "hashed_password": 0}).to_list(100)
    return {"items": rows}


@control_router.post("/admins")
async def create_admin(body: AdminCreateIn, request: Request, admin: dict = Depends(require_super_admin())):
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    _check_recent_reauth(fresh)
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.admin_users.find_one({"email": body.email.lower()}):
        raise HTTPException(status_code=400, detail="Admin already exists")
    if len(body.password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters")
    doc = {"id": str(uuid.uuid4()), "email": body.email.lower(), "hashed_password": pwd_context.hash(body.password),
           "role": body.role, "is_active": True, "must_change_password": True,
           "failed_login_count": 0, "lockout_until": None, "last_reauth_at": None,
           "created_at": now_iso(), "updated_at": now_iso(), "last_login_at": None, "last_login_ip": None}
    await db.admin_users.insert_one(doc)
    ip, _ = _client_info(request)
    await audit(admin, "admin_created", "admin", doc["id"], new_value={"email": body.email.lower(), "role": body.role}, ip=ip)
    return {"ok": True, "admin": admin_public(doc)}

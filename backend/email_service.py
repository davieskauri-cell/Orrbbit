"""Orrbbit central EmailService — all transactional email goes through here.

Handles: Resend delivery (retries, reply-to), idempotency + duplicate prevention,
per-template cooldowns, rate limiting, user preferences, suppression (bounces/
complaints), signed unsubscribe/verify tokens, and full event logging.
Never logs codes/tokens/passwords/API keys.
"""
import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from email_templates import (
    TEMPLATES, PREF_CATEGORIES, PREF_DEFAULTS, build_email, code_box, APP_URL, SUPPORT_EMAIL,
    PUBLIC_BASE_URL, env_cfg,
)

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"
JWT_SECRET = os.environ["JWT_SECRET"]
RATE_LIMIT_PER_HOUR = 10          # optional emails per recipient per hour
SUPPRESSION_BOUNCE_THRESHOLD = 2  # hard bounces before suppression

# ctx keys safe to persist in email_events (NEVER codes/tokens/raw messages)
CTX_SAFE_KEYS = {"name", "other_name", "category", "profession", "rating", "count",
                 "session_id", "when", "expiry", "device", "count_label"}


def _now():
    return datetime.now(timezone.utc)


def _iso(dt=None):
    return (dt or _now()).isoformat()


def is_demo_email(email: str) -> bool:
    e = (email or "").lower()
    return e.endswith(".demo") or e.endswith("@example.com") or e.endswith("@example.org")


class EmailService:
    def __init__(self, db):
        self.db = db
        self.from_addr = f'{env_cfg("FROM_NAME", "ORRBBIT")} <{env_cfg("FROM_EMAIL")}>'
        self.reply_to = SUPPORT_EMAIL
        self._api_key = env_cfg("RESEND_API_KEY")
        self._settings_cache: dict = {}
        self._settings_cache_at = 0.0

    async def ensure_indexes(self):
        await self.db.email_events.create_index("idempotency_key", sparse=True)
        await self.db.email_events.create_index([("to_email", 1), ("created_at", -1)])
        await self.db.email_events.create_index([("user_id", 1), ("created_at", -1)])
        await self.db.email_suppressions.create_index("email", unique=True)
        await self.db.email_resend_attempts.create_index([("user_id", 1), ("created_at", -1)])

    # ------------------------------------------------ settings / prefs
    async def template_enabled(self, key: str) -> bool:
        import time
        if time.time() - self._settings_cache_at > 30:
            docs = await self.db.email_settings.find({}, {"_id": 0}).to_list(200)
            self._settings_cache = {d["key"]: d.get("enabled", True) for d in docs}
            self._settings_cache_at = time.time()
        default = TEMPLATES[key]["enabled"]
        return self._settings_cache.get(key, default)

    @staticmethod
    def user_prefs(user: Optional[dict]) -> dict:
        prefs = dict(PREF_DEFAULTS)
        prefs.update((user or {}).get("email_prefs") or {})
        return prefs

    # ------------------------------------------------ tokens (signed, validated — no open redirects)
    def unsub_token(self, user_id: str, category: str) -> str:
        return pyjwt.encode({"uid": user_id, "cat": category, "purpose": "unsub",
                             "exp": _now() + timedelta(days=90)}, JWT_SECRET, algorithm="HS256")

    def verify_token(self, user_id: str) -> str:
        return pyjwt.encode({"uid": user_id, "purpose": "verify_email",
                             "exp": _now() + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")

    def decode_token(self, token: str, purpose: str) -> Optional[dict]:
        try:
            data = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            return data if data.get("purpose") == purpose else None
        except pyjwt.PyJWTError:
            return None

    # ------------------------------------------------ core send
    async def send(self, key: str, *, user: Optional[dict] = None, to_email: Optional[str] = None,
                   ctx: Optional[dict] = None, entity_id: Optional[str] = None,
                   idempotency_key: Optional[str] = None, force: bool = False,
                   is_test: bool = False) -> dict:
        """Send one transactional email. Returns {status, event_id?, reason?}."""
        tpl = TEMPLATES.get(key)
        if not tpl:
            return {"status": "error", "reason": f"unknown template {key}"}
        email = (to_email or (user or {}).get("email") or "").lower().strip()
        if not email:
            return {"status": "skipped", "reason": "no recipient"}
        if (user or {}).get("is_demo") or is_demo_email(email):
            return {"status": "skipped", "reason": "demo account"}

        ctx = dict(ctx or {})
        ctx.setdefault("name", (user or {}).get("name") or "there")

        if not force:
            if not await self.template_enabled(key):
                return {"status": "skipped", "reason": "template disabled"}
            cat = tpl["category"]
            if cat and user and not self.user_prefs(user).get(cat, PREF_DEFAULTS.get(cat, True)):
                return {"status": "skipped", "reason": f"user opted out of {cat}"}
            if await self.db.email_suppressions.find_one({"email": email}):
                return {"status": "skipped", "reason": "suppressed recipient"}
            # idempotency / duplicate prevention
            idem = idempotency_key or (f"{key}:{email}:{entity_id}" if entity_id else None)
            if idem and await self.db.email_events.find_one(
                    {"idempotency_key": idem, "status": {"$in": ["sent", "queued"]}}):
                return {"status": "skipped", "reason": "duplicate (idempotency)"}
            # cooldown (counts failed attempts too, so transient failures can't spam)
            if tpl["cooldown_min"]:
                since = _iso(_now() - timedelta(minutes=tpl["cooldown_min"]))
                if await self.db.email_events.find_one(
                        {"template": key, "to_email": email, "status": {"$in": ["sent", "failed"]},
                         "created_at": {"$gte": since}}):
                    return {"status": "skipped", "reason": "cooldown active"}
            # rate limit (optional emails only)
            if tpl["category"]:
                hour_ago = _iso(_now() - timedelta(hours=1))
                n = await self.db.email_events.count_documents(
                    {"to_email": email, "status": "sent", "created_at": {"$gte": hour_ago},
                     "mandatory": {"$ne": True}})
                if n >= RATE_LIMIT_PER_HOUR:
                    return {"status": "skipped", "reason": "rate limited"}
        else:
            idem = idempotency_key

        # build links
        unsub_url = prefs_url = verify_url = None
        uid = (user or {}).get("id")
        if tpl["category"] and uid:
            unsub_url = f"{PUBLIC_BASE_URL}/api/email/unsubscribe?token={self.unsub_token(uid, tpl['category'])}"
            prefs_url = f"{PUBLIC_BASE_URL}/email-preferences"
        if key == "verify_email" and uid:
            verify_url = f"{PUBLIC_BASE_URL}/api/email/verify?token={self.verify_token(uid)}"

        rendered = build_email(key, ctx, unsub_url=unsub_url, prefs_url=prefs_url, verify_url=verify_url)

        event = {
            "id": str(uuid.uuid4()), "template": key, "user_id": uid, "to_email": email,
            "entity_id": entity_id, "idempotency_key": idem, "status": "queued",
            "mandatory": tpl["mandatory"], "is_test": is_test,
            "subject": rendered["subject"],
            "ctx": {k: v for k, v in ctx.items() if k in CTX_SAFE_KEYS},
            "resend_id": None, "failure_reason": None,
            "created_at": _iso(), "sent_at": None,
        }
        await self.db.email_events.insert_one(dict(event))
        ok, resend_id, failure = await self._deliver(email, rendered)
        upd = ({"status": "sent", "resend_id": resend_id, "sent_at": _iso()}
               if ok else {"status": "failed", "failure_reason": failure})
        await self.db.email_events.update_one({"id": event["id"]}, {"$set": upd})
        if ok:
            return {"status": "sent", "event_id": event["id"], "resend_id": resend_id}
        logger.warning("Email %s to %s failed: %s", key, email, failure)
        return {"status": "failed", "event_id": event["id"], "reason": failure}

    async def _deliver(self, email: str, rendered: dict):
        """POST to Resend with retries on transient failures. Returns (ok, resend_id, failure)."""
        payload = {
            "from": self.from_addr, "to": [email], "reply_to": [self.reply_to],
            "subject": rendered["subject"], "html": rendered["html"], "text": rendered["text"],
        }
        failure = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(RESEND_URL, json=payload,
                                             headers={"Authorization": f"Bearer {self._api_key}"})
                if resp.status_code < 300:
                    return True, resp.json().get("id"), None
                # 4xx are permanent (bad domain, invalid recipient) — don't retry
                body = resp.text[:300].replace(self._api_key, "***")
                failure = f"HTTP {resp.status_code}: {body}"
                if resp.status_code < 500 and resp.status_code != 429:
                    break
            except (httpx.TimeoutException, httpx.TransportError) as e:
                failure = f"transport: {type(e).__name__}"
            await asyncio.sleep(1 + attempt * 2)
        return False, None, failure

    async def record_bounce(self, email: str, kind: str, reason: str = ""):
        """Bounce/complaint handling — suppress repeat bouncers and all complainers."""
        email = (email or "").lower().strip()
        if not email:
            return
        doc = await self.db.email_bounces.find_one_and_update(
            {"email": email}, {"$inc": {"count": 1},
                               "$set": {"last_kind": kind, "last_reason": reason[:200], "last_at": _iso()}},
            upsert=True, return_document=True)
        count = (doc or {}).get("count", 0) + (0 if doc else 1)
        if kind == "complained" or count >= SUPPRESSION_BOUNCE_THRESHOLD:
            await self.db.email_suppressions.update_one(
                {"email": email}, {"$set": {"email": email, "reason": kind, "created_at": _iso()}}, upsert=True)


def fire(coro):
    """Fire-and-forget email send that never blocks or crashes the request."""
    async def runner():
        try:
            await coro
        except Exception as e:  # noqa: BLE001
            logger.error("Email trigger failed: %s", e)
    try:
        asyncio.get_running_loop().create_task(runner())
    except RuntimeError:
        pass


# =====================================================================
# User-facing routes: preferences, unsubscribe, email verification
# =====================================================================
email_user_router = APIRouter(prefix="/api")

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "static", "email-assets")


@email_user_router.get("/email-assets/{filename}")
async def email_asset(filename: str):
    """Permanent public email assets (logo etc.). No path traversal, long cache."""
    from fastapi.responses import FileResponse
    safe = os.path.basename(filename)
    path = os.path.join(_ASSETS_DIR, safe)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(path, media_type="image/png",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})


_PAGE = """<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orrbbit</title></head><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F6F7F9;margin:0;padding:48px 16px;">
<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 32px;text-align:center;">
<div style="font-size:24px;font-weight:800;color:#081A35;">Orrbb<span style="color:#16B6B0;">i</span>t</div>
<h2 style="color:#081A35;font-size:19px;margin:22px 0 8px;">{title}</h2>
<p style="color:#4B5563;font-size:14px;line-height:22px;">{body}</p>
<a href="{app_url}" style="display:inline-block;background:#16B6B0;color:#fff;text-decoration:none;font-weight:bold;
padding:13px 32px;border-radius:999px;margin-top:14px;font-size:14px;">Open Orrbbit</a></div></body></html>"""


def _page(title, body):
    return HTMLResponse(_PAGE.format(title=title, body=body, app_url=APP_URL))


def _branded_page(title, body, icon="check"):
    """Official Orrbbit verification result page: real logo + brand icon, teal CTA,
    deep link into the app with web fallback. No technical errors exposed."""
    from email_templates import EMAIL_LOGO_URL
    icon_svg = (
        '<svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Success">'
        '<circle cx="32" cy="32" r="30" fill="#E4F6F5" stroke="#20B2AA" stroke-width="3"/>'
        '<path d="M20 33 L28 41 L44 25" stroke="#20B2AA" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        if icon == "check" else
        '<svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="Expired">'
        '<circle cx="32" cy="32" r="30" fill="#FFF0E9" stroke="#FF5A1F" stroke-width="3"/>'
        '<path d="M32 18 v18 M32 44 v2" stroke="#FF5A1F" stroke-width="5" stroke-linecap="round"/></svg>')
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} | Orrbbit</title></head>
<body style="margin:0;background:#F6F8FB;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:430px;margin:60px auto;padding:40px 28px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:20px;text-align:center;">
<img src="{EMAIL_LOGO_URL}" alt="Orrbbit" style="height:44px;max-width:220px;margin-bottom:26px;">
<div style="margin-bottom:18px;">{icon_svg}</div>
<h1 style="color:#16294E;font-size:22px;margin:0 0 10px;">{title}</h1>
<p style="color:#4B5563;font-size:14px;line-height:22px;margin:0 0 22px;">{body}</p>
<a href="orrbbit://" style="display:inline-block;background:#20B2AA;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 36px;border-radius:999px;font-size:15px;">Open Orrbbit</a>
<p style="color:#94A3B8;font-size:12px;margin-top:18px;">App not opening? Visit <a href="https://www.orrbbit.com" style="color:#20B2AA;">www.orrbbit.com</a></p>
<p style="color:#94A3B8;font-size:12px;margin-top:6px;">Need help? <a href="mailto:support@orrbbit.com" style="color:#20B2AA;">support@orrbbit.com</a></p>
</div></body></html>"""
    return HTMLResponse(html)


class PrefsIn(BaseModel):
    connections: Optional[bool] = None
    session_reminders: Optional[bool] = None
    professional_activity: Optional[bool] = None
    weekly_summaries: Optional[bool] = None
    product_updates: Optional[bool] = None
    marketing: Optional[bool] = None


def bind(server, svc: EmailService):
    get_current_user = server.get_current_user
    db = server.db

    @email_user_router.get("/users/me/email-preferences")
    async def get_email_prefs(user: dict = Depends(get_current_user)):
        return {"preferences": EmailService.user_prefs(user),
                "labels": PREF_CATEGORIES,
                "email_verified": bool(user.get("email_verified"))}

    @email_user_router.put("/users/me/email-preferences")
    async def put_email_prefs(body: PrefsIn, user: dict = Depends(get_current_user)):
        changes = {k: v for k, v in body.dict().items() if v is not None}
        if changes:
            prefs = EmailService.user_prefs(user)
            prev_marketing = bool(prefs.get("marketing"))
            prefs.update(changes)
            await db.users.update_one({"id": user["id"]}, {"$set": {"email_prefs": prefs}})
            if "marketing" in changes and bool(changes["marketing"]) != prev_marketing:
                # Append-only marketing consent / withdrawal record
                now = datetime.now(timezone.utc).isoformat()
                await db.consent_records.insert_one({
                    "id": str(uuid.uuid4()), "user_id": user["id"],
                    "event": "marketing_consent_changed",
                    "marketing_opt_in": bool(changes["marketing"]),
                    "marketing_consent_at": now if changes["marketing"] else None,
                    "marketing_withdrawn_at": None if changes["marketing"] else now,
                    "method": "email_preferences", "created_at": now,
                })
            return {"ok": True, "preferences": prefs}
        return {"ok": True, "preferences": EmailService.user_prefs(user)}

    @email_user_router.get("/email/unsubscribe")
    async def unsubscribe(token: str = ""):
        data = svc.decode_token(token, "unsub")
        if not data or data.get("cat") not in PREF_CATEGORIES:
            return _page("Link expired", "This unsubscribe link is invalid or has expired. You can manage email preferences inside the Orrbbit app.")
        user = await db.users.find_one({"id": data["uid"]})
        if not user:
            return _page("Link expired", "This unsubscribe link is no longer valid.")
        prefs = EmailService.user_prefs(user)
        prefs[data["cat"]] = False
        await db.users.update_one({"id": user["id"]}, {"$set": {"email_prefs": prefs}})
        label = PREF_CATEGORIES[data["cat"]].lower()
        return _page("You're unsubscribed", f"You'll no longer receive {label} from Orrbbit. Security and account emails will still be delivered. You can re-enable this anytime in the app under Settings → Email Preferences.")

    @email_user_router.get("/email/verify")
    async def verify_email(token: str = ""):
        data = svc.decode_token(token, "verify_email")
        if not data:
            return _branded_page(
                "This verification link has expired",
                "For your security, verification links are only valid for a limited time. "
                "Open the Orrbbit app and tap “Resend verification email” to get a new link.",
                icon="expired")
        user = await db.users.find_one({"id": data["uid"]})
        if not user:
            return _branded_page("We couldn't verify this link",
                                 "This verification link is no longer valid. You can request a new one from the Orrbbit app.",
                                 icon="expired")
        if user.get("email_verified"):
            return _branded_page("Your email is already verified",
                                 "You're all set — head back to Orrbbit to continue.", icon="check")
        await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True, "email_verified_at": _iso()}})
        first = (user.get("name") or "").split(" ")[0]
        return _branded_page("Email verified",
                             f"Thanks{', ' + first if first else ''}. Your email address has been verified. "
                             "You're ready to continue to Orrbbit.", icon="check")

    async def _resend_guard(user_id: str, limit: int = 5):
        """Abuse control: max N verification-email requests per rolling hour per
        account — counted at the endpoint (independent of delivery/demo/test skips)."""
        hour_ago = (_now() - timedelta(hours=1)).isoformat()
        n = await db.email_resend_attempts.count_documents(
            {"user_id": user_id, "created_at": {"$gte": hour_ago}})
        if n >= limit:
            raise HTTPException(status_code=429,
                                detail="Too many verification emails requested. Please try again later.")
        await db.email_resend_attempts.insert_one(
            {"user_id": user_id, "created_at": _iso()})

    @email_user_router.post("/email/resend-verification")
    async def resend_verification(user: dict = Depends(get_current_user)):
        if user.get("email_verified"):
            return {"ok": True, "message": "Email already verified"}
        await _resend_guard(user["id"])
        res = await svc.send("verify_email", user=user, ctx={"name": user.get("name")},
                             idempotency_key=f"verify:{user['id']}:{_now().strftime('%Y%m%d%H%M')[:11]}")
        if res["status"] == "skipped" and res.get("reason") == "demo account":
            return {"ok": True, "message": "Demo accounts don't receive emails"}
        return {"ok": res["status"] in ("sent", "skipped"), "message": "Verification email sent"}

    class ChangeEmailIn(BaseModel):
        new_email: str

    @email_user_router.post("/email/change-unverified")
    async def change_unverified_email(body: ChangeEmailIn, user: dict = Depends(get_current_user)):
        """Fix a typo'd email BEFORE verification. Never carries verified status."""
        if user.get("email_verified"):
            raise HTTPException(status_code=400, detail="Email already verified — use account settings to change it.")
        new_email = body.new_email.strip().lower()
        if "@" not in new_email or "." not in new_email.split("@")[-1] or len(new_email) > 254:
            raise HTTPException(status_code=400, detail="Please enter a valid email address")
        existing = await db.users.find_one({"email": new_email})
        if existing and existing["id"] != user["id"]:
            raise HTTPException(status_code=400, detail="That email can't be used")
        await _resend_guard(user["id"])  # same hourly cap — change-email can't be used to spam
        await db.users.update_one({"id": user["id"]},
                                  {"$set": {"email": new_email, "email_verified": False}})
        fresh = await db.users.find_one({"id": user["id"]})
        await svc.send("verify_email", user=fresh, ctx={"name": fresh.get("name")},
                       idempotency_key=f"verify:{user['id']}:{new_email}:{_now().strftime('%Y%m%d%H')}")
        return {"ok": True, "email": new_email}

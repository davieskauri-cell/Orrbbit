"""Orrbbit Control Centre — Email admin tools + Resend webhook.

Admins can: preview every template, send test emails, view delivery status,
search events by user/email, view failures & bounces, retry appropriate failed
emails and toggle optional templates. Passwords/security tokens are never
stored in events, so they can never be exposed here.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from control_center import db, require_perm, audit, _client_info, ROLE_PERMS, now_iso
from email_templates import TEMPLATES, PREF_CATEGORIES, SAMPLE_CTX, build_email

# emails module permission for relevant roles (super_admin implicit)
for _role in ("operations", "support", "marketing"):
    ROLE_PERMS[_role] = ROLE_PERMS[_role] | {"emails"}

control_email_router = APIRouter(prefix="/api/control/email")
resend_webhook_router = APIRouter(prefix="/api/webhooks")

_svc = None  # injected by server.py


def set_service(svc):
    global _svc
    _svc = svc


# Security-sensitive templates whose context contains one-time codes/links —
# never retryable from stored (redacted) context.
NO_RETRY = {"password_reset", "verify_email"}


class TestSendIn(BaseModel):
    to_email: EmailStr


class SettingIn(BaseModel):
    enabled: bool


@control_email_router.get("/templates")
async def list_templates(admin: dict = Depends(require_perm("emails"))):
    overrides = {d["key"]: d.get("enabled") for d in await db.email_settings.find({}).to_list(200)}
    items = []
    for key, t in TEMPLATES.items():
        items.append({
            "key": key, "subject": t["subject"], "category": t["category"],
            "category_label": PREF_CATEGORIES.get(t["category"]) if t["category"] else None,
            "mandatory": t["mandatory"], "trigger": t["trigger"],
            "enabled": overrides.get(key, t["enabled"]),
            "default_enabled": t["enabled"], "cooldown_min": t["cooldown_min"],
        })
    return {"items": items, "categories": PREF_CATEGORIES}


@control_email_router.get("/templates/{key}/preview")
async def preview_template(key: str, admin: dict = Depends(require_perm("emails"))):
    if key not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    rendered = build_email(key, dict(SAMPLE_CTX),
                           unsub_url="#unsubscribe-sample", prefs_url="#prefs-sample",
                           verify_url="#verify-sample")
    return {"key": key, **rendered}


@control_email_router.post("/templates/{key}/test")
async def send_test(key: str, body: TestSendIn, request: Request,
                    admin: dict = Depends(require_perm("emails"))):
    if key not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    res = await _svc.send(key, to_email=body.to_email, ctx=dict(SAMPLE_CTX),
                          force=True, is_test=True)
    ip, _ = _client_info(request)
    await audit(admin, "email_test_sent", "email_template", key,
                new_value={"to": body.to_email, "status": res["status"]}, ip=ip)
    return res


@control_email_router.put("/templates/{key}/settings")
async def set_template_enabled(key: str, body: SettingIn, request: Request,
                               admin: dict = Depends(require_perm("emails"))):
    if key not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Unknown template")
    if TEMPLATES[key]["mandatory"] and not body.enabled:
        raise HTTPException(status_code=400, detail="Mandatory security/account templates cannot be disabled")
    await db.email_settings.update_one({"key": key}, {"$set": {"key": key, "enabled": body.enabled}}, upsert=True)
    _svc._settings_cache_at = 0  # bust cache
    ip, _ = _client_info(request)
    await audit(admin, "email_template_toggled", "email_template", key,
                new_value={"enabled": body.enabled}, ip=ip)
    return {"ok": True, "key": key, "enabled": body.enabled}


@control_email_router.get("/events")
async def list_events(user_id: Optional[str] = None, email: Optional[str] = None,
                      status: Optional[str] = None, template: Optional[str] = None,
                      page: int = 1, limit: int = 50,
                      admin: dict = Depends(require_perm("emails"))):
    f: dict = {}
    if user_id:
        f["user_id"] = user_id
    if email:
        f["to_email"] = {"$regex": email.strip().lower(), "$options": "i"}
    if status:
        f["status"] = status
    if template:
        f["template"] = template
    total = await db.email_events.count_documents(f)
    items = await (db.email_events.find(f, {"_id": 0})
                   .sort("created_at", -1).skip((page - 1) * limit).limit(limit).to_list(limit))
    return {"items": items, "total": total, "page": page, "limit": limit}


@control_email_router.get("/stats")
async def email_stats(admin: dict = Depends(require_perm("emails"))):
    counts = {}
    for st in ("sent", "failed", "queued"):
        counts[st] = await db.email_events.count_documents({"status": st})
    suppressions = await db.email_suppressions.count_documents({})
    bounces = await db.email_bounces.count_documents({})
    recent_failures = await (db.email_events.find({"status": "failed"}, {"_id": 0})
                             .sort("created_at", -1).limit(10).to_list(10))
    sched = await db.config.find_one({"key": "email_scheduler"}, {"_id": 0})
    return {"counts": counts, "suppressions": suppressions, "bounces": bounces,
            "recent_failures": recent_failures,
            "scheduler_last_run": (sched or {}).get("last_run")}


@control_email_router.post("/events/{event_id}/retry")
async def retry_event(event_id: str, request: Request, admin: dict = Depends(require_perm("emails"))):
    ev = await db.email_events.find_one({"id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed emails can be retried")
    if ev["template"] in NO_RETRY:
        raise HTTPException(status_code=400, detail="Security emails with one-time codes cannot be retried — the user must request a new one")
    user = await db.users.find_one({"id": ev["user_id"]}) if ev.get("user_id") else None
    res = await _svc.send(ev["template"], user=user, to_email=ev["to_email"],
                          ctx=ev.get("ctx") or {}, entity_id=ev.get("entity_id"),
                          force=True)
    await db.email_events.update_one({"id": event_id}, {"$set": {"retried_at": now_iso(), "retry_event_id": res.get("event_id")}})
    ip, _ = _client_info(request)
    await audit(admin, "email_retry", "email_event", event_id, new_value={"status": res["status"]}, ip=ip)
    return res


@control_email_router.get("/suppressions")
async def list_suppressions(admin: dict = Depends(require_perm("emails"))):
    items = await db.email_suppressions.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


@control_email_router.delete("/suppressions/{email}")
async def remove_suppression(email: str, request: Request, admin: dict = Depends(require_perm("emails"))):
    await db.email_suppressions.delete_one({"email": email.lower()})
    await db.email_bounces.delete_one({"email": email.lower()})
    ip, _ = _client_info(request)
    await audit(admin, "email_suppression_removed", "email", email.lower(), ip=ip)
    return {"ok": True}


# ------------------------------------------------ Resend webhook (bounces/complaints/delivery)
import base64
import hashlib
import hmac as _hmac
import os as _os

RESEND_WEBHOOK_SECRET = _os.environ.get("RESEND_WEBHOOK_SECRET", "")


def _verify_svix_signature(secret: str, raw_body: bytes, headers) -> bool:
    """Verify Resend (svix) webhook signature: HMAC-SHA256 of '{id}.{timestamp}.{body}'."""
    try:
        msg_id = headers.get("svix-id", "")
        timestamp = headers.get("svix-timestamp", "")
        signatures = headers.get("svix-signature", "")
        if not (msg_id and timestamp and signatures):
            return False
        key = base64.b64decode(secret.split("_", 1)[1] if secret.startswith("whsec_") else secret)
        signed = f"{msg_id}.{timestamp}.{raw_body.decode()}".encode()
        expected = base64.b64encode(_hmac.new(key, signed, hashlib.sha256).digest()).decode()
        return any(_hmac.compare_digest(expected, s.split(",", 1)[-1]) for s in signatures.split(" "))
    except Exception:  # noqa: BLE001
        return False


@resend_webhook_router.post("/resend")
async def resend_webhook(request: Request):
    """Resend event webhook. Handles delivered / bounced / complained.
    Configure in Resend dashboard → Webhooks; set RESEND_WEBHOOK_SECRET in backend/.env
    (whsec_...) to enforce signature verification."""
    raw = await request.body()
    if RESEND_WEBHOOK_SECRET and not _verify_svix_signature(RESEND_WEBHOOK_SECRET, raw, request.headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    import json as _json
    try:
        payload = _json.loads(raw or b"{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    etype = str(payload.get("type", ""))
    data = payload.get("data") or {}
    emails = data.get("to") or []
    if isinstance(emails, str):
        emails = [emails]
    resend_id = data.get("email_id") or data.get("id")
    if etype == "email.delivered" and resend_id:
        await db.email_events.update_one({"resend_id": resend_id},
                                         {"$set": {"delivery_status": "delivered", "delivered_at": now_iso()}})
    elif etype in ("email.bounced", "email.complained"):
        kind = "complained" if etype == "email.complained" else "bounced"
        reason = str((data.get("bounce") or {}).get("message", ""))[:200]
        for e in emails:
            await _svc.record_bounce(e, kind, reason)
        if resend_id:
            await db.email_events.update_one({"resend_id": resend_id},
                                             {"$set": {"delivery_status": kind, "failure_reason": reason or kind}})
    return {"ok": True}

"""INTRO Control Centre — Phase 3 modules.

Marketing, Content Management, Categories, Subscriptions & Payments (integration-ready,
provider-agnostic, NO fake LIVE financial data), Database Viewer, AI Insights
(provider-agnostic via Emergent LLM key), Backups, Exports, Act-As-User impersonation.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query, Response
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta
import asyncio
import io
import csv
import os
import uuid
import json

from control_center import (
    db, get_current_admin, require_perm, require_super_admin, get_mode, user_filter,
    uid_filter, audit, _check_recent_reauth, _client_info, now, now_iso, ROLE_PERMS,
)

control_p3_router = APIRouter(prefix="/api/control")
webhook_router = APIRouter(prefix="/api/webhooks")

for role, extra in {
    "operations": {"marketing", "content", "exports"},
    "marketing": {"marketing", "content", "exports"},
    "finance": {"payments", "exports"},
    "analytics": {"exports", "ai"},
    "support": {"content"},
}.items():
    ROLE_PERMS[role] = ROLE_PERMS[role] | extra
ROLE_PERMS["operations"] |= {"ai", "payments"}

DISCLAIMER = "AI-generated insights are advisory only and must not automatically trigger administrative actions."


class BannerIn(BaseModel):
    title: str
    message: str
    active: bool = True


class PromoIn(BaseModel):
    code: str
    discount_pct: int
    plan: str  # intro_plus | intro_professional | any
    max_uses: int = 100


class ReferralIn(BaseModel):
    name: str
    reward: str
    active: bool = True


class PageIn(BaseModel):
    body: str


class CategoryIn(BaseModel):
    name: str
    kind: str  # help | professional


class AiGenerateIn(BaseModel):
    report_type: str


class AiSettingsIn(BaseModel):
    enabled: bool
    provider: str = "emergent"
    model: str = "gpt-5.4"


# ============================ MARKETING ============================
@control_p3_router.get("/marketing")
async def get_marketing(admin: dict = Depends(require_perm("marketing")), mode: str = Depends(get_mode)):
    linked = await uid_filter(mode)
    banners = await db.marketing_banners.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    promos = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    referrals = await db.referral_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    feat_reqs = await db.help_requests.find({**linked, "featured": True}, {"_id": 0, "id": 1, "public_summary": 1, "category": 1}).to_list(20)
    feat_pros = await db.professional_profiles.find({**linked, "featured": True}, {"_id": 0, "user_id": 1, "profession": 1, "primary_category": 1}).to_list(20)
    names = {u["id"]: u.get("name") async for u in db.users.find({"id": {"$in": [p["user_id"] for p in feat_pros]}}, {"id": 1, "name": 1})}
    for p in feat_pros:
        p["name"] = names.get(p["user_id"])
    return {"banners": banners, "promo_codes": promos, "referral_campaigns": referrals,
            "featured_help_requests": feat_reqs, "featured_professionals": feat_pros,
            "note": "Promo codes and referral rewards activate once a payment provider is connected."}


@control_p3_router.post("/marketing/banners")
async def create_banner(body: BannerIn, request: Request, admin: dict = Depends(require_perm("marketing"))):
    doc = {"id": str(uuid.uuid4()), "title": body.title, "message": body.message, "active": body.active,
           "created_by": admin["email"], "created_at": now_iso()}
    await db.marketing_banners.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "banner_created", "banner", doc["id"], new_value={"title": body.title}, ip=ip)
    return {"ok": True, "banner": doc}


@control_p3_router.post("/marketing/promo-codes")
async def create_promo(body: PromoIn, request: Request, admin: dict = Depends(require_perm("marketing"))):
    code = body.code.strip().upper()
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Code already exists")
    doc = {"id": str(uuid.uuid4()), "code": code, "discount_pct": max(1, min(100, body.discount_pct)),
           "plan": body.plan, "max_uses": body.max_uses, "uses": 0, "active": True,
           "created_by": admin["email"], "created_at": now_iso()}
    await db.promo_codes.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "promo_code_created", "promo_code", code, new_value={"discount_pct": doc["discount_pct"], "plan": body.plan}, ip=ip)
    return {"ok": True, "promo": doc}


@control_p3_router.post("/marketing/referrals")
async def create_referral(body: ReferralIn, request: Request, admin: dict = Depends(require_perm("marketing"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "reward": body.reward, "active": body.active,
           "signups": 0, "created_by": admin["email"], "created_at": now_iso()}
    await db.referral_campaigns.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "referral_campaign_created", "referral", doc["id"], new_value={"name": body.name}, ip=ip)
    return {"ok": True, "campaign": doc}


@control_p3_router.post("/marketing/{kind}/{item_id}/toggle")
async def toggle_marketing(kind: str, item_id: str, request: Request, admin: dict = Depends(require_perm("marketing"))):
    coll = {"banners": "marketing_banners", "promo-codes": "promo_codes", "referrals": "referral_campaigns"}.get(kind)
    if not coll:
        raise HTTPException(status_code=400, detail="Invalid kind")
    doc = await db[coll].find_one({"id": item_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    await db[coll].update_one({"id": item_id}, {"$set": {"active": not doc.get("active", True)}})
    ip, _ = _client_info(request)
    await audit(admin, f"{kind}_toggled", kind, item_id, old_value={"active": doc.get("active")}, new_value={"active": not doc.get("active", True)}, ip=ip)
    return {"ok": True, "active": not doc.get("active", True)}


@control_p3_router.post("/marketing/feature-professional/{user_id}")
async def feature_professional(user_id: str, request: Request, admin: dict = Depends(require_perm("marketing"))):
    p = await db.professional_profiles.find_one({"user_id": user_id})
    if not p:
        raise HTTPException(status_code=404, detail="Professional not found")
    new_val = not p.get("featured", False)
    await db.professional_profiles.update_one({"user_id": user_id}, {"$set": {"featured": new_val}})
    ip, _ = _client_info(request)
    await audit(admin, "professional_featured" if new_val else "professional_unfeatured", "professional", user_id, ip=ip)
    return {"ok": True, "featured": new_val}


# ============================ CONTENT MANAGEMENT ============================
PAGE_DEFS = [
    {"key": "community_guidelines", "title": "Community Guidelines"},
    {"key": "privacy_policy", "title": "Privacy Policy"},
    {"key": "terms", "title": "Terms of Service"},
    {"key": "faq", "title": "FAQ"},
    {"key": "support_articles", "title": "Support Articles"},
]


@control_p3_router.get("/content/pages")
async def get_pages(admin: dict = Depends(require_perm("content"))):
    stored = {p["key"]: p async for p in db.content_pages.find({})}
    return {"items": [{**d, "body": stored.get(d["key"], {}).get("body", ""),
                       "updated_by": stored.get(d["key"], {}).get("updated_by"),
                       "updated_at": stored.get(d["key"], {}).get("updated_at")} for d in PAGE_DEFS]}


@control_p3_router.put("/content/pages/{key}")
async def update_page(key: str, body: PageIn, request: Request, admin: dict = Depends(require_perm("content"))):
    if key not in {d["key"] for d in PAGE_DEFS}:
        raise HTTPException(status_code=400, detail="Unknown page")
    old = await db.content_pages.find_one({"key": key})
    await db.content_pages.update_one({"key": key}, {"$set": {"key": key, "body": body.body, "updated_by": admin["email"], "updated_at": now_iso()}}, upsert=True)
    ip, _ = _client_info(request)
    await audit(admin, "content_page_updated", "content_page", key,
                old_value={"length": len((old or {}).get("body", ""))}, new_value={"length": len(body.body)}, ip=ip)
    return {"ok": True}


# ============================ CATEGORIES ============================
@control_p3_router.get("/categories")
async def get_categories(admin: dict = Depends(require_perm("content")), mode: str = Depends(get_mode)):
    from server import PRO_CATEGORIES, PROFESSIONS  # lazy import (server loads this module)
    linked = await uid_filter(mode)
    usage = {r["_id"]: r["count"] for r in await db.help_requests.aggregate([
        {"$match": linked}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}]).to_list(100)}
    pro_usage = {r["_id"]: r["count"] for r in await db.professional_profiles.aggregate([
        {"$match": linked}, {"$group": {"_id": "$primary_category", "count": {"$sum": 1}}}]).to_list(100)}
    custom = await db.custom_categories.find({}, {"_id": 0}).to_list(100)
    return {
        "help_categories": [{"name": c, "usage": usage.get(c, 0), "builtin": True} for c in PRO_CATEGORIES],
        "professions": [{"name": p, "usage": pro_usage.get(p, 0), "builtin": True} for p in PROFESSIONS],
        "custom": custom,
        "note": "Built-in categories are enforced by the app. Custom categories are staged here and roll out with the next app release.",
    }


@control_p3_router.post("/categories")
async def add_category(body: CategoryIn, request: Request, admin: dict = Depends(require_perm("content"))):
    if body.kind not in ("help", "professional"):
        raise HTTPException(status_code=400, detail="Invalid kind")
    name = body.name.strip()
    if not name or await db.custom_categories.find_one({"name": name, "kind": body.kind}):
        raise HTTPException(status_code=400, detail="Category already exists or is empty")
    doc = {"id": str(uuid.uuid4()), "name": name, "kind": body.kind, "active": True,
           "created_by": admin["email"], "created_at": now_iso()}
    await db.custom_categories.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "category_created", "category", name, new_value={"kind": body.kind}, ip=ip)
    return {"ok": True, "category": doc}


# ============================ SUBSCRIPTIONS & PAYMENTS ============================
PLANS = [
    {"key": "free", "name": "Free", "price": None, "features": ["50m radius", "Core radar"]},
    {"key": "intro_plus", "name": "Intro Plus", "price": None, "features": ["100m radius", "Priority pings"]},
    {"key": "intro_professional", "name": "Intro Professional", "price": None, "features": ["500m radius", "Professional tools", "Verified badge priority"]},
]
WEBHOOK_EVENTS = ["subscription.created", "subscription.renewed", "subscription.upgraded", "subscription.downgraded",
                  "subscription.cancelled", "payment.succeeded", "payment.failed", "refund.issued", "trial.started", "trial.ended"]


async def _seed_demo_billing():
    if await db.demo_subscriptions.count_documents({}) > 0:
        return
    demo_users = await db.users.find({"is_demo": True}, {"id": 1, "name": 1, "email": 1}).to_list(12)
    plans = ["intro_plus", "intro_professional"]
    statuses = ["active", "active", "active", "trialing", "past_due", "cancelled"]
    for i, u in enumerate(demo_users[:10]):
        plan = plans[i % 2]
        status = statuses[i % len(statuses)]
        start = (now() - timedelta(days=30 + i * 9)).isoformat()
        sub_id = str(uuid.uuid4())
        await db.demo_subscriptions.insert_one({
            "id": sub_id, "is_demo_data": True, "user_id": u["id"], "customer": u.get("name"), "email": u.get("email"),
            "plan": plan, "status": status, "billing_period": "monthly",
            "trial": status == "trialing", "started_at": start,
            "renews_at": (now() + timedelta(days=(i * 3) % 28 + 1)).isoformat() if status in ("active", "trialing") else None,
            "cancelled_at": now_iso() if status == "cancelled" else None,
            "provider_ref": f"demo_sub_{i:03d}",
        })
        amount = 9.99 if plan == "intro_plus" else 24.99
        for m in range(2):
            ok = not (status == "past_due" and m == 1)
            await db.demo_payments.insert_one({
                "id": str(uuid.uuid4()), "is_demo_data": True, "subscription_id": sub_id, "customer": u.get("name"),
                "plan": plan, "amount": amount, "currency": "AUD", "status": "succeeded" if ok else "failed",
                "invoice_no": f"DEMO-INV-{i:03d}-{m}", "provider_ref": f"demo_pay_{i:03d}_{m}",
                "created_at": (now() - timedelta(days=30 * (2 - m) - i)).isoformat(),
                "refunded": i == 2 and m == 0,
            })


@control_p3_router.get("/billing/overview")
async def billing_overview(admin: dict = Depends(require_perm("payments")), mode: str = Depends(get_mode)):
    if mode == "live":
        return {"configured": False, "mode": "live", "provider": None, "plans": PLANS,
                "message": "Payment integration not configured. No revenue, transactions or subscription data exists in LIVE mode. Connect Stripe, RevenueCat or another provider to activate this module.",
                "kpis": {"active_subscriptions": None, "mrr": None, "failed_payments": None, "refunds": None},
                "subscriptions": [], "payments": [], "actions_enabled": False}
    await _seed_demo_billing()
    subs = await db.demo_subscriptions.find({}, {"_id": 0}).sort("started_at", -1).to_list(50)
    pays = await db.demo_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    mrr = sum(9.99 if s["plan"] == "intro_plus" else 24.99 for s in subs if s["status"] in ("active", "trialing"))
    return {"configured": False, "mode": "demo", "provider": "demo-sandbox (seeded data)", "plans": PLANS,
            "message": "DEMO DATA — clearly-labelled seeded billing records for interface testing. Isolated from production; no real money moves.",
            "kpis": {"active_subscriptions": sum(1 for s in subs if s["status"] in ("active", "trialing")),
                     "mrr": round(mrr, 2), "failed_payments": sum(1 for p in pays if p["status"] == "failed"),
                     "refunds": sum(1 for p in pays if p.get("refunded"))},
            "subscriptions": subs, "payments": pays, "actions_enabled": True}


@control_p3_router.post("/billing/payments/{payment_id}/refund")
async def refund_payment(payment_id: str, request: Request, admin: dict = Depends(require_perm("payments")), mode: str = Depends(get_mode)):
    if mode == "live":
        raise HTTPException(status_code=400, detail="Payment integration not configured — refunds are disabled until a provider is connected")
    p = await db.demo_payments.find_one({"id": payment_id})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.demo_payments.update_one({"id": payment_id}, {"$set": {"refunded": True}})
    ip, _ = _client_info(request)
    await audit(admin, "demo_refund_issued", "payment", payment_id, new_value={"is_demo_data": True}, ip=ip, mode=mode)
    return {"ok": True, "note": "Demo refund recorded (no real money moved)"}


@control_p3_router.get("/billing/integration")
async def billing_integration(admin: dict = Depends(require_perm("payments"))):
    last_wh = await db.payment_webhook_events.find_one({}, {"_id": 0}, sort=[("received_at", -1)])
    return {
        "provider": {"name": None, "status": "not_configured", "environment": None},
        "webhook": {"url": "/api/webhooks/payments", "status": "listening (no provider configured)",
                    "last_received": last_wh.get("received_at") if last_wh else None,
                    "supported_events": WEBHOOK_EVENTS},
        "last_successful_sync": None,
        "configuration_errors": ["No payment provider connected. The integration layer is provider-agnostic — Stripe, RevenueCat or others can be attached without rebuilding this module."],
        "security": "Card details, security codes and payment credentials are never stored in the INTRO database. The provider remains the financial source of truth; INTRO stores only references and synced status.",
    }


@webhook_router.post("/payments")
async def payments_webhook(request: Request):
    """Provider-agnostic webhook scaffold. Events are logged but ignored until a provider is configured."""
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    await db.payment_webhook_events.insert_one({
        "id": str(uuid.uuid4()), "received_at": now_iso(),
        "event_type": payload.get("type") or payload.get("event") or "unknown",
        "status": "ignored — no payment provider configured", "raw_keys": list(payload.keys())[:20],
    })
    return {"received": True, "processed": False, "reason": "no payment provider configured"}


# ============================ DATABASE VIEWER ============================
DB_WHITELIST = ["users", "professional_profiles", "verification_submissions", "help_requests", "pings",
                "matches", "reports", "notifications", "blocks", "meetups", "feedback", "admin_audit_logs",
                "admin_notifications", "feature_flags", "app_config", "demo_subscriptions", "demo_payments"]
REDACT = {"hashed_password", "file_base64"}


def _redact(doc):
    doc.pop("_id", None)
    for k in list(doc.keys()):
        if k in REDACT:
            doc[k] = "•••redacted•••"
    return doc


@control_p3_router.get("/db/collections")
async def db_collections(admin: dict = Depends(require_super_admin())):
    return {"items": [{"name": c, "count": await db[c].count_documents({})} for c in DB_WHITELIST]}


@control_p3_router.get("/db/{coll}")
async def db_browse(coll: str, request: Request, q: Optional[str] = None,
                    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=50),
                    admin: dict = Depends(require_super_admin())):
    if coll not in DB_WHITELIST:
        raise HTTPException(status_code=400, detail="Collection not browsable")
    f: dict = {}
    if q:
        f = {"$or": [{k: {"$regex": q, "$options": "i"}} for k in ("id", "email", "name", "user_id", "status", "category")]}
    total = await db[coll].count_documents(f)
    rows = [_redact(r) for r in await db[coll].find(f).sort("_id", -1).skip((page - 1) * limit).limit(limit).to_list(limit)]
    ip, _ = _client_info(request)
    await audit(admin, "db_viewed", "db_collection", coll, new_value={"page": page, "q": q}, ip=ip)
    return {"total": total, "page": page, "limit": limit, "items": rows, "read_only": True}


# ============================ AI INSIGHTS ============================
AI_REPORT_TYPES = [
    {"key": "daily_summary", "label": "Daily Platform Summary"},
    {"key": "weekly_executive", "label": "Weekly Executive Summary"},
    {"key": "monthly_report", "label": "Monthly Executive Report"},
    {"key": "growth", "label": "User Growth Insights"},
    {"key": "retention", "label": "Retention Analysis"},
    {"key": "professional_growth", "label": "Professional Growth"},
    {"key": "help_request_trends", "label": "Help Request Trends"},
    {"key": "connections", "label": "Connection Trends"},
    {"key": "moderation", "label": "Report & Moderation Trends"},
    {"key": "credential_expiry", "label": "Credential Expiry Warnings"},
    {"key": "system_health", "label": "System Health Summary"},
    {"key": "risks", "label": "Potential Platform Risks"},
    {"key": "anomaly_detection", "label": "Anomaly Detection"},
]


async def _ai_settings():
    s = await db.ai_settings.find_one({}, {"_id": 0})
    return s or {"enabled": True, "provider": "emergent", "model": "gpt-5.4"}


async def _gather_metrics(mode: str) -> dict:
    uf = user_filter(mode)
    linked = await uid_filter(mode)
    today = now().date().isoformat()
    d7, d30 = (now() - timedelta(days=7)).isoformat(), (now() - timedelta(days=30)).isoformat()
    return {
        "generated_at": now_iso(), "mode": mode,
        "total_users": await db.users.count_documents(uf),
        "new_users_7d": await db.users.count_documents({**uf, "created_at": {"$gte": d7}}),
        "new_users_30d": await db.users.count_documents({**uf, "created_at": {"$gte": d30}}),
        "dau": await db.users.count_documents({**uf, "last_active": {"$gte": today}}),
        "wau": await db.users.count_documents({**uf, "last_active": {"$gte": d7}}),
        "mau": await db.users.count_documents({**uf, "last_active": {"$gte": d30}}),
        "professionals": await db.professional_profiles.count_documents({**linked, "is_draft": {"$ne": True}}),
        "verified_professionals": len(await db.verification_submissions.distinct("user_id", {**linked, "status": "Approved"})),
        "pending_verifications": await db.verification_submissions.count_documents({**linked, "status": "Pending"}),
        "expired_credentials": await db.verification_submissions.count_documents({**linked, "status": "Expired"}),
        "active_help_requests": await db.help_requests.count_documents({**linked, "status": "active"}),
        "help_requests_30d": await db.help_requests.count_documents({**linked, "created_at": {"$gte": d30}}),
        "connections_30d": await db.matches.count_documents({**(await uid_filter(mode, "user_a")), "created_at": {"$gte": d30}}),
        "pings_30d": await db.pings.count_documents({**(await uid_filter(mode, "from_user_id")), "created_at": {"$gte": d30}}),
        "pending_reports": await db.reports.count_documents({**(await uid_filter(mode, "reporter_id")), "status": {"$in": [None, "pending", "open"]}}),
        "reports_7d": await db.reports.count_documents({**(await uid_filter(mode, "reporter_id")), "created_at": {"$gte": d7}}),
        "failed_admin_logins_24h": await db.admin_login_audit.count_documents({"success": False, "at": {"$gte": (now() - timedelta(hours=24)).isoformat()}}),
        "top_help_categories": [{"category": r["_id"], "count": r["count"]} for r in await db.help_requests.aggregate([{"$match": linked}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]).to_list(5)],
        "top_cities": [{"city": r["_id"], "count": r["count"]} for r in await db.users.aggregate([{"$match": uf}, {"$group": {"_id": "$city", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]).to_list(5)],
        "payments": "not configured — no financial data",
    }


async def _run_ai(report_label: str, metrics: dict, settings: dict) -> str:
    """Provider-agnostic AI call. Currently backed by the Emergent universal key; the
    provider/model come from stored settings so it can be switched via configuration."""
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI not configured")
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    provider = "openai" if settings.get("provider") in ("emergent", "openai") else settings.get("provider")
    chat = LlmChat(
        api_key=key, session_id=f"cc-insights-{uuid.uuid4()}",
        system_message=("You are the analytics director for INTRO, a proximity-based social + professional networking app. "
                        "Write concise, plain-English admin reports in markdown with short sections, bullet insights and 2-4 "
                        "actionable recommendations. Flag anomalies (spikes in reports, failed logins, verification failures). "
                        "Never invent numbers not present in the data. If payments are not configured, say so instead of estimating revenue."),
    ).with_model(provider, settings.get("model", "gpt-5.4"))
    prompt = f"Generate the report: {report_label}.\n\nCurrent platform metrics (JSON):\n{json.dumps(metrics, indent=2)}"
    out = []
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            out.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(out).strip()


@control_p3_router.get("/ai/insights")
async def list_ai_insights(admin: dict = Depends(require_perm("ai")), mode: str = Depends(get_mode)):
    settings = await _ai_settings()
    configured = bool(os.environ.get("EMERGENT_LLM_KEY")) and settings.get("enabled", True)
    reports = await db.ai_reports.find({"mode": mode}, {"_id": 0, "metrics_snapshot": 0}).sort("created_at", -1).to_list(30)
    return {"configured": configured, "settings": {k: settings.get(k) for k in ("enabled", "provider", "model")},
            "report_types": AI_REPORT_TYPES, "items": reports, "disclaimer": DISCLAIMER}


@control_p3_router.put("/ai/settings")
async def update_ai_settings(body: AiSettingsIn, request: Request, admin: dict = Depends(require_super_admin())):
    old = await _ai_settings()
    await db.ai_settings.update_one({}, {"$set": {"enabled": body.enabled, "provider": body.provider, "model": body.model, "updated_by": admin["email"], "updated_at": now_iso()}}, upsert=True)
    ip, _ = _client_info(request)
    await audit(admin, "ai_settings_updated", "ai_settings", "global", old_value=old and {k: old.get(k) for k in ("enabled", "provider", "model")}, new_value=body.dict(), ip=ip)
    return {"ok": True}


@control_p3_router.post("/ai/insights/generate")
async def generate_ai_insight(body: AiGenerateIn, request: Request, admin: dict = Depends(require_perm("ai")), mode: str = Depends(get_mode)):
    rt = next((r for r in AI_REPORT_TYPES if r["key"] == body.report_type), None)
    if not rt:
        raise HTTPException(status_code=400, detail="Unknown report type")
    settings = await _ai_settings()
    if not settings.get("enabled", True) or not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=503, detail="AI not configured — the Control Centre keeps working without it")
    metrics = await _gather_metrics(mode)
    content = await _run_ai(rt["label"], metrics, settings)
    doc = {"id": str(uuid.uuid4()), "type": rt["key"], "label": rt["label"], "mode": mode,
           "content": content, "metrics_snapshot": metrics, "model": settings.get("model"),
           "generated_by": admin["email"], "created_at": now_iso(), "disclaimer": DISCLAIMER}
    await db.ai_reports.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "ai_report_generated", "ai_report", doc["id"], new_value={"type": rt["key"]}, ip=ip, mode=mode)
    doc.pop("metrics_snapshot", None)
    return {"ok": True, "report": doc}


@control_p3_router.get("/ai/insights/{report_id}/export")
async def export_ai_insight(report_id: str, format: str = "pdf", admin: dict = Depends(require_perm("ai"))):
    r = await db.ai_reports.find_one({"id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    if format == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["metric", "value"])
        for k, v in (r.get("metrics_snapshot") or {}).items():
            w.writerow([k, json.dumps(v) if isinstance(v, (list, dict)) else v])
        return Response(content=buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f"attachment; filename=ai-report-{report_id[:8]}.csv"})
    pdf = _make_pdf(f"INTRO AI Insight — {r['label']}", r["content"] + f"\n\n---\n{r['disclaimer']}\nGenerated {r['created_at']} by {r['generated_by']} ({r['mode']} mode)")
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=ai-report-{report_id[:8]}.pdf"})


# ============================ EXPORTS ============================
def _make_pdf(title: str, text: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
    for line in text.split("\n"):
        safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(safe or " ", styles["BodyText"]))
    doc.build(story)
    return buf.getvalue()


def _rows_to_file(rows: list, columns: list, name: str, format: str) -> Response:
    if format == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(columns)
        for r in rows:
            ws.append([str(r.get(c, "")) for c in columns])
        buf = io.BytesIO()
        wb.save(buf)
        return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f"attachment; filename={name}.xlsx"})
    if format == "pdf":
        text = "\n".join(" | ".join(str(r.get(c, "")) for c in columns) for r in rows[:200])
        return Response(content=_make_pdf(f"INTRO Export — {name}", " | ".join(columns) + "\n" + text), media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename={name}.pdf"})
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(columns)
    for r in rows:
        w.writerow([r.get(c, "") for c in columns])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={name}.csv"})


EXPORT_ENTITIES = ["users", "professionals", "reports", "analytics", "revenue", "subscriptions"]


@control_p3_router.get("/exports/{entity}")
async def export_entity(entity: str, request: Request, format: str = "csv",
                        admin: dict = Depends(require_perm("exports")), mode: str = Depends(get_mode)):
    if entity not in EXPORT_ENTITIES:
        raise HTTPException(status_code=400, detail="Unknown export")
    uf = user_filter(mode)
    linked = await uid_filter(mode)
    if entity == "users":
        rows = await db.users.find(uf, {"_id": 0, "hashed_password": 0}).to_list(5000)
        cols = ["id", "name", "email", "age", "city", "country", "plan", "app_mode", "verified", "admin_status", "created_at", "last_active"]
    elif entity == "professionals":
        rows = await db.professional_profiles.find({**linked, "is_draft": {"$ne": True}}, {"_id": 0}).to_list(5000)
        cols = ["user_id", "profession", "primary_category", "years_experience", "availability", "featured", "created_at"]
    elif entity == "reports":
        rows = await db.reports.find(await uid_filter(mode, "reporter_id"), {"_id": 0}).to_list(5000)
        cols = ["id", "reporter_id", "user_id", "reason", "details", "status", "action_taken", "created_at"]
    elif entity == "analytics":
        m = await _gather_metrics(mode)
        rows = [{"metric": k, "value": json.dumps(v) if isinstance(v, (list, dict)) else v} for k, v in m.items()]
        cols = ["metric", "value"]
    elif entity in ("revenue", "subscriptions"):
        if mode == "live":
            rows = [{"note": "Payment integration not configured — no financial data exists in LIVE mode"}]
            cols = ["note"]
        else:
            await _seed_demo_billing()
            coll = "demo_payments" if entity == "revenue" else "demo_subscriptions"
            rows = await db[coll].find({}, {"_id": 0}).to_list(1000)
            cols = ["id", "is_demo_data", "customer", "plan", "amount", "currency", "status", "invoice_no", "refunded", "created_at"] if entity == "revenue" else \
                   ["id", "is_demo_data", "customer", "email", "plan", "status", "billing_period", "trial", "started_at", "renews_at", "provider_ref"]
    ip, _ = _client_info(request)
    await audit(admin, "export_generated", "export", entity, new_value={"format": format, "rows": len(rows)}, ip=ip, mode=mode)
    return _rows_to_file(rows, cols, f"intro-{entity}-{mode}", format)


# ============================ BACKUPS ============================
BACKUP_DIR = "/app/backups"


@control_p3_router.get("/backups")
async def list_backups(admin: dict = Depends(require_super_admin())):
    logs = await db.backup_logs.find({}, {"_id": 0}).sort("started_at", -1).to_list(30)
    return {"items": logs, "backup_dir": BACKUP_DIR,
            "note": "Backups run mongodump against the live database into local storage. Download important backups off-box for true disaster recovery."}


@control_p3_router.post("/backups/run")
async def run_backup(request: Request, admin: dict = Depends(require_super_admin())):
    ts = now().strftime("%Y%m%d-%H%M%S")
    path = f"{BACKUP_DIR}/{ts}"
    os.makedirs(path, exist_ok=True)
    log_id = str(uuid.uuid4())
    proc = await asyncio.create_subprocess_exec(
        "mongodump", "--uri", os.environ["MONGO_URL"], "--db", os.environ["DB_NAME"], "--out", path,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fns in os.walk(path) for f in fns)
    doc = {"id": log_id, "path": path, "status": "completed" if proc.returncode == 0 else "failed",
           "size_mb": round(size / 1e6, 2), "log": (err or b"").decode()[-2000:],
           "started_at": now_iso(), "by": admin["email"]}
    await db.backup_logs.insert_one(dict(doc))
    ip, _ = _client_info(request)
    await audit(admin, "backup_run", "backup", log_id, new_value={"status": doc["status"], "size_mb": doc["size_mb"]}, ip=ip)
    doc.pop("log", None)
    return {"ok": proc.returncode == 0, "backup": doc}


@control_p3_router.get("/backups/{backup_id}/log")
async def backup_log(backup_id: str, admin: dict = Depends(require_super_admin())):
    b = await db.backup_logs.find_one({"id": backup_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Backup not found")
    return Response(content=f"INTRO backup {backup_id}\nstatus: {b['status']}\npath: {b['path']}\n\n{b.get('log', '')}",
                    media_type="text/plain", headers={"Content-Disposition": f"attachment; filename=backup-{backup_id[:8]}.log"})


@control_p3_router.post("/backups/{backup_id}/restore")
async def restore_backup(backup_id: str, request: Request, admin: dict = Depends(require_super_admin())):
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    _check_recent_reauth(fresh)
    b = await db.backup_logs.find_one({"id": backup_id})
    if not b or b.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Backup not found or incomplete")
    proc = await asyncio.create_subprocess_exec(
        "mongorestore", "--uri", os.environ["MONGO_URL"], "--nsInclude", f"{os.environ['DB_NAME']}.*",
        "--drop", b["path"], stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, err = await proc.communicate()
    ip, _ = _client_info(request)
    await audit(admin, "backup_restored", "backup", backup_id, new_value={"ok": proc.returncode == 0}, ip=ip)
    if proc.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Restore failed: {(err or b'').decode()[-300:]}")
    return {"ok": True, "note": "Database restored from backup. All data now reflects the backup snapshot."}


# ============================ ACT AS USER ============================
@control_p3_router.post("/users/{user_id}/impersonate")
async def impersonate_user(user_id: str, request: Request, admin: dict = Depends(require_super_admin()), mode: str = Depends(get_mode)):
    fresh = await db.admin_users.find_one({"id": admin["id"]})
    _check_recent_reauth(fresh)
    u = await db.users.find_one({"id": user_id}, {"hashed_password": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    from server import JWT_SECRET, JWT_ALGO  # lazy import
    import jwt as pyjwt
    token = pyjwt.encode({
        "sub": user_id, "imp": admin["email"],
        "exp": now() + timedelta(minutes=30), "iat": now(),
    }, JWT_SECRET, algorithm=JWT_ALGO)
    ip, _ = _client_info(request)
    await db.impersonation_logs.insert_one({
        "id": str(uuid.uuid4()), "admin_email": admin["email"], "user_id": user_id,
        "user_name": u.get("name"), "started_at": now_iso(), "ip": ip, "expires_minutes": 30})
    await audit(admin, "impersonation_started", "user", user_id, new_value={"user_name": u.get("name"), "expires_minutes": 30}, ip=ip, mode=mode)
    return {"ok": True, "token": token, "expires_minutes": 30,
            "user": {"id": u["id"], "name": u.get("name"), "email": u.get("email"), "photo_url": u.get("photo_url")},
            "restrictions": ["Password changes blocked", "Payment changes blocked", "Subscription changes blocked", "Account deletion blocked", "Every impersonation is logged"]}


@control_p3_router.post("/impersonate/exit")
async def exit_impersonation(request: Request, admin: dict = Depends(require_super_admin())):
    ip, _ = _client_info(request)
    await audit(admin, "impersonation_ended", "user", None, ip=ip)
    return {"ok": True}

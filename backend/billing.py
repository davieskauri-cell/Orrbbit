"""Orrbbit billing & subscription entitlements (bind pattern).

BILLING_MODE (server-controlled env, never trusted from the client):
  disabled — no purchases possible anywhere (production default until stores are ready)
  sandbox  — clearly-labelled TEST purchases for demo accounts / authorised testers only
  native   — real Apple/Google billing (requires store products + receipt verification; NOT configured yet)

The backend entitlement record is the single source of truth for plan + max radius.
Native billing SDKs plug into the same interface later: fetch products, start purchase,
verify purchase, restore, refresh entitlement, cancellation/expiration/grace/billing-retry.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

billing_router = APIRouter(prefix="/api")

BILLING_MODE = os.environ.get("BILLING_MODE", "disabled").lower()
TEST_MODE_CODE = os.environ.get("TEST_MODE_CODE", "")

PRODUCTS = {
    "plus": {
        "plan": "plus",
        "title": "Orrbbit Plus",
        "ios_product_id": "com.orrbbit.mobile.plus.monthly",
        "android_product_id": "orrbbit_plus_monthly",
        "preview_price": "$6.99",
        "period": "month",
        "max_radius_m": 500,
    },
    "pro": {
        "plan": "pro",
        "title": "Orrbbit Pro",
        "ios_product_id": "com.orrbbit.mobile.pro.monthly",
        "android_product_id": "orrbbit_pro_monthly",
        "preview_price": "$11.99",
        "period": "month",
        "max_radius_m": 1000,
    },
}

SUCCESS_MESSAGES = {
    "plus": "Welcome to Orrbbit Plus. Your Radar now reaches up to 500 m.",
    "pro": "Welcome to Orrbbit Pro. Your Radar now reaches up to 1 km.",
}


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


class SandboxPurchaseIn(BaseModel):
    plan: str
    platform: Optional[str] = None
    test_code: Optional[str] = None


class SandboxCancelIn(BaseModel):
    test_code: Optional[str] = None


class VerifyIn(BaseModel):
    platform: str
    receipt: str


class PlanInterestIn(BaseModel):
    plan: str


def bind(server):
    db = server.db
    get_current_user = server.get_current_user
    PLAN_LIMITS = server.PLAN_LIMITS

    def _sandbox_allowed(user: dict, test_code: Optional[str]) -> bool:
        """Server-side gate: sandbox purchases only for demo accounts or authorised testers.
        A frontend flag alone can never unlock this."""
        if BILLING_MODE != "sandbox":
            return False
        if user.get("is_demo"):
            return True
        if TEST_MODE_CODE and test_code and test_code == TEST_MODE_CODE:
            return True
        return False

    async def _clamp_radius(user_id: str, plan: str, notify_reduced: bool = True):
        u = await db.users.find_one({"id": user_id})
        cap = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["max_radius"]
        cur = int(u.get("radius", 250) or 250)
        if cur > cap:
            update = {"radius": cap}
            if notify_reduced:
                update["radius_migration_notice"] = True
            await db.users.update_one({"id": user_id}, {"$set": update})

    async def _apply_entitlement(user: dict, plan: str, platform: str, sandbox: bool,
                                 product_id: str, status: str = "active"):
        """Append-style upsert: one active entitlement per user; previous marked superseded."""
        now = _now()
        await db.entitlements.update_many(
            {"user_id": user["id"], "entitlement_status": "active"},
            {"$set": {"entitlement_status": "superseded", "updated_at": _iso(now)}})
        rec = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "plan": plan,
            "entitlement_status": status,
            "product_id": product_id,
            "platform": platform or "unknown",
            "sandbox": sandbox,
            "original_transaction_id": f"SANDBOX-{uuid.uuid4()}" if sandbox else None,
            "purchase_token_ref": None,  # secure store reference only — never raw receipts
            "purchase_date": _iso(now),
            "renewal_date": _iso(now + timedelta(days=30)),
            "expiration_date": _iso(now + timedelta(days=30)),
            "auto_renew_status": True,
            "cancellation_date": None,
            "grace_period_status": None,
            "billing_retry_status": None,
            "last_verified_at": _iso(now),
            "updated_at": _iso(now),
        }
        await db.entitlements.insert_one(rec)
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan": plan}})
        await _clamp_radius(user["id"], plan, notify_reduced=False)
        rec.pop("_id", None)
        return rec

    async def _active_entitlement(user_id: str):
        rec = await db.entitlements.find_one(
            {"user_id": user_id, "entitlement_status": "active"}, {"_id": 0})
        if rec and rec.get("expiration_date") and rec["expiration_date"] < _iso(_now()) and not rec.get("auto_renew_status"):
            # expired — revert to free
            await db.entitlements.update_one({"id": rec["id"]}, {"$set": {"entitlement_status": "expired", "updated_at": _iso(_now())}})
            await db.users.update_one({"id": user_id}, {"$set": {"plan": "free"}})
            await _clamp_radius(user_id, "free")
            return None
        return rec

    # ---------------- public config / status ----------------
    @billing_router.get("/billing/config")
    async def billing_config(user: dict = Depends(get_current_user)):
        return {
            "billing_mode": BILLING_MODE,
            "purchases_available": BILLING_MODE in ("sandbox", "native"),
            "sandbox_eligible": BILLING_MODE == "sandbox" and bool(user.get("is_demo")),
            "products": list(PRODUCTS.values()),
        }

    @billing_router.get("/users/me/subscription")
    async def my_subscription(user: dict = Depends(get_current_user)):
        ent = await _active_entitlement(user["id"])
        u = await db.users.find_one({"id": user["id"]})
        plan = u.get("plan", "free")
        return {
            "plan": plan,
            "max_radius_m": PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["max_radius"],
            "radius_options": PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["radius_options"],
            "billing_mode": BILLING_MODE,
            "entitlement": ent and {
                "plan": ent["plan"], "entitlement_status": ent["entitlement_status"],
                "product_id": ent["product_id"], "platform": ent["platform"],
                "sandbox": ent.get("sandbox", False),
                "purchase_date": ent["purchase_date"], "renewal_date": ent["renewal_date"],
                "auto_renew_status": ent["auto_renew_status"],
                "cancellation_date": ent["cancellation_date"],
            },
        }

    @billing_router.post("/users/me/radius-notice-seen")
    async def radius_notice_seen(user: dict = Depends(get_current_user)):
        await db.users.update_one({"id": user["id"]}, {"$unset": {"radius_migration_notice": ""}})
        return {"ok": True}

    # ---------------- pre-launch plan interest (privacy-safe, no marketing opt-in) ----------------
    @billing_router.post("/billing/interest")
    async def plan_interest(body: PlanInterestIn, user: dict = Depends(get_current_user)):
        plan = (body.plan or "").lower()
        if plan not in ("plus", "pro"):
            raise HTTPException(status_code=400, detail="Unknown plan")
        now = _iso(_now())
        await db.plan_interest.update_one(
            {"user_id": user["id"], "plan": plan},
            {"$setOnInsert": {"user_id": user["id"], "plan": plan, "created_at": now},
             "$set": {"updated_at": now}},
            upsert=True,
        )
        return {"ok": True, "message": "We'll let you know when subscriptions are available."}

    # ---------------- sandbox (test) purchases ----------------
    @billing_router.post("/billing/sandbox/purchase")
    async def sandbox_purchase(body: SandboxPurchaseIn, user: dict = Depends(get_current_user)):
        if BILLING_MODE == "disabled":
            raise HTTPException(status_code=403, detail="Paid subscriptions aren't available yet")
        if BILLING_MODE == "native":
            raise HTTPException(status_code=400, detail="Use the store purchase flow")
        if not _sandbox_allowed(user, body.test_code):
            raise HTTPException(status_code=403, detail="Paid subscriptions aren't available yet")
        plan = (body.plan or "").lower()
        if plan not in PRODUCTS:
            raise HTTPException(status_code=400, detail="Unknown plan")
        product = PRODUCTS[plan]
        product_id = product["ios_product_id"] if body.platform == "ios" else product["android_product_id"]
        rec = await _apply_entitlement(user, plan, body.platform or "sandbox", sandbox=True,
                                       product_id=product_id)
        # No purchase emails for sandbox/test purchases; no production revenue records.
        return {"ok": True, "sandbox": True, "message": SUCCESS_MESSAGES[plan], "entitlement": rec}

    @billing_router.post("/billing/sandbox/cancel")
    async def sandbox_cancel(body: SandboxCancelIn, user: dict = Depends(get_current_user)):
        if not _sandbox_allowed(user, body.test_code):
            raise HTTPException(status_code=403, detail="Not available")
        rec = await db.entitlements.find_one({"user_id": user["id"], "entitlement_status": "active"})
        if not rec:
            raise HTTPException(status_code=404, detail="No active subscription")
        await db.entitlements.update_one({"id": rec["id"]}, {"$set": {
            "auto_renew_status": False, "cancellation_date": _iso(_now()), "updated_at": _iso(_now())}})
        return {"ok": True, "message": "Auto-renew turned off. Your plan stays active until the end of the period."}

    @billing_router.post("/billing/sandbox/expire")
    async def sandbox_expire(body: SandboxCancelIn, user: dict = Depends(get_current_user)):
        """Test helper: simulate subscription expiration → revert to Free, clamp radius."""
        if not _sandbox_allowed(user, body.test_code):
            raise HTTPException(status_code=403, detail="Not available")
        await db.entitlements.update_many(
            {"user_id": user["id"], "entitlement_status": "active"},
            {"$set": {"entitlement_status": "expired", "auto_renew_status": False,
                      "expiration_date": _iso(_now()), "updated_at": _iso(_now())}})
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan": "free"}})
        await _clamp_radius(user["id"], "free")
        return {"ok": True, "plan": "free", "message": "Subscription expired — you're on Orrbbit Free (up to 250 m)."}

    # ---------------- restore / native verification interface ----------------
    @billing_router.post("/billing/restore")
    async def restore_purchases(user: dict = Depends(get_current_user)):
        if BILLING_MODE == "native":
            raise HTTPException(status_code=501, detail="Native store verification not configured yet")
        # Sandbox restore: re-activate latest non-superseded sandbox entitlement if still in period
        rec = await db.entitlements.find_one(
            {"user_id": user["id"], "sandbox": True,
             "entitlement_status": {"$in": ["active", "superseded"]},
             "expiration_date": {"$gt": _iso(_now())}},
            sort=[("purchase_date", -1)])
        if not rec:
            return {"ok": True, "restored": False, "message": "No previous purchases found for this account."}
        await db.entitlements.update_one({"id": rec["id"]}, {"$set": {
            "entitlement_status": "active", "last_verified_at": _iso(_now()), "updated_at": _iso(_now())}})
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan": rec["plan"]}})
        return {"ok": True, "restored": True, "plan": rec["plan"],
                "message": f"Your {PRODUCTS[rec['plan']]['title']} subscription was restored."}

    @billing_router.post("/billing/verify")
    async def verify_purchase(body: VerifyIn, user: dict = Depends(get_current_user)):
        """Native receipt verification endpoint — wired when Apple/Google billing is configured."""
        raise HTTPException(status_code=501, detail="Native billing is not configured yet")

    # ---------------- admin: billing mode + demo entitlement preview ----------------
    import control_center as _cc
    get_current_admin = _cc.get_current_admin

    class AdminEntitlementIn(BaseModel):
        email: str
        plan: str

    @billing_router.get("/control/billing")
    async def control_billing(admin: dict = Depends(get_current_admin)):
        active = await db.entitlements.count_documents({"entitlement_status": "active"})
        sandbox = await db.entitlements.count_documents({"entitlement_status": "active", "sandbox": True})
        return {"billing_mode": BILLING_MODE, "active_entitlements": active, "sandbox_entitlements": sandbox,
                "products": list(PRODUCTS.values())}

    @billing_router.post("/control/billing/demo-entitlement")
    async def control_demo_entitlement(body: AdminEntitlementIn, admin: dict = Depends(get_current_admin)):
        """Admin-only plan preview switching — DEMO accounts only, never real users."""
        u = await db.users.find_one({"email": body.email.lower()})
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        if not u.get("is_demo"):
            raise HTTPException(status_code=403, detail="Entitlement preview is limited to demo accounts")
        plan = body.plan.lower()
        if plan == "free":
            await db.entitlements.update_many({"user_id": u["id"], "entitlement_status": "active"},
                                              {"$set": {"entitlement_status": "expired", "updated_at": _iso(_now())}})
            await db.users.update_one({"id": u["id"]}, {"$set": {"plan": "free"}})
            await _clamp_radius(u["id"], "free")
            return {"ok": True, "plan": "free"}
        if plan not in PRODUCTS:
            raise HTTPException(status_code=400, detail="Unknown plan")
        rec = await _apply_entitlement(u, plan, "admin-demo", sandbox=True,
                                       product_id=PRODUCTS[plan]["ios_product_id"])
        await db.admin_audit_logs.insert_one({
            "id": str(uuid.uuid4()), "admin": admin.get("email"), "action": "demo_entitlement_set",
            "detail": {"email": body.email, "plan": plan}, "at": _iso(_now())})
        return {"ok": True, "plan": plan, "entitlement": rec}

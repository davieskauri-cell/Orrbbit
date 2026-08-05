"""Legal consent, policy registry & account-data endpoints for Orrbbit.

Bind pattern (like professional_flow / password_reset): server.py calls
legal_consent.bind(server) then includes legal_router.

Consent records are APPEND-ONLY: historical records are never updated or
deleted, including after a policy version change or account deletion.
"""
import os
import uuid
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

legal_router = APIRouter(prefix="/api")

# --------------------------------------------------------------------
# Policy registry — single source of truth for versions/effective dates.
# Values are config-driven (env-overridable), not hard-coded across UI.
# --------------------------------------------------------------------
LEGAL_SITE_BASE = os.environ.get("LEGAL_SITE_BASE", "https://www.orrbbit.com")
POLICY_VERSION = os.environ.get("POLICY_VERSION", "1.0")
POLICY_EFFECTIVE_DATE = os.environ.get("POLICY_EFFECTIVE_DATE", "2026-08-04")
POLICY_STATUS = os.environ.get("POLICY_STATUS", "effective")  # effective | draft

_DOCS = [
    ("terms", "Terms of Service", "/terms"),
    ("privacy", "Privacy Policy", "/privacy"),
    ("community_guidelines", "Community Guidelines", "/community-guidelines"),
    ("safety", "Safety Policy", "/safety"),
    ("location_privacy", "Location & Radar Privacy Notice", "/location-privacy"),
    ("child_safety", "Child Safety Standards", "/child-safety"),
    ("moderation_appeals", "Moderation & Appeals", "/moderation-appeals"),
    ("professional_services", "Professional Services Terms", "/professional-services"),
    ("professional_verification", "Professional Verification Policy", "/professional-verification"),
    ("delete_account", "Account Deletion & Data Retention", "/delete-account"),
    ("copyright", "Copyright / IP Policy", "/copyright"),
    ("support", "Support & Contact", "/support"),
    ("cookies", "Cookie Policy", "/cookies"),
    ("refunds", "Refund Policy", "/refunds"),
]

POLICY_REGISTRY = {
    key: {
        "key": key,
        "title": title,
        "url": f"{LEGAL_SITE_BASE}{path}",
        "version": POLICY_VERSION,
        "effective_date": POLICY_EFFECTIVE_DATE,
        "status": POLICY_STATUS,
    }
    for key, title, path in _DOCS
}
POLICIES_INDEX_URL = f"{LEGAL_SITE_BASE}/policies"

# Policies whose acceptance/acknowledgement is required at signup
SIGNUP_REQUIRED = ["terms", "community_guidelines", "privacy"]

UNDERAGE_MESSAGE = ("Orrbbit is currently available only to people aged 18 or older. "
                    "Your account has not been created.")
CONSENT_REQUIRED_MESSAGE = ("You must agree to the Terms of Service and Community Guidelines "
                            "and acknowledge the Privacy Policy to create an account.")

ACK_NOTICE_TYPES = {"professional_disclaimer", "credential_upload_notice", "location_notice"}


def _now():
    return datetime.now(timezone.utc).isoformat()


def parse_dob(value: str) -> date:
    """Parse YYYY-MM-DD date of birth; raise HTTPException(400) on invalid."""
    try:
        dob = date.fromisoformat((value or "").strip())
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Please enter a valid date of birth (YYYY-MM-DD).")
    today = datetime.now(timezone.utc).date()
    if dob > today:
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future.")
    if dob.year < 1900:
        raise HTTPException(status_code=400, detail="Please enter a valid date of birth.")
    return dob


def is_at_least_18(dob: date, today: Optional[date] = None) -> bool:
    today = today or datetime.now(timezone.utc).date()
    try:
        birthday = dob.replace(year=today.year)
    except ValueError:  # Feb 29 in a non-leap year
        birthday = date(today.year, 2, 28)
    return (today.year - dob.year) > 18 or ((today.year - dob.year) == 18 and today >= birthday)


def age_from_dob(dob: date, today: Optional[date] = None) -> int:
    today = today or datetime.now(timezone.utc).date()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def build_signup_consent(user_id: str, dob: date, marketing_opt_in: bool,
                         platform: Optional[str], app_version: Optional[str],
                         locale: Optional[str]) -> dict:
    """Single durable, versioned consent record captured at signup."""
    now = _now()
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "event": "signup",
        "date_of_birth": dob.isoformat(),
        "age_gate_passed": True,
        "age_at_signup": age_from_dob(dob),
        "terms_version": POLICY_REGISTRY["terms"]["version"],
        "terms_accepted_at": now,
        "community_guidelines_version": POLICY_REGISTRY["community_guidelines"]["version"],
        "community_guidelines_accepted_at": now,
        "privacy_version": POLICY_REGISTRY["privacy"]["version"],
        "privacy_acknowledged_at": now,
        "marketing_opt_in": bool(marketing_opt_in),
        "marketing_consent_at": now if marketing_opt_in else None,
        "marketing_withdrawn_at": None,
        "platform": platform or "unknown",
        "app_version": app_version or "unknown",
        "locale": locale or "unknown",
        "method": "in_app_signup",
        "created_at": now,
    }


class AcknowledgeIn(BaseModel):
    notice_type: str
    version: Optional[str] = None


class UnusedIn(BaseModel):
    pass


def bind(server):
    db = server.db
    get_current_user = server.get_current_user

    @legal_router.get("/policies")
    async def get_policies():
        return {
            "website_base": LEGAL_SITE_BASE,
            "policies_index_url": POLICIES_INDEX_URL,
            "signup_required": SIGNUP_REQUIRED,
            "policies": list(POLICY_REGISTRY.values()),
        }

    @legal_router.get("/users/me/consents")
    async def my_consents(user: dict = Depends(get_current_user)):
        records = await db.consent_records.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
        records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        return {"consents": records}

    @legal_router.post("/consents/acknowledge")
    async def acknowledge_notice(body: AcknowledgeIn, user: dict = Depends(get_current_user)):
        ntype = (body.notice_type or "").strip()
        if ntype not in ACK_NOTICE_TYPES:
            raise HTTPException(status_code=400, detail="Unknown notice type")
        await db.consent_records.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "event": "notice_acknowledged",
            "notice_type": ntype,
            "version": body.version or POLICY_VERSION,
            "method": "in_app",
            "created_at": _now(),
        })
        return {"ok": True}

    @legal_router.get("/users/me/acknowledgements")
    async def my_acknowledgements(user: dict = Depends(get_current_user)):
        records = await db.consent_records.find(
            {"user_id": user["id"], "event": "notice_acknowledged"}, {"_id": 0}
        ).to_list(100)
        latest: dict = {}
        for r in sorted(records, key=lambda x: x.get("created_at", "")):
            latest[r["notice_type"]] = {"version": r.get("version"), "acknowledged_at": r.get("created_at")}
        return {"acknowledgements": latest}

    @legal_router.get("/users/me/data-export")
    async def data_export(user: dict = Depends(get_current_user)):
        uid = user["id"]
        profile = {k: v for k, v in user.items()
                   if k not in ("_id", "hashed_password", "email_prefs_token")}
        photos = profile.get("photos") or []
        if photos:
            profile["photos"] = f"[{len(photos)} photos stored — omitted from export for size]"
        if isinstance(profile.get("photo_url"), str) and profile["photo_url"].startswith("data:"):
            profile["photo_url"] = "[photo omitted from export for size]"
        consents = await db.consent_records.find({"user_id": uid}, {"_id": 0}).to_list(200)
        blocks = await db.blocks.find({"blocker_id": uid}, {"_id": 0}).to_list(200)
        reports = await db.reports.find({"reporter_id": uid}, {"_id": 0, "reported_id": 0}).to_list(200)
        saved = await db.saved.find({"owner_id": uid}, {"_id": 0}).to_list(200)
        return {
            "generated_at": _now(),
            "profile": profile,
            "consent_records": consents,
            "blocked_users_count": len(blocks),
            "reports_submitted": reports,
            "saved_profiles": saved,
        }

    @legal_router.get("/blocks")
    async def list_blocks(user: dict = Depends(get_current_user)):
        blocks = await db.blocks.find({"blocker_id": user["id"]}, {"_id": 0}).to_list(200)
        out = []
        for b in blocks:
            other = await db.users.find_one({"id": b["blocked_id"]})
            out.append({
                "user_id": b["blocked_id"],
                "name": (other or {}).get("name", "Deleted user"),
                "photo_url": (other or {}).get("photo_url"),
                "blocked_at": b.get("created_at"),
            })
        return {"blocked": out}

    @legal_router.delete("/blocks/{user_id}")
    async def unblock(user_id: str, user: dict = Depends(get_current_user)):
        res = await db.blocks.delete_one({"blocker_id": user["id"], "blocked_id": user_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User is not blocked")
        return {"ok": True}

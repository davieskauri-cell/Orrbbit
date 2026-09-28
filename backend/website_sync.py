"""Website → mobile-backend business sign-up sync (server-to-server).

The orrbbit.com website dual-writes business sign-ups into this backend. Its
previous flow (POST /auth/register + owner JWT + /business/me + /business/me/verification)
stopped at "Email already registered" (400) whenever the owner account already
existed — e.g. after a partially-failed earlier run — leaving local website
records (like a pending "Davies Foods") never created here.

This single idempotent endpoint replaces that multi-call flow:
  * creates the owner account when the email is new, or RECONCILES to the
    existing business account (never touches its password / tokens);
  * upserts the Business Profile (one per owner, same shape as POST /business/me);
  * submits verification with status "Pending Review" — exactly what the
    Control Centre → Businesses → Pending tab lists — unless it is already
    Pending Review / In Review / Verified (then the current status is returned).
Re-running the same payload is safe, which is what makes backfills trivial.

Auth: shared secret in the `X-Website-Secret` header (constant-time compare),
configured via WEBSITE_SYNC_SECRET in backend/.env. The endpoint is disabled
(503) when the secret is not configured. /auth/register is untouched.
"""
import hmac
import os
import secrets
import uuid
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr, Field

website_router = APIRouter(prefix="/api/integrations/website")


class WebsiteBusinessIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: Optional[str] = "Other"
    email: Optional[EmailStr] = None          # defaults to the owner email
    location_display: str = Field(min_length=1, max_length=120)
    description: Optional[str] = ""
    country: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""
    registration_number: Optional[str] = ""  # ABN / NZBN / EIN ... (label is country-dependent)
    primary_contact: Optional[str] = ""
    legal_name: Optional[str] = ""           # defaults to name
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    socials: Optional[str] = ""
    opening_hours: Optional[str] = ""
    document_name: Optional[str] = ""        # reference only — never public


class WebsiteSignupIn(BaseModel):
    email: EmailStr
    owner_name: str = Field(min_length=1, max_length=80)
    # Only used when the account does NOT exist yet. Omitted → random unusable
    # password; the owner sets one via the normal "Forgot password" flow.
    password: Optional[str] = Field(default=None, min_length=8, max_length=72)
    date_of_birth: Optional[str] = None      # YYYY-MM-DD, 18+ enforced when provided
    accept_policies: bool = True
    marketing_opt_in: bool = False
    email_verified: bool = False             # website already verified the owner's email
    external_id: Optional[str] = Field(default=None, max_length=120)  # website record id
    business: WebsiteBusinessIn
    submit_verification: bool = True
    send_emails: bool = False                # website sends its own transactional emails


def bind(server):
    db = server.db
    now_iso = server.now_iso
    pwd_context = server.pwd_context

    import business as _biz
    from legal_consent import parse_dob, is_at_least_18, age_from_dob, build_signup_consent, UNDERAGE_MESSAGE

    def _require_secret(x_website_secret: Optional[str]):
        expected = (os.environ.get("WEBSITE_SYNC_SECRET") or "").strip()
        if not expected:
            raise HTTPException(status_code=503, detail="Website sync is not configured")
        if not hmac.compare_digest((x_website_secret or "").strip(), expected):
            raise HTTPException(status_code=401, detail="Unauthorized")

    async def _upsert_owner(body: WebsiteSignupIn) -> tuple[dict, str]:
        email = body.email.lower()
        existing = await db.users.find_one({"email": email})
        if existing:
            if existing.get("account_type") != "business":
                # A real member's personal account must never be silently converted
                # into a business (it would vanish from the Radar). Website shows a
                # "use a different email" message for this case.
                raise HTTPException(status_code=409, detail="existing_personal_account")
            patch = {"last_active": now_iso()}
            if body.email_verified and not existing.get("email_verified"):
                patch["email_verified"] = True
            if body.external_id:
                patch["website_external_id"] = body.external_id
            await db.users.update_one({"id": existing["id"]}, {"$set": patch})
            return {**existing, **patch}, "reconciled"

        dob = None
        if body.date_of_birth:
            dob = parse_dob(body.date_of_birth)
            if not is_at_least_18(dob):
                raise HTTPException(status_code=403, detail=UNDERAGE_MESSAGE)
        if not body.accept_policies:
            raise HTTPException(status_code=400, detail="accept_policies must be true")
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "hashed_password": pwd_context.hash(body.password or secrets.token_urlsafe(32)),
            "name": body.owner_name.strip(),
            "display_name": body.business.name.strip(),
            "account_type": "business",
            "date_of_birth": dob.isoformat() if dob else None,
            "marketing_opt_in": bool(body.marketing_opt_in),
            "age": age_from_dob(dob) if dob else None,
            "bio": "", "interests": [], "photo_url": None,
            "city": "", "country": (body.business.country or "").strip(),
            "mode": "Social", "vibe": None, "lat": None, "lng": None,
            "visible": False, "radius": 250, "ghost_mode": False, "paused": False,
            "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
            "visible_for": 60, "verified": False,
            "email_verified": bool(body.email_verified),
            "is_demo": False,
            "tutorial_completed": True,          # business accounts never see the tutorial
            "signup_source": "website",
            "website_external_id": body.external_id,
            "created_at": now_iso(), "last_active": now_iso(),
        }
        await db.users.insert_one(dict(user))
        if dob:
            await db.consent_records.insert_one(build_signup_consent(
                user["id"], dob, body.marketing_opt_in, "web", None, None))
        return user, "created"

    async def _upsert_profile(user: dict, b: WebsiteBusinessIn, owner_email: str) -> dict:
        category = b.category if b.category in _biz.BUSINESS_CATEGORIES else "Other"
        country = (b.country or "").strip()[:60]
        fields = {
            "name": b.name.strip()[:80], "category": category,
            "email": str(b.email or owner_email).strip().lower()[:120],
            "location_display": b.location_display.strip()[:120],
            "lat": b.lat, "lng": b.lng,
            "description": (b.description or "").strip()[:800],
            "logo_url": b.logo_url, "cover_url": b.cover_url,
            "website": (b.website or "").strip()[:200], "phone": (b.phone or "").strip()[:40],
            "country": country, "country_code": _biz._country_code(country),
            "primary_contact": (b.primary_contact or "").strip()[:120],
            "registration_number": (b.registration_number or "").strip()[:60],
            "abn": (b.registration_number or "").strip()[:40],
            "socials": (b.socials or "").strip()[:300],
            "opening_hours": (b.opening_hours or "").strip()[:300],
            "updated_at": now_iso(),
        }
        biz = await db.business_profiles.find_one({"user_id": user["id"]}, {"_id": 0})
        if biz:
            await db.business_profiles.update_one({"id": biz["id"]}, {"$set": fields})
            return {**biz, **fields}
        biz_id = str(uuid.uuid4())
        slug = _biz_slug(b.name)
        if await db.business_profiles.find_one({"slug": slug}):
            slug = f"{slug}-{biz_id[:6]}"
        doc = {"id": biz_id, "user_id": user["id"], "slug": slug,
               "verification_status": "In Progress",
               "subscription": {"status": "not_subscribed"},
               "profile_views": 0, "created_at": now_iso(), "signup_source": "website", **fields}
        await db.business_profiles.insert_one(dict(doc))
        return doc

    def _biz_slug(name: str) -> str:
        import re
        s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:48]
        return s or "business"

    async def _submit_verification(user: dict, biz: dict, b: WebsiteBusinessIn, send_emails: bool):
        """Mirror of POST /business/me/verification — same record shape, same status."""
        status = biz.get("verification_status", "Not Submitted")
        if status in ("Pending Review", "In Review", "Verified"):
            existing = await db.business_verifications.find_one(
                {"business_id": biz["id"], "status": status}, {"_id": 0, "id": 1})
            return status, (existing or {}).get("id"), []
        country = (biz.get("country") or "").strip()
        req_label = _biz.COUNTRY_REQUIREMENTS.get(country, _biz.COUNTRY_REQUIREMENTS["Other"])["registration_label"]
        checks = [(biz.get("name"), "Business name"), (country, "Country"),
                  (biz.get("location_display"), "Business address"), (biz.get("email"), "Business email"),
                  (biz.get("phone"), "Business phone number"), (biz.get("registration_number"), req_label)]
        missing = [label for val, label in checks if not (val or "").strip()]
        if missing:
            return status, None, missing
        sub_id = str(uuid.uuid4())
        await db.business_verifications.insert_one({
            "id": sub_id, "business_id": biz["id"], "user_id": user["id"],
            "legal_name": (b.legal_name or biz["name"]).strip()[:120], "country": country,
            "registration_label": req_label, "abn": biz["registration_number"][:60],
            "email": biz["email"], "phone": biz["phone"],
            "website": biz.get("website") or "", "address": biz["location_display"][:200],
            "primary_contact": biz.get("primary_contact") or "",
            "document_name": (b.document_name or "").strip()[:120],
            "status": "Pending Review", "submitted_at": now_iso(), "source": "website",
            "history": [{"action": "submitted", "by": user["id"], "at": now_iso(), "via": "website"}],
            "notes": []})
        await db.business_profiles.update_one(
            {"id": biz["id"]}, {"$set": {"verification_status": "Pending Review", "verification_note": ""}})
        if send_emails and server.email_service:
            server._es_fire(server.email_service.send(
                "business_verification_submitted", user={**user, "email": biz["email"]},
                ctx={"business_name": biz["name"]}, entity_id=biz["id"]))
        return "Pending Review", sub_id, []

    @website_router.post("/business-signup")
    async def website_business_signup(body: WebsiteSignupIn,
                                      x_website_secret: Optional[str] = Header(default=None)):
        _require_secret(x_website_secret)
        user, outcome = await _upsert_owner(body)
        biz = await _upsert_profile(user, body.business, user["email"])
        if body.external_id:
            await db.business_profiles.update_one({"id": biz["id"]}, {"$set": {"website_external_id": body.external_id}})
        status, sub_id, missing = biz.get("verification_status", "In Progress"), None, []
        if body.submit_verification:
            status, sub_id, missing = await _submit_verification(user, biz, body.business, body.send_emails)
        return {
            "ok": True,
            "outcome": outcome,                       # created | reconciled
            "user_id": user["id"],
            "business_id": biz["id"],
            "verification_status": status,            # "Pending Review" → Control Centre Pending tab
            "submission_id": sub_id,
            "missing_for_verification": missing,      # non-empty → profile saved, verification not submitted
        }

    @website_router.get("/business-signup/{email}")
    async def website_business_lookup(email: str, x_website_secret: Optional[str] = Header(default=None)):
        """Mapping lookup for backfills: does this owner/business already exist here?"""
        _require_secret(x_website_secret)
        user = await db.users.find_one({"email": email.strip().lower()}, {"_id": 0, "id": 1, "account_type": 1})
        if not user:
            return {"exists": False}
        biz = await db.business_profiles.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1, "verification_status": 1})
        return {"exists": True, "user_id": user["id"], "account_type": user.get("account_type"),
                "business_id": (biz or {}).get("id"),
                "verification_status": (biz or {}).get("verification_status")}

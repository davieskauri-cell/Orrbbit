"""Orrbbit Business platform — Business Profiles, verification, reviews,
subscription entitlement and Control Centre management.

ADDS business capability without touching People/Professional modes:
- business accounts never appear on People/Professional radar (server-gated)
- Business Hosted Events live in the SAME events collection (host_type="business")
- reviews only exist for Business Hosted Events, eligibility enforced server-side
- all emails go through the EXISTING central managed email layer (control_email)
"""
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

business_router = APIRouter(prefix="/api/business")
reviews_router = APIRouter(prefix="/api")
control_biz_router = APIRouter(prefix="/api/control")

BUSINESS_CATEGORIES = [
    "Hotel", "Café", "Restaurant", "Bar / Venue", "Gym / Fitness", "Coworking",
    "Community Venue", "Entertainment", "Retail", "Education", "Wellness",
    "Professional Services", "Sports Club", "Golf Club", "Accommodation", "Hospitality", "Other"]

VERIFICATION_STATUSES = ["Not Submitted", "Pending Review", "Verified",
                         "More Info Required", "Rejected", "Suspended"]
SUBSCRIPTION_STATES = ["not_subscribed", "active", "grace", "cancelled", "expired", "billing_issue"]
BUSINESS_PRODUCT_ID = "orrbbit_business_monthly"
BUSINESS_PRICE = "$5.99/month"
REVIEW_TAGS = ["Great atmosphere", "Friendly host", "Well organised", "Great networking",
               "Good food", "Good venue", "Great value", "Would attend again", "Other"]
BILLING_MODE = os.environ.get("BILLING_MODE", "disabled").lower()

# Country-dependent business registration requirements (extensible per country)
COUNTRY_REQUIREMENTS = {
    "Australia": {"registration_label": "ABN", "hint": "11-digit Australian Business Number"},
    "New Zealand": {"registration_label": "NZBN", "hint": "13-digit NZ Business Number"},
    "United States": {"registration_label": "EIN / State registration", "hint": "Federal EIN or state registration"},
    "United Kingdom": {"registration_label": "Company number", "hint": "Companies House number"},
    "Canada": {"registration_label": "Business Number (BN)", "hint": "9-digit CRA Business Number"},
    "Other": {"registration_label": "Business registration number", "hint": "Official registration/licence number"},
}


def _now():
    return datetime.now(timezone.utc)


class BusinessProfileIn(BaseModel):
    name: str
    category: str
    email: str
    location_display: str
    description: str
    logo_url: Optional[str] = None
    cover_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    website: Optional[str] = ""
    phone: Optional[str] = ""
    country: Optional[str] = ""
    primary_contact: Optional[str] = ""
    registration_number: Optional[str] = ""
    socials: Optional[str] = ""
    secondary_category: Optional[str] = ""
    opening_hours: Optional[str] = ""
    abn: Optional[str] = ""


class VerificationIn(BaseModel):
    legal_name: str
    country: Optional[str] = ""
    abn: Optional[str] = ""          # registration number (label is country-dependent)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""
    address: Optional[str] = ""
    primary_contact: Optional[str] = ""
    document_name: Optional[str] = ""   # filename/reference only; never public


class ReviewIn(BaseModel):
    rating: int
    text: Optional[str] = ""
    tags: Optional[List[str]] = None


class ReviewReportIn(BaseModel):
    reason: str
    details: Optional[str] = ""


class SubscriptionIn(BaseModel):
    platform: Optional[str] = "sandbox"   # ios | android | sandbox
    transaction_ref: Optional[str] = ""


class ControlVerifyIn(BaseModel):
    action: str          # approve | more_info | reject | suspend | reinstate | revoke
    note: Optional[str] = ""


class ControlReviewIn(BaseModel):
    action: str          # remove | restore
    reason: Optional[str] = ""


def bind(server):
    db = server.db
    get_current_user = server.get_current_user
    notify = server.notify
    now_iso = server.now_iso
    public_name = server.public_name

    import control_email as _ce
    from control_center import get_current_admin, require_perm, audit, notify_user_action

    async def _email(key, user, ctx=None, entity_id=None):
        """Central managed email layer — every outcome logs an email event."""
        if not _ce._svc:
            return {"status": "skipped", "reason": "email service not initialised"}
        try:
            return await _ce._svc.send(key, user=user, ctx=ctx or {}, entity_id=entity_id)
        except Exception as e:  # primary action never rolls back on email failure
            return {"status": "failed", "reason": str(e)[:180]}

    # ---------------------------------------------------------------- helpers
    def _slugify(name: str) -> str:
        s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:48]
        return s or "business"

    async def _biz_for(user_id: str) -> Optional[dict]:
        return await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})

    async def _require_biz(user: dict) -> dict:
        if user.get("account_type") != "business":
            raise HTTPException(status_code=403, detail="Business account required")
        biz = await _biz_for(user["id"])
        if not biz:
            raise HTTPException(status_code=404, detail="Business Profile not set up yet")
        return biz

    def can_publish(biz: dict) -> bool:
        """Entitlement authority: active/grace subscription — or staged full access
        while store billing is not yet configured (never fakes a Production payment)."""
        st = (biz.get("subscription") or {}).get("status", "not_subscribed")
        if st in ("active", "grace"):
            return True
        if st in ("expired", "billing_issue", "cancelled"):
            return False
        return BILLING_MODE == "disabled"   # pre-billing staging: publishing allowed

    server.business_can_publish = can_publish

    async def _rating(business_id: str):
        rows = await db.event_reviews.find(
            {"business_id": business_id, "status": "visible"}, {"rating": 1}).to_list(2000)
        n = len(rows)
        dist = {str(i): 0 for i in range(1, 6)}
        for r in rows:
            dist[str(r["rating"])] = dist.get(str(r["rating"]), 0) + 1
        avg = round(sum(r["rating"] for r in rows) / n, 1) if n else None
        return avg, n, dist

    def _pub_biz(b: dict) -> dict:
        return {
            "id": b["id"], "slug": b.get("slug"), "name": b["name"],
            "category": b["category"], "secondary_category": b.get("secondary_category") or "",
            "description": b.get("description", ""), "location_display": b.get("location_display", ""),
            "logo_url": b.get("logo_url"), "cover_url": b.get("cover_url"),
            "website": b.get("website") or "", "phone": b.get("phone") or "",
            "socials": b.get("socials") or "", "opening_hours": b.get("opening_hours") or "",
            "verified": b.get("verification_status") == "Verified",
        }

    async def _review_payload(r: dict) -> dict:
        u = await db.users.find_one({"id": r["user_id"]}, {"display_name": 1, "name": 1, "photo_url": 1})
        ev = await db.events.find_one({"id": r["event_id"]}, {"title": 1, "start_datetime": 1})
        return {
            "id": r["id"], "rating": r["rating"], "text": r.get("text", ""),
            "tags": r.get("tags", []), "created_at": r["created_at"],
            "status": r.get("status", "visible"), "reported": bool(r.get("reports")),
            "reviewer_name": public_name(u) or "Orrbbit member",
            "reviewer_photo": (u or {}).get("photo_url"),
            "event_title": (ev or {}).get("title", ""), "event_id": r["event_id"],
        }

    # ------------------------------------------------------------ owner setup
    @business_router.get("/me")
    async def my_business(user: dict = Depends(get_current_user)):
        if user.get("account_type") != "business":
            raise HTTPException(status_code=403, detail="Business account required")
        biz = await _biz_for(user["id"])
        if not biz:
            return {"business": None, "categories": BUSINESS_CATEGORIES}
        avg, n, dist = await _rating(biz["id"])
        sub = biz.get("subscription") or {"status": "not_subscribed"}
        return {"business": {**_pub_biz(biz), "email": biz.get("email"), "abn": biz.get("abn") or "",
                             "country": biz.get("country") or "",
                             "primary_contact": biz.get("primary_contact") or "",
                             "registration_number": biz.get("registration_number") or "",
                             "verification_status": biz.get("verification_status", "Not Submitted"),
                             "verification_note": biz.get("verification_note") or "",
                             "average_rating": avg, "review_count": n, "rating_distribution": dist,
                             "subscription": {"status": sub.get("status", "not_subscribed"),
                                              "product_id": BUSINESS_PRODUCT_ID, "price": BUSINESS_PRICE,
                                              "platform": sub.get("platform"),
                                              "renews_at": sub.get("renews_at"),
                                              "billing_mode": BILLING_MODE,
                                              "billing_pending_configuration": BILLING_MODE == "disabled",
                                              "can_publish": can_publish(biz)}},
                "categories": BUSINESS_CATEGORIES,
                "countries": list(COUNTRY_REQUIREMENTS.keys()),
                "country_requirements": COUNTRY_REQUIREMENTS}

    @business_router.post("/me")
    async def upsert_business(body: BusinessProfileIn, user: dict = Depends(get_current_user)):
        if user.get("account_type") != "business":
            raise HTTPException(status_code=403, detail="Business account required")
        if body.category not in BUSINESS_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid business category")
        for f, label in [(body.name, "Business name"), (body.email, "Business email"),
                         (body.location_display, "Business location"), (body.description, "Business description")]:
            if not (f or "").strip():
                raise HTTPException(status_code=400, detail=f"{label} is required")
        fields = {
            "name": body.name.strip()[:80], "category": body.category,
            "secondary_category": (body.secondary_category or "").strip()[:40],
            "email": body.email.strip().lower()[:120],
            "location_display": body.location_display.strip()[:120],
            "lat": body.lat, "lng": body.lng,
            "description": body.description.strip()[:800],
            "logo_url": body.logo_url, "cover_url": body.cover_url,
            "website": (body.website or "").strip()[:200], "phone": (body.phone or "").strip()[:40],
            "country": (body.country or "").strip()[:60],
            "primary_contact": (body.primary_contact or "").strip()[:120],
            "registration_number": (body.registration_number or "").strip()[:60],
            "socials": (body.socials or "").strip()[:300],
            "opening_hours": (body.opening_hours or "").strip()[:300],
            "abn": (body.abn or "").strip()[:40], "updated_at": now_iso(),
        }
        biz = await _biz_for(user["id"])
        if biz:
            await db.business_profiles.update_one({"id": biz["id"]}, {"$set": fields})
            biz_id = biz["id"]
        else:
            biz_id = str(uuid.uuid4())
            slug = _slugify(body.name)
            if await db.business_profiles.find_one({"slug": slug}):
                slug = f"{slug}-{biz_id[:6]}"
            await db.business_profiles.insert_one({
                "id": biz_id, "user_id": user["id"], "slug": slug,
                "verification_status": "Not Submitted",
                "subscription": {"status": "not_subscribed"},
                "profile_views": 0, "created_at": now_iso(), **fields})
        return await my_business(user)

    @business_router.post("/me/verification")
    async def submit_verification(body: VerificationIn, user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        if biz.get("verification_status") in ("Pending Review", "Verified"):
            raise HTTPException(status_code=400, detail=f"Verification is already {biz['verification_status']}")
        # MANDATORY before a business can be submitted for verification (website optional)
        country = (body.country or biz.get("country") or "").strip()
        phone = (body.phone or biz.get("phone") or "").strip()
        address = (body.address or biz.get("location_display") or "").strip()
        email = (body.email or biz.get("email") or "").strip()
        reg = (body.abn or biz.get("registration_number") or "").strip()
        req_label = COUNTRY_REQUIREMENTS.get(country, COUNTRY_REQUIREMENTS["Other"])["registration_label"]
        for val, label in [(body.legal_name, "Business name"), (country, "Country"),
                           (address, "Business address"), (email, "Business email"),
                           (phone, "Business phone number"), (reg, req_label)]:
            if not (val or "").strip():
                raise HTTPException(status_code=400, detail=f"{label} is required for verification")
        sub_id = str(uuid.uuid4())
        await db.business_verifications.insert_one({
            "id": sub_id, "business_id": biz["id"], "user_id": user["id"],
            "legal_name": body.legal_name.strip()[:120], "country": country[:60],
            "registration_label": req_label, "abn": reg[:60],
            "email": email[:120], "phone": phone[:40],
            "website": (body.website or biz.get("website") or "").strip()[:200],
            "address": address[:200],
            "primary_contact": (body.primary_contact or biz.get("primary_contact") or "").strip()[:120],
            "document_name": (body.document_name or "").strip()[:120],   # private — never public
            "status": "Pending Review", "submitted_at": now_iso(),
            "history": [{"action": "submitted", "by": user["id"], "at": now_iso()}], "notes": []})
        await db.business_profiles.update_one(
            {"id": biz["id"]}, {"$set": {"verification_status": "Pending Review", "verification_note": "",
                                         "country": country, "phone": phone,
                                         "registration_number": reg}})
        return {"ok": True, "status": "Pending Review", "submission_id": sub_id}

    @business_router.get("/verification-requirements")
    async def verification_requirements(user: dict = Depends(get_current_user)):
        return {"countries": list(COUNTRY_REQUIREMENTS.keys()), "requirements": COUNTRY_REQUIREMENTS}

    @business_router.post("/me/verification-link")
    async def verification_computer_link(user: dict = Depends(get_current_user)):
        """'Complete Business Verification on Computer' — emails a secure continue
        link to the BUSINESS email; same account, progress saved server-side."""
        biz = await _require_biz(user)
        result = await _email("business_verification_link",
                              {**user, "email": biz.get("email") or user.get("email")},
                              ctx={"business_name": biz["name"]}, entity_id=biz["id"])
        return {"ok": result.get("status") in ("sent", "skipped"), "delivery": result.get("status")}

    # ----------------------------------------------------- dashboard/analytics
    @business_router.get("/me/overview")
    async def business_overview(user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        now = _now().isoformat()
        evs = await db.events.find({"creator_user_id": user["id"]}, {"_id": 0}).to_list(300)
        active = [e for e in evs if e.get("status") in ("active", "full")]
        upcoming = [e for e in active if e.get("start_datetime", "") > now]
        ev_ids = [e["id"] for e in evs]
        going = await db.event_attendees.count_documents(
            {"event_id": {"$in": ev_ids}, "join_status": "accepted"}) if ev_ids else 0
        avg, n, _d = await _rating(biz["id"])
        return {
            "business_name": biz["name"], "verified": biz.get("verification_status") == "Verified",
            "verification_status": biz.get("verification_status", "Not Submitted"),
            "active_events": len(active), "upcoming_events": len(upcoming),
            "people_going": going,
            "event_views": sum(e.get("views", 0) for e in evs),
            "event_impressions": sum(e.get("impressions", 0) for e in evs),
            "profile_views": biz.get("profile_views", 0),
            "average_rating": avg, "review_count": n,
            "events_hosted": len(evs),
            "completed_events": sum(1 for e in evs if e.get("status") == "completed"),
            "can_publish": can_publish(biz),
            "subscription_status": (biz.get("subscription") or {}).get("status", "not_subscribed"),
        }

    @business_router.get("/me/analytics")
    async def business_analytics(user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        base = await business_overview(user)
        evs = await db.events.find({"creator_user_id": user["id"]}, {"_id": 0}).to_list(300)
        by_cat = {}
        best = None
        for e in evs:
            score = e.get("views", 0)
            by_cat[e["category"]] = by_cat.get(e["category"], 0) + score
            if best is None or score > best.get("views", 0):
                best = e
        top_cat = max(by_cat, key=by_cat.get) if by_cat else None
        return {**base,
                "strongest_category": top_cat,
                "top_event": ({"id": best["id"], "title": best["title"], "views": best.get("views", 0),
                               "category": best["category"]} if best else None)}

    @business_router.get("/me/reviews")
    async def business_reviews(user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        avg, n, dist = await _rating(biz["id"])
        rows = await db.event_reviews.find(
            {"business_id": biz["id"], "status": "visible"},
            {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"average_rating": avg, "review_count": n, "distribution": dist,
                "reviews": [await _review_payload(r) for r in rows]}

    # ----------------------------------------------------------- subscription
    @business_router.get("/subscription")
    async def business_subscription(user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        sub = biz.get("subscription") or {"status": "not_subscribed"}
        return {"product_id": BUSINESS_PRODUCT_ID, "price": BUSINESS_PRICE,
                "status": sub.get("status", "not_subscribed"), "platform": sub.get("platform"),
                "renews_at": sub.get("renews_at"), "billing_mode": BILLING_MODE,
                "billing_pending_configuration": BILLING_MODE == "disabled",
                "can_publish": can_publish(biz),
                "guidance": ("Store billing is not configured yet — Business access is staged. "
                             "Apple/Google product configuration is required before live charges."
                             if BILLING_MODE != "native" else
                             "Manage your subscription through the App Store / Google Play.")}

    @business_router.post("/subscription/activate")
    async def activate_subscription(body: SubscriptionIn, user: dict = Depends(get_current_user)):
        """Sandbox/staging entitlement only — NEVER a real charge. Native store
        purchases must be verified through the store billing flow when configured."""
        biz = await _require_biz(user)
        if BILLING_MODE == "native" and body.platform == "sandbox":
            raise HTTPException(status_code=400, detail="Purchases must go through the app store")
        if BILLING_MODE == "disabled":
            raise HTTPException(status_code=400, detail="Billing is not enabled in this environment yet")
        sub = {"status": "active", "product_id": BUSINESS_PRODUCT_ID,
               "platform": body.platform or "sandbox", "sandbox": BILLING_MODE == "sandbox",
               "transaction_ref": (body.transaction_ref or f"sandbox-{uuid.uuid4().hex[:10]}")[:80],
               "started_at": now_iso(), "renews_at": (_now() + timedelta(days=30)).isoformat()}
        await db.business_profiles.update_one({"id": biz["id"]}, {"$set": {"subscription": sub}})
        return {"ok": True, "subscription": sub}

    @business_router.post("/subscription/cancel")
    async def cancel_subscription(user: dict = Depends(get_current_user)):
        biz = await _require_biz(user)
        await db.business_profiles.update_one(
            {"id": biz["id"]}, {"$set": {"subscription.status": "cancelled"}})
        return {"ok": True, "status": "cancelled"}

    # --------------------------------------------------------- public profile
    @business_router.get("/public/{ref}")
    async def public_business(ref: str, user: dict = Depends(get_current_user)):
        biz = await db.business_profiles.find_one({"$or": [{"id": ref}, {"slug": ref}]}, {"_id": 0})
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found")
        owner = await db.users.find_one({"id": biz["user_id"]}, {"admin_status": 1, "id": 1})
        if not owner or owner.get("admin_status") in ("banned", "deleted"):
            raise HTTPException(status_code=404, detail="Business not found")
        if user["id"] != biz["user_id"]:
            await db.business_profiles.update_one({"id": biz["id"]}, {"$inc": {"profile_views": 1}})
        avg, n, dist = await _rating(biz["id"])
        now = _now().isoformat()
        evs = await db.events.find(
            {"creator_user_id": biz["user_id"], "status": {"$in": ["active", "full", "completed"]}},
            {"_id": 0}).sort("start_datetime", -1).to_list(60)
        upcoming = [{"id": e["id"], "title": e["title"], "category": e["category"],
                     "start_datetime": e["start_datetime"], "cover_image": e.get("cover_image"),
                     "status": e["status"]}
                    for e in evs if e.get("end_datetime", "") >= now and e["status"] in ("active", "full")]
        past = [{"id": e["id"], "title": e["title"], "category": e["category"],
                 "start_datetime": e["start_datetime"]}
                for e in evs if e["status"] == "completed"][:10]
        reviews = await db.event_reviews.find(
            {"business_id": biz["id"], "status": "visible"}, {"_id": 0}).sort("created_at", -1).to_list(10)
        return {**_pub_biz(biz), "average_rating": avg, "review_count": n, "rating_distribution": dist,
                "upcoming_events": upcoming, "past_events": past,
                "reviews": [await _review_payload(r) for r in reviews]}

    # ---------------------------------------------------------------- reviews
    async def _eligibility(ev: dict, user: dict):
        if not ev or ev.get("host_type") != "business":
            return False, "Reviews are only available for Business Hosted Events"
        if ev.get("creator_user_id") == user["id"]:
            return False, "Hosts can't review their own event"
        if ev.get("status") == "cancelled":
            return False, "This event was cancelled"
        if (ev.get("end_datetime") or "") > _now().isoformat():
            return False, "You can review once the event has ended"
        att = await db.event_attendees.find_one({"event_id": ev["id"], "user_id": user["id"]})
        if not att or att.get("join_status") != "accepted":
            return False, "Only confirmed attendees can leave a review"
        if await db.event_reviews.find_one({"event_id": ev["id"], "user_id": user["id"]}):
            return False, "You've already reviewed this event"
        return True, ""

    @reviews_router.get("/events/{event_id}/review/eligibility")
    async def review_eligibility(event_id: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id}, {"_id": 0})
        ok, reason = await _eligibility(ev, user)
        biz = await db.business_profiles.find_one({"user_id": (ev or {}).get("creator_user_id")}) if ev else None
        return {"eligible": ok, "reason": reason,
                "event": ({"id": ev["id"], "title": ev["title"], "cover_image": ev.get("cover_image"),
                           "start_datetime": ev["start_datetime"],
                           "business_name": (biz or {}).get("name", "")} if ev else None),
                "tags": REVIEW_TAGS}

    @reviews_router.post("/events/{event_id}/review")
    async def create_review(event_id: str, body: ReviewIn, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id}, {"_id": 0})
        ok, reason = await _eligibility(ev, user)
        if not ok:
            raise HTTPException(status_code=403, detail=reason)
        if not 1 <= body.rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be 1-5 stars")
        biz = await db.business_profiles.find_one({"user_id": ev["creator_user_id"]})
        if not biz:
            raise HTTPException(status_code=404, detail="Business no longer exists")
        rec = {"id": str(uuid.uuid4()), "event_id": event_id, "business_id": biz["id"],
               "user_id": user["id"], "rating": body.rating,
               "text": (body.text or "").strip()[:500],
               "tags": [t for t in (body.tags or []) if t in REVIEW_TAGS][:6],
               "status": "visible", "reports": [], "created_at": now_iso()}
        await db.event_reviews.insert_one(dict(rec))
        await notify(biz["user_id"], "business_new_review", "New review",
                     f"{public_name(user) or 'An attendee'} left a {body.rating}-star review on \"{ev['title']}\".",
                     meta={"event_id": event_id, "review_id": rec["id"], "business_id": biz["id"]})
        return {"ok": True, "review_id": rec["id"]}

    @reviews_router.post("/reviews/{review_id}/report")
    async def report_review(review_id: str, body: ReviewReportIn, user: dict = Depends(get_current_user)):
        r = await db.event_reviews.find_one({"id": review_id})
        if not r:
            raise HTTPException(status_code=404, detail="Review not found")
        await db.event_reviews.update_one({"id": review_id}, {"$push": {"reports": {
            "by": user["id"], "reason": body.reason[:80], "details": (body.details or "")[:300],
            "at": now_iso()}}})
        return {"ok": True}

    # -------------------------------------------- post-event review requests
    async def send_review_requests(ev: dict):
        """Called when a Business Hosted Event completes: in-app + email to every
        ELIGIBLE confirmed attendee (never cancelled/declined/pending)."""
        if ev.get("host_type") != "business":
            return 0
        biz = await db.business_profiles.find_one({"user_id": ev["creator_user_id"]})
        if not biz:
            return 0
        atts = await db.event_attendees.find(
            {"event_id": ev["id"], "join_status": "accepted",
             "user_id": {"$ne": ev["creator_user_id"]}}).to_list(500)
        sent = 0
        for a in atts:
            dk = f"review_request:{ev['id']}:{a['user_id']}"
            if await db.notifications.find_one({"user_id": a["user_id"], "dedupe_key": dk}):
                continue
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "user_id": a["user_id"], "type": "review_request",
                "title": "How was your experience?",
                "body": f"\"{ev['title']}\" hosted by {biz['name']} has ended. Share your experience.",
                "event_id": ev["id"], "business_id": biz["id"],
                "read": False, "dedupe_key": dk, "created_at": now_iso()})
            u = await db.users.find_one({"id": a["user_id"]})
            if u:
                await _email("business_review_request", u,
                             ctx={"name": public_name(u) or "there", "event_title": ev["title"],
                                  "business_name": biz["name"], "event_id": ev["id"]},
                             entity_id=f"{ev['id']}:{a['user_id']}")
            sent += 1
        return sent

    server.business_review_requests = send_review_requests

    # ------------------------------------------------------- CONTROL CENTRE
    @control_biz_router.get("/businesses")
    async def control_businesses(status: Optional[str] = None, subscription: Optional[str] = None,
                                 q: Optional[str] = None,
                                 admin: dict = Depends(require_perm("users"))):
        f = {}
        if status and status != "All":
            f["verification_status"] = status
        if subscription == "active":
            f["subscription.status"] = {"$in": ["active", "grace"]}
        elif subscription == "expired":
            f["subscription.status"] = {"$in": ["expired", "cancelled", "billing_issue"]}
        if q:
            f["name"] = {"$regex": re.escape(q), "$options": "i"}
        rows = await db.business_profiles.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)
        out = []
        for b in rows:
            owner = await db.users.find_one({"id": b["user_id"]}, {"admin_status": 1, "email": 1})
            avg, n, _d = await _rating(b["id"])
            active_ev = await db.events.count_documents(
                {"creator_user_id": b["user_id"], "status": {"$in": ["active", "full"]}})
            out.append({"id": b["id"], "name": b["name"], "category": b["category"],
                        "location": b.get("location_display", ""), "country": b.get("country") or "",
                        "verification_status": b.get("verification_status", "Not Submitted"),
                        "subscription_status": (b.get("subscription") or {}).get("status", "not_subscribed"),
                        "active_events": active_ev, "average_rating": avg, "review_count": n,
                        "account_status": (owner or {}).get("admin_status") or "active",
                        "owner_email": (owner or {}).get("email"), "created_at": b.get("created_at")})
        return {"businesses": out, "statuses": VERIFICATION_STATUSES}

    @control_biz_router.get("/businesses/{biz_id}")
    async def control_business_detail(biz_id: str, admin: dict = Depends(require_perm("users"))):
        b = await db.business_profiles.find_one({"id": biz_id}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Business not found")
        owner = await db.users.find_one({"id": b["user_id"]}, {"_id": 0, "hashed_password": 0})
        subs = await db.business_verifications.find(
            {"business_id": biz_id}, {"_id": 0}).sort("submitted_at", -1).to_list(20)
        evs = await db.events.find({"creator_user_id": b["user_id"]}, {"_id": 0}).sort(
            "start_datetime", -1).to_list(100)
        reviews = await db.event_reviews.find({"business_id": biz_id}, {"_id": 0}).sort(
            "created_at", -1).to_list(100)
        avg, n, dist = await _rating(biz_id)
        audits = await db.admin_audit_logs.find({"target_id": biz_id}, {"_id": 0}).sort(
            "created_at", -1).to_list(50)
        emails = await db.email_events.find({"user_id": b["user_id"]}, {"_id": 0}).sort(
            "created_at", -1).to_list(30)
        return {"business": b, "owner": {"id": (owner or {}).get("id"),
                                         "email": (owner or {}).get("email"),
                                         "admin_status": (owner or {}).get("admin_status") or "active"},
                "verifications": subs,
                "events": [{"id": e["id"], "title": e["title"], "category": e["category"],
                            "status": e["status"], "start_datetime": e["start_datetime"],
                            "cancellation_reason": e.get("cancellation_reason")} for e in evs],
                "reviews": [await _review_payload(r) for r in reviews],
                "average_rating": avg, "review_count": n, "rating_distribution": dist,
                "audit": audits, "emails": emails}

    @control_biz_router.post("/businesses/{biz_id}/verification")
    async def control_business_verification(biz_id: str, body: ControlVerifyIn,
                                            admin: dict = Depends(require_perm("verifications"))):
        b = await db.business_profiles.find_one({"id": biz_id})
        if not b:
            raise HTTPException(status_code=404, detail="Business not found")
        mapping = {"approve": ("Verified", "business_verification_approved",
                               "Business verification approved",
                               f"{b['name']} is now a Verified Business on Orrbbit."),
                   "more_info": ("More Info Required", "business_verification_more_info",
                                 "More information required",
                                 f"Your verification for {b['name']} needs more information."),
                   "reject": ("Rejected", "business_verification_rejected",
                              "Business verification declined",
                              f"Your verification for {b['name']} was not approved."),
                   "suspend": ("Suspended", "business_verification_suspended",
                               "Business verification suspended",
                               f"Verification for {b['name']} has been suspended."),
                   "revoke": ("Rejected", "business_verification_suspended",
                              "Business verification revoked",
                              f"Verification for {b['name']} has been revoked."),
                   "reinstate": ("Verified", "business_verification_approved",
                                 "Business verification reinstated",
                                 f"{b['name']} is a Verified Business again.")}
        if body.action not in mapping:
            raise HTTPException(status_code=400, detail="Invalid action")
        new_status, tpl, title, body_text = mapping[body.action]
        old = b.get("verification_status")
        await db.business_profiles.update_one(
            {"id": biz_id}, {"$set": {"verification_status": new_status,
                                      "verification_note": (body.note or "")[:300]}})
        await db.business_verifications.update_many(
            {"business_id": biz_id, "status": "Pending Review"},
            {"$set": {"status": new_status, "reviewed_at": now_iso(), "reviewer": admin.get("email")},
             "$push": {"history": {"action": body.action, "by": admin.get("email"),
                                   "note": (body.note or "")[:300], "at": now_iso()}}})
        # central admin-action communication pipeline: audit + notify + email + delivery status
        result = await notify_user_action(
            admin=admin, action=f"business_verification_{body.action}", user_id=b["user_id"],
            title=title, body_text=body_text + ((f" Note: {body.note}") if body.note else ""),
            email_template=tpl, email_ctx={"business_name": b["name"], "note": body.note or ""},
            entity_type="business", entity_id=biz_id,
            old_value={"verification_status": old}, extra_new={"verification_status": new_status})
        return {"ok": True, "status": new_status, "communication": result}

    @control_biz_router.get("/business-reviews")
    async def control_reviews(filter: Optional[str] = "All",
                              admin: dict = Depends(require_perm("reports"))):
        f = {}
        if filter == "Reported":
            f["reports.0"] = {"$exists": True}
        elif filter == "Visible":
            f["status"] = "visible"
        elif filter == "Removed":
            f["status"] = "removed"
        rows = await db.event_reviews.find(f, {"_id": 0}).sort("created_at", -1).to_list(200)
        out = []
        for r in rows:
            p = await _review_payload(r)
            biz = await db.business_profiles.find_one({"id": r["business_id"]}, {"name": 1})
            p["business_name"] = (biz or {}).get("name", "")
            p["reports"] = r.get("reports", [])
            p["removed_reason"] = r.get("removed_reason")
            out.append(p)
        return {"reviews": out}

    @control_biz_router.post("/business-reviews/{review_id}/action")
    async def control_review_action(review_id: str, body: ControlReviewIn,
                                    admin: dict = Depends(require_perm("reports"))):
        r = await db.event_reviews.find_one({"id": review_id})
        if not r:
            raise HTTPException(status_code=404, detail="Review not found")
        if body.action not in ("remove", "restore"):
            raise HTTPException(status_code=400, detail="Invalid action")
        new_status = "removed" if body.action == "remove" else "visible"
        await db.event_reviews.update_one(
            {"id": review_id}, {"$set": {"status": new_status,
                                         "removed_reason": (body.reason or "")[:300] if body.action == "remove" else None,
                                         "moderated_by": admin.get("email"), "moderated_at": now_iso()}})
        await audit(admin, f"review_{body.action}", "event_review", review_id,
                    old_value=r.get("status"), new_value=new_status)
        if body.action == "remove":
            # material user-impacting action → central communication pipeline
            await notify_user_action(
                admin=admin, action="review_removed", user_id=r["user_id"],
                title="Your review was removed",
                body_text=("A review you left on Orrbbit was removed by our team."
                           + (f" Reason: {body.reason}" if body.reason else "")),
                email_template=None, entity_type="event_review", entity_id=review_id,
                old_value={"status": "visible"}, extra_new={"status": "removed"})
        return {"ok": True, "status": new_status}

    return business_router

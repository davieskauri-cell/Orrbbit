"""Orrbbit Demo Mode — controlled demo environment (bind pattern).

- Config flags: DEMO_MODE_ENABLED / STORE_SCREENSHOT_MODE_ENABLED (db-backed, env defaults)
- Admin controls: enable/disable, seed, reset, remove demo data (control-centre admins only)
- Demo photo assets: unique AI-generated fictional portraits served from /api/demo-assets/*
- Realm isolation helpers: demo accounts and real accounts never interact
- Idempotent photo application + one harmless moderation example
"""
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

demo_router = APIRouter(prefix="/api")

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "static", "demo-assets")
_MANIFEST_PATH = "/app/memory/demo_assets_manifest.json"

# In-memory state cache (loaded from db.app_config at startup, updated by admin controls)
STATE = {
    "demo_mode_enabled": os.environ.get("DEMO_MODE_ENABLED", "true").lower() == "true",
    "store_screenshot_mode": os.environ.get("STORE_SCREENSHOT_MODE_ENABLED", "false").lower() == "true",
}

# asset_id -> demo account email (primary demo accounts)
PHOTO_MAP = {
    "kauri": "kauri@intro.demo", "james": "james@intro.demo", "sarah": "sarah@intro.demo",
    "olivia": "olivia@intro.demo", "jake": "jake@intro.demo", "mia": "mia@intro.demo",
    "liam": "liam@intro.demo", "sophie": "sophie@intro.demo", "ryan": "ryan@intro.demo",
    "emily": "emily@intro.demo", "alexdemo": "demo@intro.demo",
    "maya": "maya@radar.intro.demo", "tom": "tom@radar.intro.demo", "ava": "ava@radar.intro.demo",
    "lucas": "lucas@radar.intro.demo", "grace": "grace@radar.intro.demo", "oscar": "oscar@radar.intro.demo",
    "ruby": "ruby@radar.intro.demo", "aria": "aria@radar.intro.demo", "finn": "finn@radar.intro.demo",
    "theo": "theo@radar.intro.demo", "poppy": "poppy@radar.intro.demo", "arlo": "arlo@radar.intro.demo",
    "daisy": "daisy@radar.intro.demo", "felix": "felix@radar.intro.demo", "hazel": "hazel@radar.intro.demo",
    "jasper": "jasper@radar.intro.demo", "luna": "luna@radar.intro.demo", "ezra": "ezra@radar.intro.demo",
    "iris": "iris@radar.intro.demo", "dev": "dev@radar.intro.demo", "sana": "sana@radar.intro.demo",
    "jade": "jade@radar.intro.demo", "priya": "priya@radar.intro.demo",
    "matilda": "matilda@radar.intro.demo", "rory": "rory@radar.intro.demo",
}

MODERATION_EXAMPLE_EMAIL = "marco@radar.intro.demo"


def _now():
    return datetime.now(timezone.utc).isoformat()


def cross_realm_hidden(viewer: dict, other: dict) -> bool:
    """True when `other` must be hidden from `viewer` under demo isolation rules.
    - Demo users never see real users.
    - Real users never see demo users unless Demo Mode is enabled by an admin/environment."""
    v_demo, o_demo = bool(viewer.get("is_demo")), bool(other.get("is_demo"))
    if v_demo == o_demo:
        return False
    if v_demo and not o_demo:
        return True
    return not STATE["demo_mode_enabled"]


def ensure_same_realm(me: dict, target: dict):
    """Hard interaction gate: demo and real accounts can never contact each other."""
    if bool(me.get("is_demo")) != bool(target.get("is_demo")):
        raise HTTPException(status_code=403, detail="This profile is a demo account and can't be contacted")


class DemoModeIn(BaseModel):
    demo_mode_enabled: Optional[bool] = None
    store_screenshot_mode: Optional[bool] = None


def bind(server):
    db = server.db

    # Admin auth from the existing Control Centre
    import control_center as _cc
    get_current_admin = _cc.get_current_admin

    async def _load_state():
        doc = await db.app_config.find_one({"key": "demo_mode"})
        if doc:
            STATE["demo_mode_enabled"] = bool(doc.get("demo_mode_enabled", STATE["demo_mode_enabled"]))
            STATE["store_screenshot_mode"] = bool(doc.get("store_screenshot_mode", STATE["store_screenshot_mode"]))

    async def _save_state():
        await db.app_config.update_one(
            {"key": "demo_mode"},
            {"$set": {"key": "demo_mode", **STATE, "updated_at": _now()}}, upsert=True)

    # ---------------- public (read-only, non-sensitive) ----------------
    @demo_router.get("/demo-mode/status")
    async def demo_mode_status():
        return dict(STATE)

    @demo_router.get("/demo-assets/{filename}")
    async def demo_asset(filename: str):
        safe = os.path.basename(filename)
        path = os.path.join(_ASSETS_DIR, safe)
        if not os.path.isfile(path):
            raise HTTPException(status_code=404, detail="Asset not found")
        return FileResponse(path, media_type="image/jpeg",
                            headers={"Cache-Control": "public, max-age=604800"})

    # ---------------- photo application (idempotent) ----------------
    async def apply_demo_photos():
        applied = 0
        for asset_id, email in PHOTO_MAP.items():
            if not os.path.isfile(os.path.join(_ASSETS_DIR, f"{asset_id}.jpg")):
                continue
            url = f"/api/demo-assets/{asset_id}.jpg"
            r = await db.users.update_one(
                {"email": email},
                {"$set": {"photo_url": url, "photos": [url], "photo_version": 1}})
            applied += r.modified_count
        # Strip third-party stock photos from every remaining demo user (initials fallback)
        await db.users.update_many(
            {"is_demo": True,
             "$or": [{"photo_url": {"$regex": "randomuser|picsum|pravatar|unsplash"}},
                     {"photo_url": None}],
             "email": {"$nin": list(PHOTO_MAP.values())}},
            {"$set": {"photo_url": None, "photos": []}})
        return applied

    # ---------------- moderation example (harmless, idempotent) ----------------
    async def seed_moderation_example():
        u = await db.users.find_one({"email": MODERATION_EXAMPLE_EMAIL})
        if not u:
            return
        if await db.moderationActions.find_one({"demo_example": True}):
            return
        await db.users.update_one({"email": MODERATION_EXAMPLE_EMAIL},
                                  {"$set": {"photo_url": None, "photos": []}})
        await db.moderationActions.insert_one({
            "id": str(uuid.uuid4()), "action": "photo_removed", "user_id": u["id"],
            "reason": "Profile photo was a business logo, not a personal photo",
            "by": "orrbbit-admin", "at": _now(), "demo_example": True, "demo": True,
        })
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": u["id"], "type": "moderation_photo_removed",
            "title": "Profile photo removed",
            "body": "Your profile photo was removed because it didn't follow our photo guidelines (personal photos only). Please upload a photo of yourself.",
            "read": False, "created_at": _now(), "demo_env": True,
        })

    # ---------------- admin controls ----------------
    @demo_router.get("/control/demo-mode")
    async def control_demo_status(admin: dict = Depends(get_current_admin)):
        counts = {
            "demo_users": await db.users.count_documents({"is_demo": True}),
            "demo_photos_applied": await db.users.count_documents(
                {"is_demo": True, "photo_url": {"$regex": "^/api/demo-assets/"}}),
        }
        return {**STATE, **counts}

    @demo_router.put("/control/demo-mode")
    async def control_demo_toggle(body: DemoModeIn, admin: dict = Depends(get_current_admin)):
        if body.demo_mode_enabled is not None:
            STATE["demo_mode_enabled"] = body.demo_mode_enabled
        if body.store_screenshot_mode is not None:
            STATE["store_screenshot_mode"] = body.store_screenshot_mode
        await _save_state()
        await db.admin_audit_logs.insert_one({
            "id": str(uuid.uuid4()), "admin": admin.get("email"), "action": "demo_mode_update",
            "detail": dict(STATE), "at": _now()})
        return dict(STATE)

    @demo_router.post("/control/demo-mode/seed")
    async def control_demo_seed(admin: dict = Depends(get_current_admin)):
        result = await server.seed_demo_environment(force=True)
        await apply_demo_photos()
        await seed_moderation_example()
        return {"ok": True, "seeded": result}

    @demo_router.post("/control/demo-mode/reset")
    async def control_demo_reset(admin: dict = Depends(get_current_admin)):
        result = await server.seed_demo_environment(force=True)
        await apply_demo_photos()
        await seed_moderation_example()
        return {"ok": True, "reset": result}

    @demo_router.post("/control/demo-mode/remove")
    async def control_demo_remove(admin: dict = Depends(get_current_admin)):
        """Remove ALL demo data. Never touches real-user records."""
        demo_ids = [u["id"] async for u in db.users.find({"is_demo": True}, {"id": 1})]
        pair = {"$or": [{"from_user_id": {"$in": demo_ids}}, {"to_user_id": {"$in": demo_ids}}]}
        ab = {"$or": [{"user_a": {"$in": demo_ids}}, {"user_b": {"$in": demo_ids}}]}
        removed = {
            "users": (await db.users.delete_many({"is_demo": True})).deleted_count,
            "pings": (await db.pings.delete_many(pair)).deleted_count,
            "matches": (await db.matches.delete_many(ab)).deleted_count,
            "meetups": (await db.meetups.delete_many(ab)).deleted_count,
            "notifications": (await db.notifications.delete_many({"user_id": {"$in": demo_ids}})).deleted_count,
            "help_requests": (await db.help_requests.delete_many({"user_id": {"$in": demo_ids}})).deleted_count,
            "professional_profiles": (await db.professional_profiles.delete_many({"user_id": {"$in": demo_ids}})).deleted_count,
            "verification_submissions": (await db.verification_submissions.delete_many({"user_id": {"$in": demo_ids}})).deleted_count,
            "pro_sessions": (await db.pro_sessions.delete_many({"$or": [{"professional_id": {"$in": demo_ids}}, {"user_id": {"$in": demo_ids}}]})).deleted_count,
            "pro_reviews": (await db.pro_reviews.delete_many({"$or": [{"professional_id": {"$in": demo_ids}}, {"reviewer_id": {"$in": demo_ids}}]})).deleted_count,
            "pro_messages": (await db.pro_messages.delete_many({"$or": [{"from_user_id": {"$in": demo_ids}}, {"to_user_id": {"$in": demo_ids}}]})).deleted_count,
            "saved": (await db.saved.delete_many({"$or": [{"owner_id": {"$in": demo_ids}}, {"user_id": {"$in": demo_ids}}]})).deleted_count,
            "blocks": (await db.blocks.delete_many({"$or": [{"blocker_id": {"$in": demo_ids}}, {"blocked_id": {"$in": demo_ids}}]})).deleted_count,
        }
        await db.meta.delete_one({"key": "demo_env_version"})
        await db.admin_audit_logs.insert_one({
            "id": str(uuid.uuid4()), "admin": admin.get("email"), "action": "demo_data_removed",
            "detail": removed, "at": _now()})
        return {"ok": True, "removed": removed}

    @demo_router.get("/control/demo-mode/manifest")
    async def control_demo_manifest(admin: dict = Depends(get_current_admin)):
        if not os.path.isfile(_MANIFEST_PATH):
            return {"manifest": []}
        with open(_MANIFEST_PATH) as f:
            return {"manifest": json.load(f)}

    # expose for server startup / demo reset
    server_ns = server
    server_ns.demo_apply_photos = apply_demo_photos
    server_ns.demo_seed_moderation_example = seed_moderation_example
    server_ns.demo_load_state = _load_state

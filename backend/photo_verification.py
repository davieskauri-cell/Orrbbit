"""Photo Verification — fresh front-camera live selfie compared against the user's
uploaded profile photos with GPT-5 vision (Emergent LLM key).

This is PHOTO verification, never identity verification:
- Uploading profile photos alone NEVER verifies anyone.
- The selfie must be a fresh camera capture (base64 data URL); links/gallery URLs are rejected.
- A selfie identical to any stored photo or a previously submitted selfie is rejected (reuse screen).
- Only the selfie hash + verdict are stored — the live selfie image itself is never retained.
"""
import base64
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv()

photo_ver_router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
VERIFY_PROVIDER, VERIFY_MODEL = "openai", "gpt-5"
MIN_CONFIDENCE = 70


class SelfieIn(BaseModel):
    selfie: str  # data:image/jpeg;base64,... — fresh camera capture ONLY


def _payload_of(data_url: str) -> str:
    return data_url.partition(",")[2]


def _sha(payload: str) -> str:
    return hashlib.sha256(payload.encode()).hexdigest()


async def _photo_as_base64(src: str) -> Optional[str]:
    """Profile photo → raw base64 (supports data URLs, https URLs and internal /api asset paths)."""
    if src.startswith("data:image/"):
        return _payload_of(src) or None
    url = src
    if src.startswith("/api/"):
        url = f"http://localhost:8001{src}"
    if url.startswith("http://") or url.startswith("https://"):
        try:
            async with httpx.AsyncClient(timeout=15) as cli:
                r = await cli.get(url, follow_redirects=True)
                if r.status_code == 200 and r.content:
                    return base64.b64encode(r.content).decode()
        except Exception:
            return None
    return None


async def _compare(selfie_b64: str, refs: list) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"photo-verify-{uuid.uuid4()}",
        system_message=(
            "You are a photo comparison assistant for a Photo Verified badge. The FIRST image is a "
            "live selfie; the remaining images are the person's uploaded profile photos. Decide whether "
            "the selfie clearly contains a real human face and shows the SAME person as the profile "
            "photos. Reply with ONLY JSON: "
            '{"face_present": true/false, "same_person": true/false, "confidence": 0-100, '
            '"reason": "one short user-friendly sentence"}'
        ),
    ).with_model(VERIFY_PROVIDER, VERIFY_MODEL)
    images = [ImageContent(image_base64=selfie_b64)] + [ImageContent(image_base64=b) for b in refs]
    resp = await chat.send_message(
        UserMessage(text="Compare the live selfie (first image) with the profile photos.", file_contents=images)
    )
    m = re.search(r"\{.*\}", str(resp), re.S)
    if not m:
        raise HTTPException(status_code=502, detail="Verification service returned an unexpected response. Please try again.")
    try:
        return json.loads(m.group(0))
    except Exception:
        raise HTTPException(status_code=502, detail="Verification service returned an unexpected response. Please try again.")


def bind(srv):
    db = srv.db

    def _status_of(u: dict) -> dict:
        pv = u.get("photo_verification") or {}
        status = pv.get("status") or "not_submitted"
        if status not in ("verified", "failed"):
            status = "not_submitted"  # normalises legacy/seed placeholders like "none"
        return {
            "status": status,
            "reason": pv.get("reason"),
            "checked_at": pv.get("checked_at"),
            "photo_verified": bool(u.get("photo_verified", False)),
        }

    @photo_ver_router.get("/users/me/photo-verification")
    async def my_photo_verification(user: dict = Depends(srv.get_current_user)):
        return _status_of(user)

    @photo_ver_router.post("/users/me/photo-verification")
    async def run_photo_verification(body: SelfieIn, user: dict = Depends(srv.get_current_user)):
        selfie = (body.selfie or "").strip()
        # camera-only: a fresh capture arrives as a base64 data URL, never a link
        if not selfie.startswith("data:image/"):
            raise HTTPException(
                status_code=400,
                detail="Verification needs a fresh live selfie taken with your front camera — links and gallery photos can't be used.",
            )
        payload = _payload_of(selfie)
        if not payload or len(payload) < 1000:
            raise HTTPException(status_code=400, detail="That capture looks empty — please take the selfie again.")

        photos = [p for p in (user.get("photos") or []) if p] or ([user["photo_url"]] if user.get("photo_url") else [])
        if not photos:
            raise HTTPException(status_code=400, detail="Add at least one profile photo first, then take your live selfie.")

        selfie_hash = _sha(payload)
        # reuse screen: identical to a stored profile photo, or a selfie already submitted before
        profile_hashes = {_sha(_payload_of(p)) for p in photos if p.startswith("data:image/")}
        if selfie_hash in profile_hashes or await db.photo_verifications.find_one({"selfie_hash": selfie_hash}):
            raise HTTPException(
                status_code=400,
                detail="That image isn't a live selfie. Please take a brand-new photo with your front camera.",
            )

        refs = []
        for p in photos[:2]:
            b = await _photo_as_base64(p)
            if b:
                refs.append(b)
        if not refs:
            raise HTTPException(
                status_code=400,
                detail="We couldn't read your profile photos for comparison. Try re-uploading a clear photo of yourself.",
            )

        verdict = await _compare(payload, refs)
        ok = (
            bool(verdict.get("face_present"))
            and bool(verdict.get("same_person"))
            and int(verdict.get("confidence") or 0) >= MIN_CONFIDENCE
        )
        now = datetime.now(timezone.utc).isoformat()
        pv = {
            "status": "verified" if ok else "failed",
            "reason": None if ok else (verdict.get("reason") or "The selfie didn't clearly match your profile photos."),
            "confidence": int(verdict.get("confidence") or 0),
            "model": VERIFY_MODEL,
            "checked_at": now,
        }
        await db.users.update_one({"id": user["id"]}, {"$set": {"photo_verified": ok, "photo_verification": pv}})
        # audit record — selfie hash + verdict only; the selfie image itself is never stored
        await db.photo_verifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "selfie_hash": selfie_hash,
            "status": pv["status"],
            "confidence": pv["confidence"],
            "reason": pv["reason"],
            "checked_at": now,
        })
        fresh = await db.users.find_one({"id": user["id"]})
        return {**_status_of(fresh), "user": srv.own_user(fresh)}

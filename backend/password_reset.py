"""Orrbbit password reset — email a 6-digit code via Resend, then set a new password.

Security: no user enumeration (always returns ok), 15-min code expiry, hashed codes,
max 5 verify attempts, rate limiting per email. Mounted from server.py.
"""
import hashlib
import logging
import random
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from email_templates import code_box as _code_box
from email_service import fire as _es_fire

logger = logging.getLogger(__name__)
reset_router = APIRouter(prefix="/api/auth")

CODE_TTL_MIN = 15
MAX_ATTEMPTS = 5
MAX_REQUESTS_PER_HOUR = 3


def _now():
    return datetime.now(timezone.utc)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


async def _send_reset_email(server, user: dict, code: str):
    await server.email_service.send(
        "password_reset", user=user,
        ctx={"name": user.get("name"), "ttl_min": CODE_TTL_MIN, "code_box": _code_box(code)},
        force=True,
    )


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


def bind(server):
    db = server.db

    @reset_router.post("/forgot-password")
    async def forgot_password(body: ForgotIn):
        email = body.email.strip().lower()
        generic = {"ok": True, "message": "If that email exists, a reset code has been sent."}
        user = await db.users.find_one({"email": email})
        if not user:
            return generic  # no user enumeration
        if user.get("is_demo"):
            # demo accounts use fake inboxes — pretend success without sending
            return generic

        hour_ago = (_now() - timedelta(hours=1)).isoformat()
        recent = await db.password_resets.count_documents({"email": email, "created_at": {"$gte": hour_ago}})
        if recent >= MAX_REQUESTS_PER_HOUR:
            return generic  # silently absorb to avoid abuse signal

        code = f"{random.SystemRandom().randint(0, 999999):06d}"
        await db.password_resets.delete_many({"email": email})
        await db.password_resets.insert_one({
            "email": email,
            "code_hash": _hash_code(code),
            "expires_at": (_now() + timedelta(minutes=CODE_TTL_MIN)).isoformat(),
            "attempts": 0,
            "created_at": _now().isoformat(),
        })
        try:
            await _send_reset_email(server, user, code)
        except Exception as e:
            logger.error(f"Password reset email failed for {email}: {e}")
        return generic

    @reset_router.post("/reset-password")
    async def reset_password(body: ResetIn):
        email = body.email.strip().lower()
        doc = await db.password_resets.find_one({"email": email})
        invalid = HTTPException(status_code=400, detail="Invalid or expired code. Request a new one.")
        if not doc:
            raise invalid
        if doc["expires_at"] < _now().isoformat():
            await db.password_resets.delete_many({"email": email})
            raise invalid
        if doc.get("attempts", 0) >= MAX_ATTEMPTS:
            await db.password_resets.delete_many({"email": email})
            raise invalid
        if _hash_code(body.code) != doc["code_hash"]:
            await db.password_resets.update_one({"email": email}, {"$inc": {"attempts": 1}})
            raise invalid

        user = await db.users.find_one({"email": email})
        if not user:
            raise invalid
        await db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": server.pwd_context.hash(body.new_password)}},
        )
        await db.password_resets.delete_many({"email": email})
        _es_fire(server.email_service.send("password_changed", user=user))
        return {"ok": True, "message": "Password updated. You can now sign in."}

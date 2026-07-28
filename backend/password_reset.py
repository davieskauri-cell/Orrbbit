"""Orrbbit password reset — email a 6-digit code via Resend, then set a new password.

Security: no user enumeration (always returns ok), 15-min code expiry, hashed codes,
max 5 verify attempts, rate limiting per email. Mounted from server.py.
"""
import os
import hashlib
import logging
import random
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
reset_router = APIRouter(prefix="/api/auth")

RESEND_API_URL = "https://api.resend.com/emails"

CODE_TTL_MIN = 15
MAX_ATTEMPTS = 5
MAX_REQUESTS_PER_HOUR = 3


def _now():
    return datetime.now(timezone.utc)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _reset_email_html(code: str) -> str:
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:14px;padding:36px;font-family:Arial,Helvetica,sans-serif;">
          <tr><td style="font-size:22px;font-weight:bold;color:#081A35;padding-bottom:6px;">Orrbbit</td></tr>
          <tr><td style="font-size:16px;color:#081A35;font-weight:bold;padding:14px 0 4px;">Reset your Orrbbit password</td></tr>
          <tr><td style="font-size:14px;color:#4B5563;line-height:20px;">Use the code below to reset your password. It expires in {CODE_TTL_MIN} minutes.</td></tr>
          <tr><td align="center" style="padding:22px 0;">
            <div style="display:inline-block;background:#E9F8F7;color:#0F766E;font-size:30px;font-weight:bold;letter-spacing:8px;padding:14px 26px;border-radius:10px;">{code}</div>
          </td></tr>
          <tr><td style="font-size:12px;color:#9CA3AF;line-height:18px;">If you didn't request this, you can safely ignore this email — your password won't change.</td></tr>
          <tr><td style="font-size:12px;color:#9CA3AF;line-height:18px;padding-top:14px;border-top:1px solid #F3F4F6;">Need help? Contact <a href="mailto:{os.environ.get("SUPPORT_EMAIL", "support@orrbbit.com")}" style="color:#16B6B0;">{os.environ.get("SUPPORT_EMAIL", "support@orrbbit.com")}</a> · <a href="{os.environ.get("APP_URL", "https://orrbbit.com")}" style="color:#16B6B0;">orrbbit.com</a></td></tr>
        </table>
      </td></tr>
    </table>
    """


async def _send_reset_email(to_email: str, code: str):
    from_email = os.environ["FROM_EMAIL"]
    from_name = os.environ.get("FROM_NAME", "ORRBBIT")
    payload = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": "Reset your Orrbbit password",
        "html": _reset_email_html(code),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}"},
            json=payload,
        )
    resp.raise_for_status()


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
            await _send_reset_email(email, code)
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
        return {"ok": True, "message": "Password updated. You can now sign in."}

"""Orrbbit transactional email template registry + responsive brand layout.

Every template: subject, preheader, heading, HTML body (with {placeholders}),
optional CTA (label, app path), preference category (None = mandatory, cannot
be disabled), enabled flag (engagement templates ship disabled) and an optional
cooldown. A plain-text version is generated for every email.
"""
import os
import re
from pathlib import Path

from dotenv import load_dotenv, dotenv_values

load_dotenv(Path(__file__).parent / ".env")
# The platform injects its own APP_URL (preview host) into the process env,
# which would silently win over .env. For email branding config, the .env
# file is the source of truth.
_FILE_ENV = dotenv_values(Path(__file__).parent / ".env")

# SECRETS must come from the deployment secret store (process env) first:
# production injects rotated keys as OS env vars, which a stale baked .env
# file must never shadow. URL/branding config stays file-first (see above).
_PROCESS_ENV_FIRST = {"RESEND_API_KEY"}


def env_cfg(key: str, default: str = "") -> str:
    if key in _PROCESS_ENV_FIRST:
        return os.environ.get(key) or _FILE_ENV.get(key) or default
    return _FILE_ENV.get(key) or os.environ.get(key) or default


APP_URL = env_cfg("APP_URL", "https://orrbbit.com").rstrip("/")
SUPPORT_EMAIL = env_cfg("SUPPORT_EMAIL", "support@orrbbit.com")
# Base for backend-served links & assets (unsubscribe/verify/logo). In production
# this is the deployed backend origin (PUBLIC_BASE_URL deployment secret).
# Customer-facing links prefer the official Orrbbit domain once it actually routes here.
PUBLIC_BASE_URL = (env_cfg("CUSTOMER_WEB_BASE_URL", "") or env_cfg("PUBLIC_BASE_URL", APP_URL)).rstrip("/")
# Official Orrbbit logo for email headers. Override with EMAIL_LOGO_URL once the
# main website hosts it (preferred: https://orrbbit.com/email-assets/orrbbit-logo.png).
EMAIL_LOGO_URL = env_cfg("EMAIL_LOGO_URL") or f"{PUBLIC_BASE_URL}/api/email-assets/orrbbit-logo.png"

NAVY = "#081A35"
TEAL = "#16B6B0"
ORANGE = "#FF6A30"
GREY = "#4B5563"
LIGHT = "#9CA3AF"

# Preference categories users can manage (mandatory templates use category=None)
PREF_CATEGORIES = {
    "connections": "Connection and request emails",
    "session_reminders": "Session reminders",
    "professional_activity": "Professional activity",
    "weekly_summaries": "Weekly summaries",
    "product_updates": "Product updates",
    "marketing": "Marketing communications",
}
PREF_DEFAULTS = {
    "connections": True,
    "session_reminders": True,
    "professional_activity": True,
    "weekly_summaries": False,
    "product_updates": False,
    "marketing": False,
}


class _SafeDict(dict):
    def __missing__(self, key):
        return ""


def code_box(code: str) -> str:
    return (f'<div style="display:inline-block;background:#E9F8F7;color:#0F766E;font-size:30px;'
            f'font-weight:bold;letter-spacing:8px;padding:14px 26px;border-radius:10px;">{code}</div>')


def _fmt(s: str, ctx: dict) -> str:
    return (s or "").format_map(_SafeDict(ctx))


def _strip_html(html: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</(p|tr|div|table)>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def render_layout(*, preheader: str, heading: str, body_html: str, cta_label: str | None,
                  cta_url: str | None, unsub_url: str | None, prefs_url: str | None) -> tuple[str, str]:
    """Returns (html, plain_text). One reusable responsive Orrbbit layout."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
          <tr><td align="center" style="padding:26px 0 8px;">
            <a href="{cta_url}" style="display:inline-block;background:{TEAL};color:#FFFFFF;font-size:15px;
               font-weight:bold;text-decoration:none;padding:14px 34px;border-radius:999px;">{cta_label}</a>
          </td></tr>
          <tr><td align="center" style="font-size:12px;color:{LIGHT};padding-bottom:6px;">
            Button not working? <a href="{cta_url}" style="color:{TEAL};">Open this securely in your browser.</a>
          </td></tr>"""
    unsub_block = ""
    if unsub_url:
        unsub_block = (f' · <a href="{unsub_url}" style="color:{LIGHT};">Unsubscribe</a>'
                       + (f' · <a href="{prefs_url}" style="color:{LIGHT};">Email preferences</a>' if prefs_url else ""))
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F7F9;">
  <div style="display:none;max-height:0;overflow:hidden;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:32px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:480px;background:#FFFFFF;border-radius:16px;padding:36px 32px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding-bottom:28px;">
          <a href="{APP_URL}" target="_blank" style="text-decoration:none;border:0;outline:none;display:block;">
            <img src="{EMAIL_LOGO_URL}" width="210" alt="ORRBBIT"
                 style="max-width:210px;width:100%;height:auto;display:block;border:0;outline:none;text-decoration:none;color:{NAVY};font-size:20px;font-weight:800;" />
          </a>
        </td></tr>
        <tr><td style="font-size:19px;font-weight:bold;color:{NAVY};padding-bottom:10px;">{heading}</td></tr>
        <tr><td style="font-size:14px;color:{GREY};line-height:22px;">{body_html}</td></tr>
        {cta_block}
        <tr><td style="padding-top:24px;border-top:1px solid #F3F4F6;margin-top:20px;">
          <table role="presentation" width="100%"><tr><td style="font-size:12px;color:{LIGHT};line-height:19px;padding-top:16px;">
            Need help? Contact <a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};">{SUPPORT_EMAIL}</a><br>
            <a href="{APP_URL}/privacy" style="color:{LIGHT};">Privacy Policy</a> ·
            <a href="{APP_URL}/terms" style="color:{LIGHT};">Terms</a>{unsub_block}<br>
            <span style="color:{ORANGE};">●</span> Orrbbit · Real people. Real moments. Right nearby.
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
    text = f"ORRBBIT\n\n{heading}\n\n{_strip_html(body_html)}\n"
    if cta_label and cta_url:
        text += f"\n{cta_label}: {cta_url}\n"
    text += f"\nNeed help? {SUPPORT_EMAIL}\nPrivacy: {APP_URL}/privacy · Terms: {APP_URL}/terms"
    if unsub_url:
        text += f"\nUnsubscribe: {unsub_url}"
    return html, text


TEMPLATES: dict[str, dict] = {}


def _t(key, subject, heading, body, *, cta=None, category=None, enabled=True,
       cooldown_min=0, preheader=None, trigger=""):
    TEMPLATES[key] = {
        "key": key, "subject": subject, "heading": heading, "body": body,
        "cta": cta,  # (label, app_path) — path may contain {placeholders}
        "category": category, "mandatory": category is None,
        "enabled": enabled, "cooldown_min": cooldown_min,
        "preheader": preheader or subject, "trigger": trigger,
    }


# ---------------------------------------------------------------- 1. ACCOUNT & SECURITY (mandatory)
_t("verify_email", "Verify your Orrbbit email", "Verify your email",
   "Thanks for joining Orrbbit, {name}. Please verify your email to get started — it keeps your account secure and makes your profile fully discoverable. This link expires in 7 days.",
   cta=("Verify Email Address", "__VERIFY_LINK__"), trigger="On registration")
_t("welcome", "Welcome to Orrbbit 🎉", "Welcome to Orrbbit, {name}!",
   "You're in! Orrbbit connects you with real people and verified professionals right nearby. Set your vibe, switch on your radar and see who's around you.",
   cta=("Open Orrbbit", "/"), trigger="On registration")
_t("pro_desktop_verification", "Complete your Orrbbit Professional Verification",
   "Finish verification on your computer",
   "You asked to complete your Professional Verification on a desktop or laptop. "
   "Use the secure button below on your computer — it links to the same Orrbbit account "
   "and review process. The link expires in 24 hours and can only be used once.",
   cta=("Complete Verification", "__CTX_LINK__"),
   trigger="User requests desktop verification link")

_t("admin_new_verification", "New Professional Verification awaiting review",
   "New verification submitted",
   "{name} has submitted a Professional Verification for <b>{profession}</b>. "
   "It is awaiting review in the Orrbbit Control Centre → Professional Verification queue. "
   "Documents are available securely inside the Control Centre only.",
   trigger="New professional verification submitted (to support inbox)")

_t("password_reset", "Reset your Orrbbit password", "Reset your Orrbbit password",
   'Use the code below to reset your password. It expires in {ttl_min} minutes.<br><br><div style="text-align:center;">{code_box}</div><br>If you didn\'t request this, you can safely ignore this email — your password won\'t change.',
   trigger="POST /api/auth/forgot-password")
_t("password_changed", "Your Orrbbit password was changed", "Password changed",
   "Hi {name}, your Orrbbit password was just changed. If this was you, no action is needed. If you didn't do this, reset your password immediately and contact support.",
   cta=("Secure My Account", "/login"), trigger="After successful password reset/change")
_t("email_change_requested", "Confirm your new email address", "Email change requested",
   "Hi {name}, we received a request to change the email on your Orrbbit account to {new_email}. If this wasn't you, contact support immediately.",
   trigger="On email change request (no route yet — dormant)")
_t("email_changed", "Your Orrbbit email was changed", "Email address updated",
   "Hi {name}, the email address on your Orrbbit account was changed. If this wasn't you, contact support immediately.",
   trigger="After email change completes (no route yet — dormant)")
_t("new_device_login", "New login to your Orrbbit account", "New device login",
   "Hi {name}, your Orrbbit account was just accessed from a new device.<br><br><b>When:</b> {when}<br><b>Device:</b> {device}<br><br>If this was you, you can ignore this email. If not, change your password now.",
   cta=("Change Password", "/forgot-password"), cooldown_min=60, trigger="Login from unseen device")
_t("suspicious_login", "Suspicious activity on your Orrbbit account", "Suspicious login detected",
   "Hi {name}, we noticed several failed sign-in attempts on your account followed by a successful login. If this wasn't you, reset your password immediately.",
   cta=("Reset Password", "/forgot-password"), cooldown_min=60, trigger="5+ failed logins then success")
_t("account_deletion_requested", "Your Orrbbit deletion request", "Account deletion requested",
   "Hi {name}, we received a request to delete your Orrbbit account. If this wasn't you, contact support immediately.",
   trigger="Deletion request (deletion is immediate — dormant)")
_t("account_deletion_completed", "Your Orrbbit account has been deleted", "Account deleted",
   "Hi {name}, your Orrbbit account and personal data have been permanently deleted, as requested. We're sorry to see you go — you're always welcome back.",
   trigger="DELETE /api/users/me")

# ---------------------------------------------------------------- 2. PROFESSIONAL VERIFICATION
_t("pro_application_received", "We received your verification application", "Application received",
   "Hi {name}, your {profession} verification application is with our review team. We'll email you as soon as it's been reviewed — usually within 1–2 business days.",
   cta=("View Status", "/professional"), trigger="POST /api/verification/submit")
_t("pro_more_info", "More information needed for your verification", "More information required",
   "Hi {name}, our review team needs a little more information to verify your credentials.<br><br><b>Reviewer note:</b> {note}<br><br>Please update your submission to continue.",
   cta=("Update Submission", "/professional"), trigger="Admin decision: more_info")
_t("pro_approved", "You're Orrbbit Verified ✔", "Verification approved",
   "Congratulations {name}! Your {profession} credentials are verified. Your verified badge is now live and you can offer professional services on Orrbbit.",
   cta=("Open Professional Mode", "/professional"), trigger="Admin decision: approve/renew")
_t("pro_declined", "Your verification was not approved", "Verification declined",
   "Hi {name}, unfortunately your verification was not approved this time.<br><br><b>Reviewer note:</b> {note}<br><br>You can resubmit with updated credentials at any time.",
   cta=("Resubmit", "/professional"), trigger="Admin decision: reject/revoke")
_t("credential_expiring", "Your credential expires soon", "Your credential is approaching its expiry date",
   "Hi {name}, one of your verified credentials expires on <b>{expiry}</b>. Renew it before then to keep your verified badge and stay visible to clients. Note: credential expiry is separate from Orrbbit's annual review — your credential's actual expiry date always takes precedence.",
   cta=("Renew Credentials", "/professional"), category="professional_activity",
   trigger="Scheduler: expiry within 30 days")
_t("annual_review_reminder", "Your annual credential review is coming up", "Your annual professional credential review is coming up",
   "Hi {name}, Orrbbit reviews verified professional credentials each year to help keep information current. Your next review is due on <b>{due_date}</b>. Please make sure your credential information remains current — this is separate from your credential's own expiry date.",
   cta=("Review My Credentials", "/professional"), category="professional_activity",
   trigger="Scheduler: annual review due within 60/30/7 days")
_t("annual_review_completed", "Your annual credential review is complete", "Annual review completed",
   "Hi {name}, your annual professional credential review is complete and your verified status continues. Reminder: credentials may remain valid for up to 2 years, subject to their actual expiry date.",
   cta=("View My Verification", "/professional"), category="professional_activity",
   trigger="Admin completes annual review")
_t("credential_expired", "Your credential has expired", "Credential expired",
   "Hi {name}, a verified credential on your account has expired and your verified badge has been paused. Upload updated credentials to restore it. Existing conversations stay active.",
   cta=("Upload Credentials", "/professional"), trigger="Credential auto-expiry")
_t("pro_restricted", "Your professional account has been restricted", "Professional account restricted",
   "Hi {name}, your professional account has been restricted.<br><br><b>Reason:</b> {note}<br><br>Contact support if you believe this is a mistake.",
   trigger="Admin decision: suspend")
_t("pro_restored", "Your professional account is back", "Professional account restored",
   "Good news {name} — your professional account has been restored and your verified badge is live again.",
   cta=("Open Professional Mode", "/professional"), trigger="Admin decision: renew after suspend")

# ---------------------------------------------------------------- 3. CONNECTIONS & HELP REQUESTS
_t("new_connection_request", "{other_name} wants to connect on Orrbbit", "New connection request",
   "Hi {name}, <b>{other_name}</b> sent you a connection request{category_part}.<br><br>“{message}”<br><br>Review and respond in the app — messaging unlocks once you accept.",
   cta=("View Request", "/pings"), category="connections", trigger="POST /api/professional/connect")
_t("connection_accepted", "{other_name} accepted your request 🎉", "Connection accepted",
   "Great news {name}! <b>{other_name}</b> accepted your connection request. You can now message each other directly.",
   cta=("Start Chatting", "/professional/session/{session_id}"), category="connections",
   trigger="POST /connect/requests/{id}/accept")
_t("help_request_received", "New help request from {other_name}", "Professional help request",
   "Hi {name}, <b>{other_name}</b> needs your help with <b>{category}</b>.<br><br>“{message}”<br><br>Respond promptly to keep your response-time rating strong.",
   cta=("View Request", "/pings"), category="connections", trigger="Connect request with category")
_t("help_request_accepted", "{other_name} accepted your help request", "Help request accepted",
   "Hi {name}, <b>{other_name}</b> accepted your {category} request. A session is now open — you can discuss details in the chat.",
   cta=("Open Session", "/professional/session/{session_id}"), category="connections",
   trigger="Professional accepts request")
_t("request_cancelled", "A request was cancelled", "Request cancelled",
   "Hi {name}, the {category} request with <b>{other_name}</b> was cancelled. No further action is needed.",
   category="connections", trigger="Request/session cancelled")
_t("unread_request_reminder", "You have a pending request on Orrbbit", "Pending connection request",
   "Hi {name}, you have {count_label} waiting for your response for over 24 hours. Quick responses keep your profile strong.",
   cta=("Review Requests", "/pings"), category="connections", cooldown_min=1440,
   trigger="Scheduler: pending request older than 24h (once)")
_t("unread_messages", "You have unread messages on Orrbbit", "Unread messages waiting",
   "Hi {name}, you have <b>{count} unread message{plural}</b> from <b>{other_name}</b>. They're waiting to hear back from you.",
   cta=("Open Conversation", "/professional/session/{session_id}"), category="connections",
   cooldown_min=720, trigger="Scheduler: unread >30 min, batched, max 1/session/day")

# ---------------------------------------------------------------- 4. SESSIONS & CONSULTATIONS
_t("consultation_requested", "New consultation request", "Consultation requested",
   "Hi {name}, <b>{other_name}</b> requested a {category} consultation.<br><br>“{message}”",
   cta=("View Request", "/pings"), category="connections", trigger="Connect request (consultation)")
_t("consultation_accepted", "Your consultation was accepted", "Consultation accepted",
   "Hi {name}, <b>{other_name}</b> accepted your consultation request. You can now coordinate details in your session chat.",
   cta=("Open Session", "/professional/session/{session_id}"), category="connections",
   trigger="Professional accepts consultation")
_t("booking_confirmed", "Booking confirmed", "Your booking is confirmed",
   "Hi {name}, your booking with <b>{other_name}</b> is confirmed for <b>{when}</b>. We'll remind you before it starts.",
   cta=("View Booking", "/professional/session/{session_id}"), trigger="Booking created (dormant — no booking entity yet)")
_t("booking_rescheduled", "Booking rescheduled", "Your booking was rescheduled",
   "Hi {name}, your booking with <b>{other_name}</b> has been moved to <b>{when}</b>.",
   cta=("View Booking", "/professional/session/{session_id}"), trigger="Booking rescheduled (dormant)")
_t("booking_cancelled", "Booking cancelled", "Your booking was cancelled",
   "Hi {name}, your booking with <b>{other_name}</b>{when_part} has been cancelled.",
   cta=("Open Orrbbit", "/pings"), trigger="Booking/session cancelled")
_t("session_reminder_24h", "Reminder: session tomorrow", "Your session is tomorrow",
   "Hi {name}, a reminder that your session with <b>{other_name}</b> is scheduled for <b>{when}</b> — that's about 24 hours from now.",
   cta=("View Session", "/professional/session/{session_id}"), category="session_reminders",
   trigger="Scheduler: 24h before scheduled_at (once)")
_t("session_reminder_1h", "Starting soon: your Orrbbit session", "Your session starts in 1 hour",
   "Hi {name}, your session with <b>{other_name}</b> starts at <b>{when}</b> — about an hour from now.",
   cta=("Open Session", "/professional/session/{session_id}"), category="session_reminders",
   trigger="Scheduler: 1h before scheduled_at (once)")
_t("session_completed", "Session completed", "Session completed",
   "Hi {name}, your session with <b>{other_name}</b> has been marked completed. Thanks for using Orrbbit!",
   cta=("View Session", "/professional/session/{session_id}"), category="connections",
   trigger="Session marked completed")
_t("leave_review", "How was your session with {other_name}?", "Leave a review",
   "Hi {name}, your session with <b>{other_name}</b> is complete. A quick review helps other people find great professionals.",
   cta=("Leave a Review", "/professional/session/{session_id}"), category="connections",
   trigger="Session completed (to requester)")
_t("review_received", "You received a new review ⭐", "New review received",
   "Hi {name}, <b>{other_name}</b> rated your session <b>{rating}/5</b>{review_part} Keep up the great work!",
   cta=("View Reviews", "/professional"), category="professional_activity",
   trigger="POST /sessions/{id}/review")
_t("missed_session", "Missed session", "Missed session or no-show",
   "Hi {name}, it looks like your session with <b>{other_name}</b> didn't go ahead as planned. You can rebook or contact them through the app.",
   cta=("Open Orrbbit", "/pings"), category="connections", trigger="No-show recorded (dormant)")

# ---------------------------------------------------------------- 5. SAFETY & MODERATION (mandatory)
_t("report_received", "We received your report", "Report received",
   "Hi {name}, thanks for helping keep Orrbbit safe. We've received your report and our moderation team will review it. You won't see this person again. We can't share details of the investigation, but we take every report seriously.",
   trigger="POST /api/reports (to reporter)")
_t("report_outcome", "Update on your report", "Report update",
   "Hi {name}, we've completed the review of your recent report and taken the appropriate action in line with our Community Guidelines. To protect everyone's privacy we can't share specific details. Thank you for helping keep Orrbbit safe.",
   trigger="Admin actions a report (to reporter)")
_t("guidelines_warning", "Community Guidelines warning", "Community Guidelines warning",
   "Hi {name}, your recent activity on Orrbbit was flagged and reviewed by our moderation team.<br><br>{note}<br><br>Please review our Community Guidelines. Repeated issues may lead to account restrictions.",
   cta=("Review Guidelines", "/etiquette"), trigger="Admin warns a user")
_t("account_restricted", "Your Orrbbit account has been restricted", "Account restricted",
   "Hi {name}, your account has been temporarily restricted while our team reviews recent activity. Some features may be unavailable. Contact support if you believe this is a mistake.",
   trigger="Admin hides/suspends account")
_t("account_suspended", "Your Orrbbit account has been suspended", "Account suspended",
   "Hi {name}, your account has been suspended for violating our Community Guidelines. If you believe this decision is wrong, you can appeal by replying to this email or contacting support.",
   trigger="Admin suspends/bans account")
_t("appeal_received", "We received your appeal", "Appeal received",
   "Hi {name}, we've received your appeal and our team will review it carefully. We'll email you the outcome — this usually takes 2–3 business days.",
   trigger="Appeal submitted (dormant — no appeal route yet)")
_t("appeal_outcome", "The outcome of your appeal", "Appeal outcome",
   "Hi {name}, our team has finished reviewing your appeal.<br><br>{note}",
   trigger="Appeal decided (dormant)")
_t("account_restored", "Your Orrbbit account is back", "Account restored",
   "Good news {name} — your account has been restored and you have full access to Orrbbit again. Welcome back!",
   cta=("Open Orrbbit", "/"), trigger="Admin unsuspends/unbans account")
_t("privacy_security_notice", "Important security notice", "Important privacy & security notice",
   "Hi {name},<br><br>{note}<br><br>If you have questions, contact our support team.",
   trigger="Admin sends security notice")

# ---------------------------------------------------------------- 6. SUPPORT (mandatory)
_t("support_received", "We got your message", "Support request received",
   "Hi {name}, thanks for reaching out. Your support request has been received and our team will get back to you as soon as possible — usually within 1 business day.",
   trigger="Support request submitted")
_t("support_reply", "New reply from Orrbbit Support", "Support replied",
   "Hi {name}, our support team has replied to your request.<br><br>{note}",
   trigger="Support agent replies (dormant — no ticket thread yet)")
_t("support_resolved", "Your support request is resolved", "Support request resolved",
   "Hi {name}, your support request has been marked resolved. If anything still isn't right, just reply to this email and we'll reopen it.",
   trigger="Support ticket resolved (dormant)")
_t("feedback_received", "Thanks for your feedback 💬", "Feedback received",
   "Hi {name}, thanks for sharing your feedback — it goes straight to the team building Orrbbit and genuinely shapes what we improve next.",
   cooldown_min=60, trigger="POST /api/feedback")

# ---------------------------------------------------------------- 7. ENGAGEMENT (disabled by default)
_t("weekly_activity_summary", "Your week on Orrbbit", "Your weekly activity summary",
   "Hi {name}, here's your week: <b>{stats}</b>. Open the app to see who's nearby right now.",
   cta=("Open Orrbbit", "/"), category="weekly_summaries", enabled=False, trigger="Scheduler (disabled)")
_t("unread_connections_digest", "Connections waiting for you", "Your unread connections",
   "Hi {name}, you have <b>{count}</b> connection{plural} waiting for a reply.",
   cta=("Review Connections", "/pings"), category="weekly_summaries", enabled=False, trigger="Scheduler (disabled)")
_t("professional_performance_summary", "Your professional performance this month", "Performance summary",
   "Hi {name}, here's your month: <b>{stats}</b>.",
   cta=("View Dashboard", "/professional"), category="professional_activity", enabled=False, trigger="Scheduler (disabled)")
_t("upcoming_session_summary", "Your upcoming sessions", "Upcoming sessions",
   "Hi {name}, you have <b>{count}</b> session{plural} coming up. Check the details in the app.",
   cta=("View Sessions", "/encounters"), category="session_reminders", enabled=False, trigger="Scheduler (disabled)")
_t("product_updates", "What's new on Orrbbit", "Product update",
   "{note}", cta=("See What's New", "/"), category="product_updates", enabled=False, trigger="Admin broadcast (disabled)")
_t("feature_announcements", "New on Orrbbit: {feature}", "Feature announcement",
   "{note}", cta=("Try It Now", "/"), category="product_updates", enabled=False, trigger="Admin broadcast (disabled)")
_t("re_engagement", "People are nearby — come back to Orrbbit", "We miss you!",
   "Hi {name}, it's been a while. New people and verified professionals have joined near you — come see who's around.",
   cta=("Open Orrbbit", "/"), category="marketing", enabled=False, trigger="Scheduler (disabled)")


def build_email(key: str, ctx: dict, *, unsub_url: str | None = None,
                prefs_url: str | None = None, verify_url: str | None = None) -> dict:
    """Render a template into {subject, html, text}. CTA paths become APP_URL links
    (validated: same-origin only, never open redirects)."""
    tpl = TEMPLATES[key]
    ctx = dict(ctx or {})
    ctx.setdefault("app_url", APP_URL)
    subject = _fmt(tpl["subject"], ctx)
    heading = _fmt(tpl["heading"], ctx)
    body_html = _fmt(tpl["body"], ctx)
    cta_label = cta_url = None
    if tpl["cta"]:
        cta_label, path = tpl["cta"]
        if path == "__VERIFY_LINK__":
            cta_url = verify_url
        elif path == "__CTX_LINK__":
            # Full action URL provided by the caller (e.g. secure desktop verification link)
            cta_url = ctx.get("action_url")
        else:
            path = _fmt(path, ctx)
            # App-action paths must never 404 (the public host serves only the API).
            # Route them through the branded interstitial that guides the user into the app.
            from urllib.parse import quote as _q
            cta_url = f"{PUBLIC_BASE_URL}/api/email/open?to={_q(path)}" if path.startswith("/") else None
    html, text = render_layout(
        preheader=_fmt(tpl["preheader"], ctx), heading=heading, body_html=body_html,
        cta_label=cta_label, cta_url=cta_url,
        unsub_url=unsub_url if tpl["category"] else None,
        prefs_url=prefs_url if tpl["category"] else None,
    )
    return {"subject": subject, "html": html, "text": text}


SAMPLE_CTX = {
    "name": "Alex", "other_name": "Jordan", "new_email": "new@example.com",
    "when": "Tomorrow, 2:00 PM", "when_part": " on Tomorrow, 2:00 PM", "device": "iPhone · Melbourne, AU",
    "profession": "Accounting", "note": "Please upload the second page of your certificate.",
    "expiry": "2026-08-30", "category": "Legal", "category_part": " about Legal",
    "message": "Hi! I'd love some advice on a contract review.", "session_id": "sample",
    "count": 3, "plural": "s", "count_label": "1 connection request", "rating": 5,
    "review_part": ': "Fantastic session, really helpful."', "stats": "4 new connections · 2 sessions",
    "feature": "Live Radar 2.0", "ttl_min": 15, "code_box": code_box("123456"),
}

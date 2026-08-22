"""Iteration 48c — Resend key precedence + email failure surfacing.

Root cause of 'new Resend key shows no activity': env_cfg() let a stale baked
.env file value shadow the deployment-secret RESEND_API_KEY injected as an OS
env var in production. Secrets must be process-env-first.
"""
import subprocess
import sys

import pymongo
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"


def test_resend_key_prefers_process_env_over_file():
    """Simulates production: OS env var (deployment secret) must win over .env file."""
    code = (
        "import os, sys; sys.path.insert(0, '/app/backend');"
        "from email_templates import env_cfg;"
        "assert env_cfg('RESEND_API_KEY') == 'INJECTED_SECRET_SENTINEL', env_cfg('RESEND_API_KEY')[:6];"
        "print('OK')"
    )
    r = subprocess.run([sys.executable, "-c", code],
                       env={"RESEND_API_KEY": "INJECTED_SECRET_SENTINEL", "PATH": "/usr/bin:/bin"},
                       capture_output=True, text=True, cwd="/app/backend")
    assert r.returncode == 0 and "OK" in r.stdout, r.stderr[-300:]


def test_branding_urls_stay_file_first():
    """APP_URL must remain file-first (platform injects a preview host into process env)."""
    code = (
        "import os, sys; sys.path.insert(0, '/app/backend');"
        "from email_templates import env_cfg;"
        "v = env_cfg('APP_URL');"
        "assert 'evil.example' not in v, v; print('OK')"
    )
    r = subprocess.run([sys.executable, "-c", code],
                       env={"APP_URL": "https://evil.example", "PATH": "/usr/bin:/bin"},
                       capture_output=True, text=True, cwd="/app/backend")
    assert r.returncode == 0 and "OK" in r.stdout, r.stderr[-300:]


def test_email_failures_are_recorded_not_swallowed():
    """Delivery failures must land in email_events with a failure_reason (admin-visible)."""
    db = pymongo.MongoClient(benv["MONGO_URL"])[benv["DB_NAME"]]
    ev = db.email_events.find_one({"status": "failed", "failure_reason": {"$ne": None}},
                                  sort=[("created_at", -1)])
    assert ev is not None, "no failed events recorded despite invalid preview key"
    assert "401" in ev["failure_reason"] or "HTTP" in ev["failure_reason"]
    # secrets never leak into stored failure reasons
    assert "re_" not in ev["failure_reason"].replace("resend", "")


def test_verification_flow_reaches_email_service():
    """Register → an email_events row must exist for the verify_email template."""
    import uuid
    email = f"delivered+{uuid.uuid4().hex[:6]}@resend.dev"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!48", "name": "Pipeline Probe",
        "date_of_birth": "1990-01-01", "accept_policies": True})
    assert r.status_code == 200, r.text
    import time
    db = pymongo.MongoClient(benv["MONGO_URL"])[benv["DB_NAME"]]
    ev = None
    for _ in range(10):
        ev = db.email_events.find_one({"to_email": email, "template": "verify_email"})
        if ev:
            break
        time.sleep(1)
    db.users.delete_one({"email": email})
    assert ev is not None, "verification flow never reached the email service"
    assert ev["status"] in ("sent", "failed", "queued")  # 'failed'/'queued' acceptable in preview (no valid key, retries)

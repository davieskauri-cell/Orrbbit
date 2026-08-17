"""Iteration 42 — credential annual-review lifecycle + mode isolation (backend units)."""
import os
import sys
import uuid
import requests
from datetime import datetime, timezone, timedelta

sys.path.insert(0, "/app/backend")
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _iso(days_from_now: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_from_now)).date().isoformat()


def test_effective_expiry_doc_expiry_precedes_24mo_cap():
    from server import _effective_expiry
    sub = {"credential_verified_at": datetime.now(timezone.utc).isoformat(),
           "documents": [{"expiry_date": _iso(240)}]}  # ~8 months — earlier than 24-month cap
    assert _effective_expiry(sub) == _iso(240)


def test_effective_expiry_caps_at_24_months_without_doc_expiry():
    from server import _effective_expiry
    approved = datetime.now(timezone.utc)
    sub = {"credential_verified_at": approved.isoformat(), "documents": []}
    assert _effective_expiry(sub) == (approved + timedelta(days=730)).date().isoformat()


def test_effective_expiry_uses_earliest_of_multiple_docs():
    from server import _effective_expiry
    sub = {"credential_verified_at": datetime.now(timezone.utc).isoformat(),
           "documents": [{"expiry_date": _iso(600)}, {"expiry_date": _iso(90)}]}
    assert _effective_expiry(sub) == _iso(90)


def test_ping_generation_blocked_in_professional_mode():
    """Mode isolation: People recommendations must not be generated in Professional Mode."""
    r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
    t = r.json()["access_token"]
    h = {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
    try:
        requests.put(f"{API}/users/me/mode", json={"app_mode": "professional"}, headers=h)
        for _ in range(3):
            res = requests.post(f"{API}/pings/generate", params={"lat": -37.8136, "lng": 144.9631}, headers=h).json()
            assert res["ping"] is None, "People ping generated while in Professional Mode"
    finally:
        requests.put(f"{API}/users/me/mode", json={"app_mode": "people"}, headers=h)


def test_annual_review_fields_in_owner_status():
    """Owner verification status exposes credential lifecycle dates (never to public users)."""
    import pymongo
    import pytest
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    c = pymongo.MongoClient(env["MONGO_URL"])
    db = c[env["DB_NAME"]]
    sub = db.verification_submissions.find_one({"status": "Approved"})
    if not sub:
        pytest.skip("no approved submission in this environment")
    owner = db.users.find_one({"id": sub["user_id"]})
    c.close()
    r = requests.post(f"{API}/auth/login", json={"email": owner["email"], "password": "Intro123!"})
    if r.status_code != 200:
        pytest.skip("owner is not a demo account with the standard password")
    t = r.json()["access_token"]
    st = requests.get(f"{API}/verification/status", headers={"Authorization": f"Bearer {t}"}).json()
    assert "credential_next_review_at" in st and "credential_effective_expiry" in st and "review_due" in st

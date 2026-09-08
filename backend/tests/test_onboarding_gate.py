"""Targeted QA — onboarding enforcement (Iter78).

Backend source-of-truth flags used by the frontend gates:
- email_verified must stay False until actually verified (no bypass)
- profile_required_complete False until ALL required fields done
"""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"
MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]

TAG = uuid.uuid4().hex[:8]
EMAIL = f"qa.gate.{TAG}@example.com"
PHOTO = "https://randomuser.me/api/portraits/women/44.jpg"


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def account():
    r = requests.post(f"{API}/auth/register", json={
        "email": EMAIL, "password": "Password123!", "name": "QA Gate Private",
        "display_name": "GateQA", "date_of_birth": "1992-03-03",
        "accept_policies": True, "marketing_opt_in": False,
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    uid = data["user"]["id"]
    DB.users.delete_many({"id": uid})
    DB.consent_records.delete_many({"user_id": uid})
    DB.email_deliveries.delete_many({"to_email": EMAIL})
    DB.analytics_events.delete_many({"user_id": uid})


def test_new_account_is_unverified_and_incomplete(account):
    u = account["user"]
    assert u["email_verified"] is False          # verification gate holds
    assert u["profile_required_complete"] is False  # profile gate holds


def test_me_reflects_backend_verification_only(account):
    tok = account["access_token"]
    r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30)
    assert r.json()["email_verified"] is False
    # simulate the user clicking the email link (DB-level, as the link handler does)
    DB.users.update_one({"id": account["user"]["id"]}, {"$set": {"email_verified": True}})
    r2 = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=30)
    assert r2.json()["email_verified"] is True
    assert r2.json()["profile_required_complete"] is False  # still gated on profile


def test_profile_complete_flips_flag(account):
    tok = account["access_token"]
    r = requests.put(f"{API}/users/me", json={
        "display_name": "GateQA",
        "bio": "QA bio long enough to satisfy the forty character requirement easily.",
        "interests": ["Coffee", "Music", "Tech"],
        "city": "Melbourne",
        "photos": [PHOTO, PHOTO],
    }, headers=_hdr(tok), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["profile_required_complete"] is True


def test_demo_user_never_gated():
    r = requests.post(f"{API}/auth/demo-login", json={}, timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["profile_required_complete"] is True

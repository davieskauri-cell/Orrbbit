"""Iter79 — demo reset with live-feel events + display names."""
import os
import uuid

import requests
from pymongo import MongoClient

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"
MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def test_demo_events_visible_to_demo_user_only():
    r = requests.post(f"{API}/auth/demo-login", json={"email": "demo@intro.demo"}, timeout=30)
    tok = r.json()["access_token"]
    ev = requests.get(f"{API}/events/nearby", params={"lat": -37.8136, "lng": 144.9631},
                      headers=_hdr(tok), timeout=30).json()["events"]
    demo_titles = {e["title"] for e in ev}
    assert "Startup Founders Meetup" in demo_titles, demo_titles
    assert len(ev) >= 7
    # host shows public display name and realistic going counts
    music = next(e for e in ev if e["title"].startswith("Live Music"))
    assert music["host"]["name"] == "Jake"
    assert music["going"] >= 10
    assert music["status"] == "active"
    # persona attends the coffee catch-up
    coffee = next(e for e in ev if "Coffee & Co-work" in e["title"])
    assert coffee["my_status"] == "accepted"
    # a LIVE (non-demo) user must not see demo events
    email = f"qa.ev79.{uuid.uuid4().hex[:8]}@example.com"
    reg = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Password123!", "name": "QA Live", "display_name": "QALive",
        "date_of_birth": "1991-01-01", "accept_policies": True}, timeout=30).json()
    DB.users.update_one({"id": reg["user"]["id"]}, {"$set": {"email_verified": True}})
    live_ev = requests.get(f"{API}/events/nearby", params={"lat": -37.8136, "lng": 144.9631},
                           headers=_hdr(reg["access_token"]), timeout=30).json()["events"]
    assert not any(t in {e["title"] for e in live_ev} for t in demo_titles)
    DB.users.delete_many({"email": email})
    DB.consent_records.delete_many({"user_id": reg["user"]["id"]})
    DB.email_deliveries.delete_many({"to_email": email})


def test_demo_profiles_have_display_names():
    r = requests.post(f"{API}/auth/demo-login", json={"email": "demo@intro.demo"}, timeout=30)
    assert r.json()["user"]["display_name"] == "Alex"
    tok = r.json()["access_token"]
    nearby = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631},
                          headers=_hdr(tok), timeout=30).json()["users"]
    assert len(nearby) >= 20
    assert all(u.get("name") for u in nearby)
    missing = DB.users.count_documents({"is_demo": True, "display_name": {"$in": [None, ""]}})
    assert missing == 0, f"{missing} demo users missing display_name"


def test_demo_reset_endpoint_reseeds_events():
    tok = requests.post(f"{API}/auth/demo-login", json={"email": "demo@intro.demo"}, timeout=30).json()["access_token"]
    r = requests.post(f"{API}/demo/reset", headers=_hdr(tok), timeout=60)
    assert r.status_code == 200, r.text
    assert r.json()["counts"]["events"] == 7
    ev = requests.get(f"{API}/events/nearby", params={"lat": -37.8136, "lng": 144.9631},
                      headers=_hdr(tok), timeout=30).json()["events"]
    assert len(ev) >= 7

"""Targeted QA — Sign-up Display Name (public) vs Full Name (private).

Covers: registration with display_name, own_user exposure (Profile Setup prefill),
Edit Profile update, public surfaces (nearby, pings info, event host), legacy fallback.
Cleans up all QA data afterwards.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE}/api"

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]

TAG = uuid.uuid4().hex[:8]
A_EMAIL = f"qa.dn.a.{TAG}@example.com"
B_EMAIL = f"qa.dn.b.{TAG}@example.com"
LAT, LNG = -37.8136, 144.9631
PHOTO = "https://randomuser.me/api/portraits/men/11.jpg"


def _register(email, name, display_name=None):
    body = {
        "email": email, "password": "Password123!", "name": name,
        "date_of_birth": "1990-01-01", "accept_policies": True, "marketing_opt_in": False,
    }
    if display_name is not None:
        body["display_name"] = display_name
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def _make_discoverable(uid):
    DB.users.update_one({"id": uid}, {"$set": {
        "email_verified": True, "photos": [PHOTO] * 3, "photo_url": PHOTO,
        "bio": "QA bio long enough to pass the forty character discoverability gate.",
        "interests": ["Coffee", "Music", "Tech"], "lat": LAT, "lng": LNG,
        "visible": True, "vibe": "open_to_chat",
    }})


@pytest.fixture(scope="module")
def accounts():
    a = _register(A_EMAIL, "Alexander Fullname-Private", "KauriQA")
    b = _register(B_EMAIL, "Bella Legacy Fullname")  # no display_name → legacy behaviour
    _make_discoverable(a["user"]["id"])
    _make_discoverable(b["user"]["id"])
    yield a, b
    # ---- cleanup all QA data ----
    ids = [a["user"]["id"], b["user"]["id"]]
    DB.users.delete_many({"id": {"$in": ids}})
    DB.consent_records.delete_many({"user_id": {"$in": ids}})
    DB.events.delete_many({"creator_user_id": {"$in": ids}})
    DB.event_attendees.delete_many({"user_id": {"$in": ids}})
    DB.email_deliveries.delete_many({"to_email": {"$in": [A_EMAIL, B_EMAIL]}})
    DB.notifications.delete_many({"user_id": {"$in": ids}})
    DB.analytics_events.delete_many({"user_id": {"$in": ids}})


def test_register_stores_display_name(accounts):
    a, _ = accounts
    assert a["user"]["display_name"] == "KauriQA"      # session payload → Profile Setup prefill
    assert a["user"]["name"] == "Alexander Fullname-Private"
    doc = DB.users.find_one({"id": a["user"]["id"]})
    assert doc["display_name"] == "KauriQA"


def test_me_exposes_display_name_for_prefill(accounts):
    a, _ = accounts
    r = requests.get(f"{API}/auth/me", headers=_hdr(a["access_token"]), timeout=30)
    assert r.status_code == 200
    assert r.json()["display_name"] == "KauriQA"


def test_legacy_register_without_display_name(accounts):
    _, b = accounts
    assert b["user"]["display_name"] is None
    assert b["user"]["name"] == "Bella Legacy Fullname"


def test_public_nearby_uses_display_name_and_legacy_fallback(accounts):
    a, b = accounts
    # B looks at nearby → A must appear as "KauriQA", never the private full name
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG},
                     headers=_hdr(b["access_token"]), timeout=30)
    assert r.status_code == 200
    users = {u["id"]: u for u in r.json()["users"]}
    assert a["user"]["id"] in users, "QA user A not discoverable"
    assert users[a["user"]["id"]]["name"] == "KauriQA"
    assert "Fullname-Private" not in str(users[a["user"]["id"]])
    # A looks at nearby → legacy B (no display_name) falls back to full name safely
    r2 = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG},
                      headers=_hdr(a["access_token"]), timeout=30)
    users2 = {u["id"]: u for u in r2.json()["users"]}
    assert b["user"]["id"] in users2
    assert users2[b["user"]["id"]]["name"] == "Bella Legacy Fullname"


def test_edit_profile_updates_display_name(accounts):
    a, b = accounts
    r = requests.put(f"{API}/users/me", json={"display_name": "KauriQA2"},
                     headers=_hdr(a["access_token"]), timeout=30)
    assert r.status_code == 200
    assert r.json()["display_name"] == "KauriQA2"
    # public surface reflects the update
    r2 = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG},
                      headers=_hdr(b["access_token"]), timeout=30)
    users = {u["id"]: u for u in r2.json()["users"]}
    assert users[a["user"]["id"]]["name"] == "KauriQA2"
    # private full name untouched
    doc = DB.users.find_one({"id": a["user"]["id"]})
    assert doc["name"] == "Alexander Fullname-Private"


def test_event_host_shows_display_name(accounts):
    a, b = accounts
    start = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    r = requests.post(f"{API}/events", json={
        "title": f"QA DN Event {TAG}", "category": "Social",
        "lat": LAT, "lng": LNG, "location_display": "QA area",
        "start_datetime": start, "end_datetime": end,
    }, headers=_hdr(a["access_token"]), timeout=30)
    assert r.status_code == 200, r.text
    ev_id = r.json()["event"]["id"] if "event" in r.json() else r.json()["id"]
    r2 = requests.get(f"{API}/events/nearby", params={"lat": LAT, "lng": LNG},
                      headers=_hdr(b["access_token"]), timeout=30)
    assert r2.status_code == 200
    evs = {e["id"]: e for e in r2.json()["events"]}
    assert ev_id in evs
    assert evs[ev_id]["host"]["name"] == "KauriQA2"
    assert "Fullname-Private" not in str(evs[ev_id]["host"])

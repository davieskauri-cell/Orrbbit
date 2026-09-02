"""Iter59 — People Mode vibe expansion.

New vibes (new_friends, going_out, events, new_to_area, travelling), Gym Buddy →
Activity Buddy relabel on the same key (zero-migration backwards compatibility),
Exploring + Busy moved under "More Options" (extra flag), COMPAT matching and
ping titles for new vibes.
"""
import uuid

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"
db = pymongo.MongoClient(benv["MONGO_URL"])[benv["DB_NAME"]]

NEW_KEYS = ["new_friends", "going_out", "events", "new_to_area", "travelling"]
LAT, LNG = -37.8136, 144.9631


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _register(tag):
    email = f"iter59-{tag}-{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!59x", "name": f"Iter59 {tag}",
        "date_of_birth": "1994-04-04", "accept_policies": True, "city": "Melbourne"}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    tok = r.json().get("access_token") or r.json().get("token")
    uid = r.json()["user"]["id"]
    db.users.update_one({"id": uid}, {"$set": {
        "email_verified": True, "lat": LAT, "lng": LNG, "visible": True,
        "photos": ["data:image/png;base64,x"] * 3,
        "bio": "B" * 45, "interests": ["Coffee", "Music", "Sport"]}})
    return tok, uid


@pytest.fixture(scope="module")
def cleanup():
    yield
    db.users.delete_many({"email": {"$regex": "^iter59-"}})


def test_vibes_payload_new_options_and_flags(cleanup):
    vs = requests.get(f"{API}/vibes", timeout=15).json()
    keys = {v["key"]: v for v in vs}
    for k in NEW_KEYS:
        assert k in keys, f"missing new vibe {k}"
        v = keys[k]
        assert v["color"].startswith("#") and v["icon"] and v["ping_title"] and v["action"]
    # Activity Buddy keeps original key (no data migration needed)
    assert keys["gym_buddy"]["label"] == "Activity Buddy"
    assert keys["gym_buddy"]["description"] == "Train, run or play together"
    # Exploring + Busy live under More Options; Busy retains its status role
    assert keys["exploring"].get("extra") is True
    assert keys["busy"].get("extra") is True
    # legacy hidden vibe never appears
    assert "opportunity" not in keys


def test_new_vibe_selectable_and_persists(cleanup):
    tok, uid = _register("sel")
    for k in NEW_KEYS:
        r = requests.put(f"{API}/users/me/state", headers=_h(tok), json={"vibe": k}, timeout=15)
        assert r.status_code == 200, f"{k}: {r.text[:150]}"
        assert r.json()["vibe"] == k
    # invalid vibe still rejected
    r = requests.put(f"{API}/users/me/state", headers=_h(tok), json={"vibe": "not_a_vibe"}, timeout=15)
    assert r.status_code in (400, 422)


def test_new_vibes_align_in_discovery(cleanup):
    """Two users on new vibes see each other as compatible via COMPAT."""
    t1, u1 = _register("nf1")
    t2, u2 = _register("nf2")
    requests.put(f"{API}/users/me/state", headers=_h(t1), json={"vibe": "new_friends"}, timeout=15)
    requests.put(f"{API}/users/me/state", headers=_h(t2), json={"vibe": "travelling"}, timeout=15)
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(t1), timeout=15)
    assert r.status_code == 200
    row = next((u for u in r.json()["users"] if u["id"] == u2), None)
    assert row is not None, "travelling user not visible to new_friends user"
    assert row["compatible"] is True


def test_existing_gym_buddy_user_untouched(cleanup):
    """Existing gym_buddy selection keeps working and now displays as Activity Buddy."""
    tok, uid = _register("gb")
    r = requests.put(f"{API}/users/me/state", headers=_h(tok), json={"vibe": "gym_buddy"}, timeout=15)
    assert r.status_code == 200 and r.json()["vibe"] == "gym_buddy"
    # stored key unchanged in DB (no migration)
    assert db.users.find_one({"id": uid})["vibe"] == "gym_buddy"
    # compat still includes gym_buddy<->gym_buddy
    t2, u2 = _register("gb2")
    requests.put(f"{API}/users/me/state", headers=_h(t2), json={"vibe": "gym_buddy"}, timeout=15)
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(tok), timeout=15)
    row = next((u for u in r.json()["users"] if u["id"] == u2), None)
    assert row is not None and row["compatible"] is True


def test_ping_uses_new_vibe_title(cleanup):
    """Pings generated between new-vibe users carry the new vibe's ping title."""
    t1, u1 = _register("p1")
    t2, u2 = _register("p2")
    # isolate in a unique city so the nearest compatible candidate is deterministic
    db.users.update_many({"id": {"$in": [u1, u2]}}, {"$set": {"city": "Iter59ville"}})
    requests.put(f"{API}/users/me/state", headers=_h(t1), json={"vibe": "going_out"}, timeout=15)
    requests.put(f"{API}/users/me/state", headers=_h(t2), json={"vibe": "going_out"}, timeout=15)
    r = requests.post(f"{API}/pings/generate", params={"lat": LAT, "lng": LNG}, headers=_h(t1), timeout=15)
    assert r.status_code == 200, r.text[:200]
    ping = r.json().get("ping")
    assert ping is not None, "no ping generated between compatible going_out users"
    assert "go out" in (ping.get("title") or ""), ping.get("title")

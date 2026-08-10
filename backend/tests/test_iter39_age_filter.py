"""Iteration 39 — People Mode Age Preference filter.

Covers: default broad range, strict boundaries, expansion fallback, under-18 hard
exclusion, block/radius interplay, DOB privacy, persistence, validation clamping,
Professional Mode independence, and demo DOB/age consistency.

Test users are isolated in a dedicated city so demo/live data never pollutes counts.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta, date

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
CITY = f"AgeTestville-{uuid.uuid4().hex[:6]}"
LAT, LNG = -37.8136, 144.9631
PASSWORD = "Passw0rd!23"


def _dob_for_age(age: int) -> str:
    d = datetime.now(timezone.utc).date() - timedelta(days=182)
    try:
        return d.replace(year=d.year - age).isoformat()
    except ValueError:
        return d.replace(month=3, day=1, year=d.year - age).isoformat()


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(age: int, name: str):
    email = f"iter39_{name.lower()}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": PASSWORD, "name": name,
        "date_of_birth": _dob_for_age(age), "accept_policies": True, "city": CITY,
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _set_state(token, **fields):
    r = requests.put(f"{API}/users/me/state", json=fields, headers=_h(token))
    assert r.status_code == 200, r.text
    return r.json()


def _nearby(token):
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(token))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def world():
    """Viewer + candidates at known ages, all in an isolated city at the same spot."""
    viewer_token, viewer = _register(30, "Viewer")
    _set_state(viewer_token, lat=LAT, lng=LNG, visible=True)
    candidates = {}
    for age, name in [(20, "Amy"), (24, "Ben"), (25, "Cara"), (30, "Dan"),
                      (35, "Eve"), (36, "Fred"), (50, "Gina")]:
        t, u = _register(age, name)
        _set_state(t, lat=LAT, lng=LNG, visible=True)
        candidates[age] = u
    yield viewer_token, viewer, candidates
    # restore viewer prefs so no cross-test bleed
    _set_state(viewer_token, people_min_age=18, people_max_age=65, people_allow_age_expansion=True)


def _ages_of(res, candidates):
    ids = {u["id"]: age for age, u in candidates.items()}
    return {ids[r["id"]]: r for r in res["users"] if r["id"] in ids}


# ---------------- default / broad range ----------------
def test_default_broad_range_includes_all_adults(world):
    token, viewer, candidates = world
    assert viewer["people_min_age"] == 18 and viewer["people_max_age"] == 65
    assert viewer["people_allow_age_expansion"] is True
    res = _nearby(token)
    got = _ages_of(res, candidates)
    assert set(got) == {20, 24, 25, 30, 35, 36, 50}
    assert all(not r.get("outside_age_preference") for r in got.values())


def test_18_year_old_can_appear(world):
    token, _, _ = world
    t18, u18 = _register(18, "Teen18")
    _set_state(t18, lat=LAT, lng=LNG, visible=True)
    res = _nearby(token)
    assert any(r["id"] == u18["id"] for r in res["users"])


# ---------------- strict boundaries ----------------
def test_strict_25_35_boundaries(world):
    token, _, candidates = world
    _set_state(token, people_min_age=25, people_max_age=35, people_allow_age_expansion=False)
    got = _ages_of(_nearby(token), candidates)
    assert 25 in got and 30 in got and 35 in got  # inclusive boundaries
    assert 24 not in got and 36 not in got and 20 not in got and 50 not in got
    assert all(not r.get("outside_age_preference") for r in got.values())


def test_strict_mode_never_flags_outside(world):
    token, _, _ = world
    _set_state(token, people_min_age=25, people_max_age=35, people_allow_age_expansion=False)
    res = _nearby(token)
    assert all(not r.get("outside_age_preference") for r in res["users"])


# ---------------- expansion fallback ----------------
def test_expansion_adds_limited_marked_profiles(world):
    token, _, candidates = world
    _set_state(token, people_min_age=33, people_max_age=34, people_allow_age_expansion=True)
    res = _nearby(token)
    got = _ages_of(res, candidates)
    # nobody is 33–34 → conservative fallback band (30–37) may add up to 3
    flagged = {age: r for age, r in got.items() if r.get("outside_age_preference")}
    assert flagged, "expansion should add nearby profiles slightly outside the range"
    assert len(flagged) <= 3
    assert set(flagged) <= {30, 35, 36}  # never 20/24/25/50
    assert 50 not in got and 20 not in got


def test_expansion_disabled_is_strict(world):
    token, _, candidates = world
    _set_state(token, people_min_age=33, people_max_age=34, people_allow_age_expansion=False)
    got = _ages_of(_nearby(token), candidates)
    assert got == {}


def test_expansion_not_used_when_enough_results(world):
    token, _, candidates = world
    _set_state(token, people_min_age=18, people_max_age=40, people_allow_age_expansion=True)
    got = _ages_of(_nearby(token), candidates)
    assert 50 not in got  # enough in-range results → no expansion needed
    assert all(not r.get("outside_age_preference") for r in got.values())


# ---------------- under-18 hard exclusion ----------------
def test_under_18_never_appears(world):
    token, _, _ = world
    import pymongo
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    client = pymongo.MongoClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]
    uid = str(uuid.uuid4())
    db.users.insert_one({
        "id": uid, "email": f"iter39_minor_{uid[:8]}@example.com", "name": "Minor",
        "age": 17, "date_of_birth": _dob_for_age(17), "hashed_password": "x",
        "city": CITY, "lat": LAT, "lng": LNG, "visible": True, "is_demo": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        _set_state(token, people_min_age=18, people_max_age=65, people_allow_age_expansion=True)
        res = _nearby(token)
        assert all(r["id"] != uid for r in res["users"])
    finally:
        db.users.delete_one({"id": uid})
        client.close()


# ---------------- blocks / radius still enforced ----------------
def test_blocked_user_excluded_regardless_of_age(world):
    token, _, candidates = world
    _set_state(token, people_min_age=18, people_max_age=65, people_allow_age_expansion=True)
    target = candidates[30]
    r = requests.post(f"{API}/blocks", json={"user_id": target["id"]}, headers=_h(token))
    assert r.status_code == 200, r.text
    got = _ages_of(_nearby(token), candidates)
    assert 30 not in got and 25 in got


def test_radius_still_enforced(world):
    token, _, _ = world
    t_far, u_far = _register(30, "Faraway")
    _set_state(t_far, lat=LAT + 0.005, lng=LNG, visible=True)  # ~550 m away
    _set_state(token, radius=250)
    res = _nearby(token)
    assert all(r["id"] != u_far["id"] for r in res["users"])


# ---------------- validation & persistence ----------------
def test_min_above_max_is_clamped(world):
    token, _, _ = world
    u = _set_state(token, people_min_age=40, people_max_age=30)
    assert u["people_min_age"] <= u["people_max_age"]
    u = _set_state(token, people_min_age=5, people_max_age=99)
    assert u["people_min_age"] == 18 and u["people_max_age"] == 65


def test_preferences_persist_and_survive_relogin(world):
    _, _, _ = world
    t, u = _register(28, "Persist")
    _set_state(t, people_min_age=22, people_max_age=44, people_allow_age_expansion=False,
               relationship_age_prompt_seen=True)
    r = requests.post(f"{API}/auth/login", json={"email": u["email"], "password": PASSWORD})
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=_h(r.json()["access_token"])).json()
    assert me["people_min_age"] == 22 and me["people_max_age"] == 44
    assert me["people_allow_age_expansion"] is False
    assert me["relationship_age_prompt_seen"] is True


# ---------------- DOB privacy ----------------
def test_dob_never_exposed(world):
    token, _, _ = world
    _set_state(token, people_min_age=18, people_max_age=65)
    assert "date_of_birth" not in str(_nearby(token))
    me = requests.get(f"{API}/auth/me", headers=_h(token)).json()
    assert "date_of_birth" not in me
    demo = requests.get(f"{API}/demo-accounts").json()
    assert "date_of_birth" not in str(demo)


# ---------------- Professional Mode independence ----------------
def test_professional_discovery_ignores_age_preference():
    r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    original = r.json()["user"]
    try:
        base = requests.get(f"{API}/professionals", params={"lat": LAT, "lng": LNG}, headers=_h(token)).json()
        _set_state(token, people_min_age=25, people_max_age=26, people_allow_age_expansion=False)
        narrowed = requests.get(f"{API}/professionals", params={"lat": LAT, "lng": LNG}, headers=_h(token)).json()
        assert len(narrowed["professionals"]) == len(base["professionals"])
        assert "date_of_birth" not in str(narrowed)
    finally:
        _set_state(token, people_min_age=original.get("people_min_age", 18),
                   people_max_age=original.get("people_max_age", 65),
                   people_allow_age_expansion=original.get("people_allow_age_expansion", True))


# ---------------- demo data consistency ----------------
def test_demo_dob_matches_displayed_age():
    import pymongo
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    client = pymongo.MongoClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]
    checked = 0
    ages_seen = set()
    for u in db.users.find({"is_demo": True, "date_of_birth": {"$exists": True}}):
        dob = date.fromisoformat(u["date_of_birth"])
        today = datetime.now(timezone.utc).date()
        calc = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        assert calc == u["age"], f"{u['email']}: dob age {calc} != displayed {u['age']}"
        assert calc >= 18
        ages_seen.add(calc)
        checked += 1
    client.close()
    assert checked >= 50, "demo users should have consistent DOBs seeded"
    # demo ages must span distinct adult age groups (20s → 60s)
    assert any(a >= 55 for a in ages_seen) and any(a <= 24 for a in ages_seen)


# ---------------- analytics privacy ----------------
def test_analytics_props_sanitized(world):
    token, _, _ = world
    r = requests.post(f"{API}/analytics", headers=_h(token), json={
        "event": "age_filter_applied",
        "props": {"min_age": 25, "max_age": 35, "expansion_enabled": True,
                  "date_of_birth": "1990-01-01", "lat": -37.8},
    })
    assert r.status_code == 200
    import pymongo
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    client = pymongo.MongoClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]
    ev = db.analytics_events.find_one({"event": "age_filter_applied"}, sort=[("created_at", -1)])
    client.close()
    assert ev["props"].get("min_age") == 25
    assert "date_of_birth" not in ev["props"] and "lat" not in ev["props"]

"""Iteration 40 — Rich profile experience.

Covers: discoverability gate (3 photos / 40-char bio / verified email), About fields +
sanitisation, prompts (max 3, 180 chars, HTML stripped), photo add/remove/reorder,
mutual interests, calculated display age, demo gallery consistency, professional
portfolio, DOB privacy.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
CITY = f"ProfileTestville-{uuid.uuid4().hex[:6]}"
LAT, LNG = -37.8136, 144.9631
PASSWORD = "Passw0rd!23"
IMG = "https://picsum.photos/seed/iter40-%s/400/400"


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _register(name, age=30):
    d = datetime.now(timezone.utc).date() - timedelta(days=182)
    dob = d.replace(year=d.year - age).isoformat()
    r = requests.post(f"{API}/auth/register", json={
        "email": f"iter40_{name.lower()}_{uuid.uuid4().hex[:8]}@example.com",
        "password": PASSWORD, "name": name, "date_of_birth": dob,
        "accept_policies": True, "city": CITY,
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _db():
    import pymongo
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    c = pymongo.MongoClient(env["MONGO_URL"])
    return c, c[env["DB_NAME"]]


def _verify_email(user_id):
    c, db = _db()
    db.users.update_one({"id": user_id}, {"$set": {"email_verified": True}})
    c.close()


def _nearby(t):
    r = requests.get(f"{API}/nearby", params={"lat": LAT, "lng": LNG}, headers=_h(t))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------- discoverability gate ----------------
def test_incomplete_profile_hidden_then_visible_when_complete():
    vt, _ = _register("Viewer")
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(vt))
    ct, cu = _register("Cand")
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(ct))
    # new account: 0 photos, no bio, unverified email → not discoverable
    assert all(u["id"] != cu["id"] for u in _nearby(vt)["users"])
    me = requests.get(f"{API}/auth/me", headers=_h(ct)).json()
    assert me["people_discoverable"] is False
    comp = requests.get(f"{API}/users/me/completion", headers=_h(ct)).json()
    assert comp["discoverable"] is False and len(comp["missing"]) == 3
    # add 3 photos + 40-char bio + verified email → discoverable
    r = requests.put(f"{API}/users/me", headers=_h(ct), json={
        "photos": [IMG % i for i in range(3)],
        "bio": "Marketing person who loves golf, coffee and discovering Melbourne live music.",
    })
    assert r.status_code == 200, r.text
    _verify_email(cu["id"])
    me = requests.get(f"{API}/auth/me", headers=_h(ct)).json()
    assert me["people_discoverable"] is True
    assert any(u["id"] == cu["id"] for u in _nearby(vt)["users"])


def test_one_photo_not_enough_two_is():
    vt, _ = _register("Viewer2")
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(vt))
    ct, cu = _register("TwoPhotos")
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(ct))
    requests.put(f"{API}/users/me", headers=_h(ct), json={
        "photos": [IMG % "a"],
        "bio": "A long enough bio that easily satisfies the forty character requirement here.",
    })
    _verify_email(cu["id"])
    # 1 photo → not discoverable
    assert all(u["id"] != cu["id"] for u in _nearby(vt)["users"])
    # 2 photos → discoverable (iter42: minimum reduced from 3 to 2)
    requests.put(f"{API}/users/me", headers=_h(ct), json={"photos": [IMG % "a", IMG % "b"]})
    assert any(u["id"] == cu["id"] for u in _nearby(vt)["users"])
    # deleting back to 1 removes full discoverability again
    requests.put(f"{API}/users/me", headers=_h(ct), json={"photos": [IMG % "a"]})
    assert all(u["id"] != cu["id"] for u in _nearby(vt)["users"])


# ---------------- rich profile fields + sanitisation ----------------
@pytest.fixture(scope="module")
def rich_user():
    t, u = _register("Rich", age=28)
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(t))
    r = requests.put(f"{API}/users/me", headers=_h(t), json={
        "photos": [IMG % i for i in range(6)],
        "bio": "Originally from Auckland, now in Melbourne. Marketing, golf and live music." ,
        "city": CITY, "country": "Australia",
        "home_city": "Auckland, New Zealand",
        "occupation": "Marketing", "education": "University of Auckland", "languages": "English",
        "interests": ["Golf", "Coffee", "Business", "Music"],
        "prompts": [
            {"prompt": "Ask me about...", "answer": "Starting a business while working full-time."},
            {"prompt": "My ideal weekend is...", "answer": "Golf then good food."},
        ],
    })
    assert r.status_code == 200, r.text
    _verify_email(u["id"])
    return t, requests.get(f"{API}/auth/me", headers=_h(t)).json()


def test_about_fields_saved(rich_user):
    _, me = rich_user
    assert me["home_city"] == "Auckland, New Zealand"
    assert me["occupation"] == "Marketing" and me["education"] == "University of Auckland"
    assert me["languages"] == "English" and me["city"] == CITY
    assert len(me["photos"]) == 6 and len(me["prompts"]) == 2
    assert me["photo_url"] == me["photos"][0]


def test_photos_capped_at_6(rich_user):
    t, _ = rich_user
    r = requests.post(f"{API}/users/me/photos", headers=_h(t), json={"photo_url": IMG % "extra"})
    me = requests.get(f"{API}/auth/me", headers=_h(t)).json()
    assert len(me["photos"]) <= 6


def test_bio_capped_and_html_stripped(rich_user):
    t, _ = rich_user
    r = requests.put(f"{API}/users/me", headers=_h(t), json={
        "bio": "<script>alert(1)</script>Hello " + "x" * 600,
        "occupation": "<b>Engineer</b>",
    })
    me = r.json()
    assert "<script>" not in me["bio"] and "<b>" not in (me["occupation"] or "")
    assert len(me["bio"]) <= 500
    # restore
    requests.put(f"{API}/users/me", headers=_h(t), json={
        "bio": "Originally from Auckland, now in Melbourne. Marketing, golf and live music.",
        "occupation": "Marketing"})


def test_prompts_max_3_and_answer_capped(rich_user):
    t, _ = rich_user
    r = requests.put(f"{API}/users/me", headers=_h(t), json={"prompts": [
        {"prompt": f"Ask me about... {i}", "answer": "a" * 400} for i in range(5)
    ]})
    me = r.json()
    assert len(me["prompts"]) == 3
    assert all(len(p["answer"]) <= 180 for p in me["prompts"])
    requests.put(f"{API}/users/me", headers=_h(t), json={"prompts": [
        {"prompt": "Ask me about...", "answer": "Starting a business while working full-time."}]})


def test_photo_reorder_updates_primary(rich_user):
    t, _ = rich_user
    me = requests.get(f"{API}/auth/me", headers=_h(t)).json()
    reordered = me["photos"][1:] + me["photos"][:1]
    r = requests.put(f"{API}/users/me", headers=_h(t), json={"photos": reordered})
    me2 = r.json()
    assert me2["photos"][0] == reordered[0] and me2["photo_url"] == reordered[0]


def test_photo_delete_endpoint(rich_user):
    t, _ = rich_user
    before = requests.get(f"{API}/auth/me", headers=_h(t)).json()["photos"]
    r = requests.delete(f"{API}/users/me/photos/1", headers=_h(t))
    assert r.status_code == 200, r.text
    after = requests.get(f"{API}/auth/me", headers=_h(t)).json()["photos"]
    assert len(after) == len(before) - 1


# ---------------- nearby payload: rich data + mutual interests ----------------
def test_nearby_payload_rich_fields_and_mutuals(rich_user):
    rt, ru = rich_user
    vt, _ = _register("Viewer3", age=29)
    requests.put(f"{API}/users/me/state", json={"lat": LAT, "lng": LNG, "visible": True}, headers=_h(vt))
    requests.put(f"{API}/users/me", headers=_h(vt), json={"interests": ["Golf", "Coffee", "Hiking"]})
    found = [u for u in _nearby(vt)["users"] if u["id"] == ru["id"]]
    assert found, "rich user should be discoverable"
    p = found[0]
    assert p["home_city"] == "Auckland, New Zealand"
    assert p["occupation"] == "Marketing" and p["joined"]
    assert len(p["photos"]) >= 3 and len(p["prompts"]) >= 1
    assert set(p["mutual_interests"]) == {"Golf", "Coffee"}
    assert "date_of_birth" not in str(p)
    assert p["age"] == 28  # calculated from DOB


# ---------------- professional portfolio ----------------
def test_professional_portfolio_saved_and_public():
    r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
    t = r.json()["access_token"]
    prof = requests.get(f"{API}/professional/profile/me", headers=_h(t)).json().get("profile")
    if not prof:
        pytest.skip("demo user has no professional profile")
    prof.pop("user_id", None); prof.pop("is_draft", None); prof.pop("updated_at", None)
    prof.pop("created_at", None); prof.pop("demo", None); prof.pop("demo_env", None)
    prof["portfolio_photos"] = [IMG % "p1", IMG % "p2"]
    r = requests.post(f"{API}/professional/profile", headers=_h(t),
                      json={k: v for k, v in prof.items() if v is not None})
    assert r.status_code == 200, r.text
    assert len(r.json()["portfolio_photos"]) == 2


# ---------------- demo galleries ----------------
def test_demo_accounts_have_3_photo_galleries_and_rich_profiles():
    c, db = _db()
    emails = ["kauri@intro.demo", "james@intro.demo", "sarah@intro.demo", "olivia@intro.demo",
              "jake@intro.demo", "mia@intro.demo", "liam@intro.demo", "sophie@intro.demo",
              "ryan@intro.demo", "emily@intro.demo"]
    core = list(db.users.find({"email": {"$in": emails}}))
    assert len(core) == 10
    for u in core:
        assert len(u.get("photos", [])) >= 3, f"{u['email']} has {len(u.get('photos', []))} photos"
        assert all(p.startswith("/api/demo-assets/") for p in u["photos"]), u["email"]
        assert u.get("home_city"), u["email"]
        assert len(u.get("bio", "")) >= 40, u["email"]
        assert u.get("email_verified") is True, u["email"]
    with_prompts = [u for u in core if u.get("prompts")]
    assert len(with_prompts) >= 8
    c.close()


def test_demo_variant_assets_exist():
    import os as _os
    for a in ("kauri", "mia", "sophie", "emily"):
        for i in (2, 3):
            assert _os.path.isfile(f"/app/backend/static/demo-assets/{a}{i}.jpg"), f"{a}{i} missing"

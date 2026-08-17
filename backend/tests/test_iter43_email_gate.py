"""Iteration 43 — mandatory email verification hard gate."""
import os, uuid, requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _register():
    email = f"iter43_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!23", "name": "Gate",
        "date_of_birth": "1995-01-01", "accept_policies": True})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def test_unverified_blocked_from_protected_apis():
    t, u = _register()
    assert u["email_verified"] is False
    for path in ("/nearby?lat=-37.8&lng=144.9", "/pings", "/users/me/state", "/professionals?lat=-37.8&lng=144.9"):
        r = requests.get(f"{API}{path}", headers=_h(t)) if "state" not in path else \
            requests.put(f"{API}{path}", json={"visible": True}, headers=_h(t))
        assert r.status_code == 403, f"{path} -> {r.status_code}"
        assert r.json()["detail"] == "EMAIL_VERIFICATION_REQUIRED"


def test_unverified_can_access_allowed_surfaces():
    t, _ = _register()
    assert requests.get(f"{API}/auth/me", headers=_h(t)).status_code == 200
    assert requests.post(f"{API}/email/resend-verification", headers=_h(t), json={}).status_code == 200
    assert requests.get(f"{API}/vibes").status_code == 200


def test_change_unverified_email_and_duplicate_rejected():
    t, u = _register()
    new = f"iter43_new_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/email/change-unverified", headers=_h(t), json={"new_email": new})
    assert r.status_code == 200 and r.json()["email"] == new
    me = requests.get(f"{API}/auth/me", headers=_h(t)).json()
    assert me["email"] == new and me["email_verified"] is False
    r = requests.post(f"{API}/email/change-unverified", headers=_h(t), json={"new_email": "kauri@intro.demo"})
    assert r.status_code == 400  # already used by another account


def test_verification_unlocks_access():
    import pymongo
    from dotenv import dotenv_values
    t, u = _register()
    env = dotenv_values("/app/backend/.env")
    c = pymongo.MongoClient(env["MONGO_URL"])
    c[env["DB_NAME"]].users.update_one({"id": u["id"]}, {"$set": {"email_verified": True}})
    c.close()
    r = requests.get(f"{API}/nearby", params={"lat": -37.8, "lng": 144.9}, headers=_h(t))
    assert r.status_code == 200


def test_verify_link_pages_branded():
    r = requests.get(f"{API}/email/verify", params={"token": "garbage"})
    assert r.status_code == 200
    assert "verification link has expired" in r.text and "orrbbit-logo" in r.text
    assert "Traceback" not in r.text and "JWT" not in r.text


def test_demo_accounts_unaffected():
    r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
    t = r.json()["access_token"]
    assert requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631}, headers=_h(t)).status_code == 200


def test_resend_rate_limited():
    t, _ = _register()
    codes = [requests.post(f"{API}/email/resend-verification", headers=_h(t), json={}).status_code
             for _ in range(8)]
    assert 429 in codes or codes.count(200) <= 6  # backend cap enforced

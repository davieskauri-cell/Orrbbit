"""Iter43 extra coverage — additional review-request assertions."""
import os, uuid, requests, pymongo
from dotenv import dotenv_values

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _register():
    email = f"iter43x_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!23", "name": "Extra",
        "date_of_birth": "1994-04-04", "accept_policies": True})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"], email


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def _mark_verified(user_id: str, val=True):
    env = dotenv_values("/app/backend/.env")
    c = pymongo.MongoClient(env["MONGO_URL"])
    c[env["DB_NAME"]].users.update_one({"id": user_id}, {"$set": {"email_verified": val}})
    c.close()


# BACKEND 1 extension — /verification/status is also gated
def test_verification_status_is_gated():
    t, _, _ = _register()
    r = requests.get(f"{API}/verification/status", headers=_h(t))
    assert r.status_code == 403, r.text
    assert r.json()["detail"] == "EMAIL_VERIFICATION_REQUIRED"


# BACKEND 2 extension — email preferences allowed; DELETE not blocked
def test_email_preferences_allowed_while_unverified():
    t, _, _ = _register()
    r = requests.get(f"{API}/users/me/email-preferences", headers=_h(t))
    assert r.status_code == 200, r.text


def test_account_deletion_not_gated_for_unverified():
    t, u, _ = _register()
    # Should NOT return 403 EMAIL_VERIFICATION_REQUIRED — deletion is exempt
    r = requests.request(
        "DELETE", f"{API}/users/me",
        headers=_h(t),
        json={"password": "Passw0rd!23", "confirmation": "DELETE"},
    )
    assert r.status_code in (200, 204), f"expected success, got {r.status_code}: {r.text}"
    # If gate had blocked, we'd have gotten 403 with EMAIL_VERIFICATION_REQUIRED
    assert "EMAIL_VERIFICATION_REQUIRED" not in r.text


# BACKEND 3 extension — exact 5-then-429 shape
def test_resend_exact_five_then_429():
    t, _, _ = _register()
    codes = []
    for _ in range(8):
        codes.append(requests.post(f"{API}/email/resend-verification",
                                   headers=_h(t), json={}).status_code)
    # First 5 must be 200
    assert codes[:5] == [200, 200, 200, 200, 200], codes
    # At least one of the last 3 must be 429
    assert 429 in codes[5:], codes


# BACKEND 3 extension — change-unverified consumes the same hourly cap
def test_change_unverified_consumes_same_bucket():
    t, _, _ = _register()
    # burn 4 resends
    for _ in range(4):
        assert requests.post(f"{API}/email/resend-verification", headers=_h(t), json={}).status_code == 200
    # change-unverified counts as the 5th
    new_email = f"iter43x_ch_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/email/change-unverified", headers=_h(t),
                      json={"new_email": new_email})
    assert r.status_code == 200, r.text
    # Next resend should now be 429
    r2 = requests.post(f"{API}/email/resend-verification", headers=_h(t), json={})
    assert r2.status_code == 429, f"expected 429, got {r2.status_code}: {r2.text}"


# BACKEND 4 extension — changing email never sets verified
def test_change_email_never_sets_verified():
    t, u, _ = _register()
    new_email = f"iter43x_nv_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/email/change-unverified", headers=_h(t),
                      json={"new_email": new_email})
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=_h(t)).json()
    assert me["email"] == new_email
    assert me["email_verified"] is False


# BACKEND 6 extension — logo <img> present, not just string, and no leaks
def test_verify_page_html_shape():
    r = requests.get(f"{API}/email/verify", params={"token": "garbage"})
    assert r.status_code == 200
    body = r.text
    assert "verification link has expired" in body
    assert "<img" in body and "orrbbit-logo" in body
    for leak in ("Traceback", "JWT", "SECRET", "pymongo"):
        assert leak not in body, f"leaked {leak}"


# BACKEND 8 — discovery exclusion at query level
def test_unverified_user_hidden_from_nearby():
    # unverified spectator
    t_spec, u_spec, _ = _register()
    _mark_verified(u_spec["id"], True)  # verify spectator so they can query

    # put spectator visible + at fixed loc
    requests.put(f"{API}/users/me/state", headers=_h(t_spec),
                 json={"visible": True, "radius_m": 500}).raise_for_status()
    # nudge location via /users/me/location if endpoint exists (best-effort)
    requests.put(f"{API}/users/me/location", headers=_h(t_spec),
                 json={"lat": -37.8136, "lng": 144.9631})

    # create UNVERIFIED user co-located; make them visible via direct DB set as gate blocks state PUT
    t_ghost, u_ghost, _ = _register()
    env = dotenv_values("/app/backend/.env")
    c = pymongo.MongoClient(env["MONGO_URL"])
    c[env["DB_NAME"]].users.update_one(
        {"id": u_ghost["id"]},
        {"$set": {"visible": True, "location": {"type": "Point", "coordinates": [144.9631, -37.8136]},
                  "last_seen": __import__("datetime").datetime.utcnow()}},
    )
    c.close()

    r = requests.get(f"{API}/nearby", params={"lat": -37.8136, "lng": 144.9631, "radius_m": 500},
                     headers=_h(t_spec))
    assert r.status_code == 200, r.text
    body = r.json()
    people = body.get("people") or body.get("users") or body if isinstance(body, list) else body.get("people", [])
    if isinstance(body, dict) and "people" not in body and "users" not in body:
        # tolerate any shape
        people = []
        for k, v in body.items():
            if isinstance(v, list):
                people = v; break
    ids = {p.get("id") or p.get("user_id") for p in people}
    assert u_ghost["id"] not in ids, f"unverified user leaked into /nearby: {ids}"


# BACKEND 9 — admin verification filters + funnel
def _admin_login():
    r = requests.post(f"{API}/control/auth/login",
                      json={"email": "qa-admin@intro.control",
                            "password": "QawqvEcQ-eOdWT!7"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _ah(t):
    return {"Authorization": f"Bearer {t}", "X-Admin-Mode": "live",
            "Content-Type": "application/json"}


def test_admin_users_status_filters():
    tok = _admin_login()

    r1 = requests.get(f"{API}/control/users", params={"status": "unverified_email", "limit": 25},
                      headers=_ah(tok))
    assert r1.status_code == 200, r1.text
    for u in (r1.json().get("users") or r1.json().get("items") or []):
        assert u.get("email_verified") is not True, u
        # tokens/hashes must not leak
        for bad in ("verification_token", "email_verify_token", "password_hash", "password"):
            assert bad not in u, f"leaked field {bad}"

    r2 = requests.get(f"{API}/control/users", params={"status": "verified_email", "limit": 25},
                      headers=_ah(tok))
    assert r2.status_code == 200
    for u in (r2.json().get("users") or r2.json().get("items") or []):
        assert u.get("email_verified") is True, u


def test_admin_email_stats_funnel():
    tok = _admin_login()
    r = requests.get(f"{API}/control/email/stats", headers=_ah(tok))
    assert r.status_code == 200, r.text
    body = r.json()
    funnel = body.get("verification_funnel") or body.get("funnel") or {}
    assert funnel, f"missing verification_funnel in {list(body)}"
    for key in ("total_users", "verified", "unverified", "verification_rate",
                "verify_emails_sent", "verified_last_7d"):
        assert key in funnel, f"missing {key} in {funnel}"

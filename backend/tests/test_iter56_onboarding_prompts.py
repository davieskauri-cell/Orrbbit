"""Iter56 — Onboarding conversation prompts reuse.

Verifies the Profile Setup flow can save prompts through the same
`prompts` field used by Edit Profile, that they round-trip via /users/me,
appear on the public profile, and remain OPTIONAL (never block onboarding).
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

PROMPT = {"prompt": "My ideal weekend is...", "answer": "Coffee, a hike, then live music."}


@pytest.fixture(scope="module")
def user():
    email = f"iter56-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!56x", "name": "Iter56 Probe",
        "date_of_birth": "1992-02-02", "accept_policies": True}, timeout=15)
    assert r.status_code in (200, 201), r.text[:200]
    tok = r.json().get("access_token") or r.json().get("token")
    db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    yield email, tok
    db.users.delete_many({"email": {"$regex": "^iter56-"}})


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_onboarding_save_without_prompts_is_not_blocked(user):
    """Profile setup payload with NO prompts must succeed (prompts optional)."""
    _, tok = user
    r = requests.put(f"{API}/users/me", headers=_h(tok), json={
        "display_name": "Iter56", "city": "Melbourne", "bio": "B" * 45,
        "interests": ["Coffee", "Hiking", "Live music"]}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    assert r.json().get("prompts") in (None, [])


def test_onboarding_prompts_round_trip(user):
    """Prompts saved during setup appear in /users/me (same data Edit Profile loads)."""
    _, tok = user
    r = requests.put(f"{API}/users/me", headers=_h(tok), json={"prompts": [PROMPT]}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    me = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=15).json()
    assert me["prompts"] == [PROMPT]


def test_prompt_visible_on_public_profile(user):
    """The same prompt is served on the public person profile payload.
    Uses a second viewer account since /people/{id} enforces discovery rules."""
    email, tok = user
    uid = db.users.find_one({"email": email})["id"]
    # Make the probe user discoverable in Melbourne CBD
    db.users.update_one({"email": email}, {"$set": {
        "lat": -37.8136, "lng": 144.9631, "vibe": "social", "visible": True,
        "photos": ["data:image/png;base64,x"] * 3}})
    viewer_email = f"iter56-viewer-{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": viewer_email, "password": "Passw0rd!56v", "name": "Iter56 Viewer",
        "date_of_birth": "1993-03-03", "accept_policies": True}, timeout=15)
    vtok = r.json().get("access_token") or r.json().get("token")
    db.users.update_one({"email": viewer_email}, {"$set": {
        "email_verified": True, "lat": -37.8137, "lng": 144.9632,
        "vibe": "social", "visible": True}})
    r = requests.get(f"{API}/people/{uid}", headers=_h(vtok), timeout=15)
    assert r.status_code == 200, r.text[:200]
    assert r.json().get("prompts") == [PROMPT]


def test_completion_marks_prompt_optional(user):
    """Completion checklist includes the prompt item as done but NOT required."""
    _, tok = user
    r = requests.get(f"{API}/users/me/completion", headers=_h(tok), timeout=15)
    assert r.status_code == 200, r.text[:200]
    items = r.json().get("items") or r.json().get("checklist") or []
    row = next((i for i in items if i.get("key") == "prompt"), None)
    assert row is not None
    assert row.get("required") is False
    assert row.get("done") is True

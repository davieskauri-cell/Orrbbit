"""Iteration 44 — Save Vibe Details root cause + banned-terms word-boundary fix.

Root cause of "Save Vibe Details does nothing": the banned-content filter used
substring matching, so innocent text like "looking for something serious"
(so-METH-ing) or "begun" (be-GUN) returned 400 — which the app swallowed
silently. These tests lock in whole-word matching + end-to-end persistence.
"""
import uuid

import pytest
import requests
from dotenv import dotenv_values

env = dotenv_values("/app/frontend/.env")
API = f"{env['EXPO_PUBLIC_BACKEND_URL']}/api"


@pytest.fixture(scope="module")
def fresh_user(verify_email):
    email = f"test_iter44_{uuid.uuid4().hex[:10]}@example.com"
    password = "Passw0rd!44"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "Iter44 Tester",
        "date_of_birth": "1992-07-07", "accept_policies": True,
    })
    assert r.status_code == 200, r.text
    verify_email(email)
    return r.json()["access_token"], email, password


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestBannedTermsWordBoundary:
    def test_something_serious_is_allowed(self, fresh_user):
        tok, _, _ = fresh_user
        r = requests.put(f"{API}/users/me/vibe-details", headers=_h(tok), json={
            "details": {"looking_for": "Something serious", "context": "Looking for something serious",
                        "intent": "Open to a relationship", "visibility": "public"}})
        assert r.status_code == 200, f"'something' wrongly banned: {r.text}"
        assert r.json()["vibe_details"]["context"] == "Looking for something serious"

    def test_other_innocent_substrings_allowed(self, fresh_user):
        tok, _, _ = fresh_user
        for text in ("I've begun a new chapter", "A methodical planner", "Fun in the sun with my segundo"):
            r = requests.put(f"{API}/users/me/vibe-details", headers=_h(tok),
                             json={"details": {"context": text, "visibility": "public"}})
            assert r.status_code == 200, f"innocent text '{text}' blocked: {r.text}"

    def test_real_banned_words_still_blocked(self, fresh_user):
        tok, _, _ = fresh_user
        for text in ("selling a gun", "get rich quick offer", "guaranteed returns on crypto"):
            r = requests.put(f"{API}/users/me/vibe-details", headers=_h(tok),
                             json={"details": {"context": text, "visibility": "public"}})
            assert r.status_code == 400, f"banned text '{text}' was allowed"
            assert "aren't allowed" in r.json()["detail"]


class TestVibeDetailsPersistence:
    def test_save_persists_and_survives_relogin(self, fresh_user):
        tok, email, password = fresh_user
        details = {
            "availability": "Available now",
            "intent_strength": "Open if the vibe is right",
            "visibility": "public",
            "context": "Looking for something serious",
        }
        r = requests.put(f"{API}/users/me/vibe-details", headers=_h(tok), json={"details": details})
        assert r.status_code == 200, r.text
        # persisted on the returned user
        vd = r.json()["vibe_details"]
        for k, v in details.items():
            assert vd.get(k) == v, f"{k} not persisted in response"
        # survives re-login (fresh token, fresh DB read)
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
        assert r2.status_code == 200, r2.text
        tok2 = r2.json()["access_token"]
        me = requests.get(f"{API}/auth/me", headers=_h(tok2))
        assert me.status_code == 200
        vd2 = me.json().get("vibe_details") or {}
        for k, v in details.items():
            assert vd2.get(k) == v, f"{k} lost after re-login"

    def test_empty_values_stripped(self, fresh_user):
        tok, _, _ = fresh_user
        r = requests.put(f"{API}/users/me/vibe-details", headers=_h(tok),
                         json={"details": {"context": "", "availability": "Just browsing", "visibility": "public"}})
        assert r.status_code == 200
        vd = r.json()["vibe_details"]
        assert "context" not in vd
        assert vd["availability"] == "Just browsing"


class TestHelpRequestBannedCheck:
    def test_help_request_with_something_allowed(self, fresh_user):
        tok, _, _ = fresh_user
        r = requests.post(f"{API}/help-requests", headers=_h(tok), json={
            "category": "Education", "public_summary": "Need help with something for my maths exam",
            "private_details": "Year 12 methods revision", "payment": "Hourly", "expiry": "24 hours",
            "lat": -37.8136, "lng": 144.9631,
        })
        assert r.status_code == 200, f"innocent help request blocked: {r.text}"

    def test_help_request_banned_still_blocked(self, fresh_user):
        tok, _, _ = fresh_user
        r = requests.post(f"{API}/help-requests", headers=_h(tok), json={
            "category": "Other", "public_summary": "Selling ammunition cheap",
            "private_details": "", "payment": "Hourly", "expiry": "24 hours",
            "lat": -37.8136, "lng": 144.9631,
        })
        assert r.status_code == 400

"""Iteration 45 — Plan experience active, payments not enabled.

Plus/Pro fully visible & selectable; no fake purchases; backend entitlement
authoritative; privacy-safe pre-launch interest endpoint.
"""
import uuid

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"


@pytest.fixture(scope="module")
def fresh_user(verify_email):
    email = f"test_iter45_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!45", "name": "Iter45 Tester",
        "date_of_birth": "1991-01-01", "accept_policies": True,
    })
    assert r.status_code == 200, r.text
    verify_email(email)
    return r.json()["access_token"], r.json()["user"]["id"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestBillingConfig:
    def test_public_user_cannot_purchase(self, fresh_user):
        tok, _ = fresh_user
        r = requests.get(f"{API}/billing/config", headers=_h(tok))
        assert r.status_code == 200
        cfg = r.json()
        assert cfg["sandbox_eligible"] is False  # normal users can never test-purchase
        assert {p["plan"] for p in cfg["products"]} == {"plus", "pro"}

    def test_demo_user_still_sandbox_eligible(self):
        r = requests.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": "Intro123!"})
        assert r.status_code == 200
        cfg = requests.get(f"{API}/billing/config", headers=_h(r.json()["access_token"])).json()
        assert cfg["sandbox_eligible"] is True  # QA/demo preview isolated from public users


class TestPlanInterest:
    def test_plus_and_pro_interest_recorded_idempotently(self, fresh_user):
        tok, uid = fresh_user
        for plan in ("plus", "pro"):
            for _ in range(2):  # double-tap safe
                r = requests.post(f"{API}/billing/interest", headers=_h(tok), json={"plan": plan})
                assert r.status_code == 200, r.text
                assert "let you know" in r.json()["message"]
        c = pymongo.MongoClient(benv["MONGO_URL"])
        docs = list(c[benv["DB_NAME"]].plan_interest.find({"user_id": uid}))
        c.close()
        assert len(docs) == 2  # one per plan, no duplicates
        assert {d["plan"] for d in docs} == {"plus", "pro"}
        # privacy-safe: no email/marketing fields stored
        for d in docs:
            assert "email" not in d and "marketing" not in d

    def test_invalid_plan_rejected(self, fresh_user):
        tok, _ = fresh_user
        r = requests.post(f"{API}/billing/interest", headers=_h(tok), json={"plan": "free"})
        assert r.status_code == 400

    def test_interest_grants_no_entitlement(self, fresh_user):
        tok, _ = fresh_user
        me = requests.get(f"{API}/auth/me", headers=_h(tok)).json()
        assert me.get("plan", "free") == "free"
        sub = requests.get(f"{API}/users/me/subscription", headers=_h(tok)).json()
        assert sub["plan"] == "free"
        assert sub["max_radius_m"] == 250  # backend entitlement authoritative
        assert sub["entitlement"] is None


class TestNoRadiusBypass:
    def test_public_user_sandbox_purchase_blocked(self, fresh_user):
        tok, _ = fresh_user
        r = requests.post(f"{API}/billing/sandbox/purchase", headers=_h(tok),
                          json={"plan": "pro", "platform": "ios"})
        assert r.status_code == 403
        assert "aren't available yet" in r.json()["detail"]

    def test_public_user_cannot_set_paid_radius(self, fresh_user):
        tok, _ = fresh_user
        r = requests.put(f"{API}/users/me/state", headers=_h(tok), json={"radius": 1000})
        # server clamps or rejects — either way effective radius must stay <= 250
        if r.status_code == 200:
            assert r.json().get("radius", 250) <= 250
        else:
            assert r.status_code in (400, 403)

"""
Iteration 92 — First-time guided app tutorial (new personal users only).
Covers: /api/auth/register tutorial_completed default, /api/auth/me serialization,
PUT /api/users/me/state {tutorial_completed:true} persistence, business/demo exclusion.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_BACKEND_URL", os.environ.get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]


def register_personal(email_prefix="TEST_tut"):
    email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Tutorial Tester",
        "email": email,
        "password": "TestPass123!",
        "date_of_birth": "1995-05-05",
        "accept_policies": True,
        "account_type": "personal",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    return email, r


def register_business(email_prefix="TEST_tutbiz"):
    email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Tutorial Biz Tester",
        "email": email,
        "password": "TestPass123!",
        "date_of_birth": "1990-05-05",
        "accept_policies": True,
        "account_type": "business",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    return email, r


def login(email, password="TestPass123!"):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def cleanup_emails():
    emails = []
    yield emails
    if emails:
        db.users.delete_many({"email": {"$in": emails}})


class TestTutorialRegisterDefaults:
    def test_new_personal_user_tutorial_not_completed(self, cleanup_emails):
        email, r = register_personal()
        cleanup_emails.append(email)
        assert r.status_code == 200, r.text
        token = login(email)
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        data = me.json()
        assert data["tutorial_completed"] is False
        assert data["account_type"] == "personal"

    def test_new_business_user_tutorial_already_completed(self, cleanup_emails):
        email, r = register_business()
        cleanup_emails.append(email)
        assert r.status_code == 200, r.text
        token = login(email)
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        data = me.json()
        assert data["tutorial_completed"] is True


class TestTutorialStatePersistence:
    def test_put_state_tutorial_completed_persists(self, cleanup_emails):
        email, r = register_personal()
        cleanup_emails.append(email)
        assert r.status_code == 200
        db.users.update_one({"email": email.lower()}, {"$set": {"email_verified": True}})
        token = login(email)
        headers = {"Authorization": f"Bearer {token}"}

        # before: false
        me_before = requests.get(f"{BASE_URL}/api/auth/me", headers=headers).json()
        assert me_before["tutorial_completed"] is False

        put_resp = requests.put(f"{BASE_URL}/api/users/me/state", json={"tutorial_completed": True}, headers=headers)
        assert put_resp.status_code == 200, put_resp.text
        assert put_resp.json()["tutorial_completed"] is True

        # GET after PUT to verify persistence (simulate app relaunch)
        me_after = requests.get(f"{BASE_URL}/api/auth/me", headers=headers).json()
        assert me_after["tutorial_completed"] is True

    def test_tutorial_completed_never_reverts_on_unrelated_state_update(self, cleanup_emails):
        """Regression: updating other state fields must not accidentally reset
        tutorial_completed back to False."""
        email, r = register_personal()
        cleanup_emails.append(email)
        db.users.update_one({"email": email.lower()}, {"$set": {"email_verified": True}})
        token = login(email)
        headers = {"Authorization": f"Bearer {token}"}
        requests.put(f"{BASE_URL}/api/users/me/state", json={"tutorial_completed": True}, headers=headers)
        # unrelated update
        requests.put(f"{BASE_URL}/api/users/me/state", json={"visible": True}, headers=headers)
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers).json()
        assert me["tutorial_completed"] is True


class TestTutorialDemoAndExistingAccounts:
    def test_existing_demo_account_tutorial_completed_true(self):
        r = requests.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        assert me["tutorial_completed"] is True

    def test_legacy_account_without_field_defaults_true(self, cleanup_emails):
        """Simulate a pre-feature account that has no tutorial_completed key at all
        in mongo — own_user() must default it to True so old users are unaffected."""
        email, r = register_personal()
        cleanup_emails.append(email)
        assert r.status_code == 200
        # strip the field to simulate a legacy doc
        db.users.update_one({"email": email.lower()}, {"$unset": {"tutorial_completed": ""}})
        token = login(email)
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        assert me["tutorial_completed"] is True

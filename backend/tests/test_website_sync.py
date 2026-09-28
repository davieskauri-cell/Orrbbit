"""
Website → mobile-backend business sign-up sync (POST /api/integrations/website/business-signup).
Covers: shared-secret auth, create, idempotent re-run (backfill), reconcile to an account that
already exists via /auth/register (the old 400 "Email already registered" case), Pending Review
visibility in Control Centre → Businesses (status=Pending Review), missing-field handling,
personal-account conflict (409), and that /auth/register itself is unchanged.
"""
import os
import re
import uuid
import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ.get("EXPO_BACKEND_URL", os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001")).rstrip("/")
API = f"{BASE_URL}/api"
ENV = dotenv_values("/app/backend/.env")
SECRET = ENV.get("WEBSITE_SYNC_SECRET") or os.environ.get("WEBSITE_SYNC_SECRET")
DB = MongoClient(ENV.get("MONGO_URL") or os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[
    ENV.get("DB_NAME") or os.environ.get("DB_NAME", "test_database")]
SYNC = f"{API}/integrations/website/business-signup"
HDR = {"X-Website-Secret": SECRET or ""}
TAG = uuid.uuid4().hex[:8]
CREATED = []   # emails to clean up


def _payload(email, name="Davies Foods", **over):
    body = {
        "email": email, "owner_name": "Dai Davies", "password": "WebsitePass123!",
        "date_of_birth": "1985-03-03", "accept_policies": True, "email_verified": True,
        "external_id": f"web-{TAG}",
        "business": {
            "name": name, "category": "Retail", "location_display": "12 Market St, Cardiff",
            "description": "Family grocer", "country": "United Kingdom", "phone": "+44 29 1234 5678",
            "website": "https://daviesfoods.example", "registration_number": "12345678",
            "primary_contact": "Dai Davies",
        },
    }
    body.update(over)
    CREATED.append(email)
    return body


def _admin_token():
    creds = open("/app/memory/test_credentials.md").read()
    m = re.search(r"QA Admin.*?`([^`]+)`\s*/\s*`([^`]+)`", creds)
    r = requests.post(f"{API}/control/auth/login", json={"email": m.group(1), "password": m.group(2)}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    yield
    users = list(DB.users.find({"email": {"$in": [e.lower() for e in CREATED]}}, {"id": 1}))
    ids = [u["id"] for u in users]
    bizs = [b["id"] for b in DB.business_profiles.find({"user_id": {"$in": ids}}, {"id": 1})]
    DB.business_verifications.delete_many({"business_id": {"$in": bizs}})
    DB.business_profiles.delete_many({"user_id": {"$in": ids}})
    DB.consent_records.delete_many({"user_id": {"$in": ids}})
    DB.users.delete_many({"id": {"$in": ids}})


def test_01_auth_required():
    assert SECRET, "WEBSITE_SYNC_SECRET must be set in backend/.env"
    body = _payload(f"TEST_ws_auth_{TAG}@example.com")
    assert requests.post(SYNC, json=body, timeout=30).status_code == 401
    assert requests.post(SYNC, json=body, headers={"X-Website-Secret": "nope"}, timeout=30).status_code == 401


def test_02_create_then_idempotent_rerun_backfill():
    email = f"TEST_ws_create_{TAG}@example.com"
    r = requests.post(SYNC, json=_payload(email), headers=HDR, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["outcome"] == "created" and d["verification_status"] == "Pending Review" and d["submission_id"]
    assert d["missing_for_verification"] == []
    u = DB.users.find_one({"email": email.lower()})
    assert u["account_type"] == "business" and u["email_verified"] is True and u["tutorial_completed"] is True
    biz = DB.business_profiles.find_one({"id": d["business_id"]})
    assert biz["verification_status"] == "Pending Review" and biz["website_external_id"] == f"web-{TAG}"
    assert DB.business_verifications.count_documents({"business_id": biz["id"]}) == 1

    # owner can log into the app with the website password
    login = requests.post(f"{API}/auth/login", json={"email": email, "password": "WebsitePass123!"}, timeout=30)
    assert login.status_code == 200, login.text

    # re-running the same record (backfill job) is a no-op reconcile: no duplicates, same ids
    r2 = requests.post(SYNC, json=_payload(email), headers=HDR, timeout=30)
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["outcome"] == "reconciled" and d2["user_id"] == d["user_id"] and d2["business_id"] == d["business_id"]
    assert d2["verification_status"] == "Pending Review" and d2["submission_id"] == d["submission_id"]
    assert DB.business_verifications.count_documents({"business_id": biz["id"]}) == 1
    assert DB.business_profiles.count_documents({"user_id": d["user_id"]}) == 1


def test_03_reconcile_existing_registered_account_no_400():
    """The old flow died on /auth/register 400 'Email already registered'. The sync must
    reconcile to that account and still land the business in Pending Review."""
    email = f"TEST_ws_existing_{TAG}@example.com"
    CREATED.append(email)
    reg = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "OwnerChosen123!", "name": "Existing Owner", "display_name": "Davies Foods",
        "account_type": "business", "date_of_birth": "1980-01-01", "accept_policies": True}, timeout=30)
    assert reg.status_code == 200, reg.text
    dup = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "OwnerChosen123!", "name": "Existing Owner",
        "account_type": "business", "date_of_birth": "1980-01-01", "accept_policies": True}, timeout=30)
    assert dup.status_code == 400 and dup.json()["detail"] == "Email already registered"   # register unchanged

    before = DB.users.find_one({"email": email.lower()})
    r = requests.post(SYNC, json=_payload(email, password="SomethingElse999!"), headers=HDR, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["outcome"] == "reconciled" and d["user_id"] == reg.json()["user"]["id"]
    assert d["verification_status"] == "Pending Review"
    after = DB.users.find_one({"email": email.lower()})
    assert after["hashed_password"] == before["hashed_password"]          # password never touched
    assert after["email_verified"] is True                                # website verified → reflected

    # Control Centre → Businesses → Pending tab lists it
    tok = _admin_token()
    cc = requests.get(f"{API}/control/businesses", params={"status": "Pending Review"},
                      headers={"Authorization": f"Bearer {tok}"}, timeout=30)
    assert cc.status_code == 200, cc.text
    names = {b["id"]: b for b in cc.json()["businesses"]}
    assert d["business_id"] in names and names[d["business_id"]]["verification_status"] == "Pending Review"
    assert names[d["business_id"]]["owner_email"] == email.lower()


def test_04_missing_fields_saves_profile_without_submitting():
    email = f"TEST_ws_missing_{TAG}@example.com"
    body = _payload(email, name="No Phone Co")
    body["business"]["phone"] = ""
    body["business"]["registration_number"] = ""
    r = requests.post(SYNC, json=body, headers=HDR, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["verification_status"] == "In Progress" and d["submission_id"] is None
    assert "Business phone number" in d["missing_for_verification"]
    assert "Company number" in d["missing_for_verification"]   # UK label
    # completing the record later promotes it to Pending Review
    r2 = requests.post(SYNC, json=_payload(email, name="No Phone Co"), headers=HDR, timeout=30)
    assert r2.json()["verification_status"] == "Pending Review"


def test_05_personal_account_conflict_409():
    email = f"TEST_ws_personal_{TAG}@example.com"
    CREATED.append(email)
    reg = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Personal123!", "name": "Personal Person",
        "account_type": "personal", "date_of_birth": "1990-01-01", "accept_policies": True}, timeout=30)
    assert reg.status_code == 200
    r = requests.post(SYNC, json=_payload(email), headers=HDR, timeout=30)
    assert r.status_code == 409 and r.json()["detail"] == "existing_personal_account"
    assert DB.business_profiles.count_documents({"user_id": reg.json()["user"]["id"]}) == 0


def test_06_lookup():
    email = f"TEST_ws_create_{TAG}@example.com"
    r = requests.get(f"{SYNC}/{email}", headers=HDR, timeout=30)
    assert r.status_code == 200 and r.json()["exists"] is True and r.json()["verification_status"] == "Pending Review"
    r = requests.get(f"{SYNC}/nobody_{TAG}@example.com", headers=HDR, timeout=30)
    assert r.json() == {"exists": False}

"""Iter82 QA seed helper: creates a business user with email_verified=True, seeds
business_profiles with logo/cover so business-setup resumes at step 4 (Verify),
and prints the access_token + user_id so a playwright run can log in via
localStorage.setItem('auth_token', JSON.stringify(token)).
"""
import os, sys, uuid, json, requests
from pymongo import MongoClient

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
DB = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]

TAG = uuid.uuid4().hex[:8]
EMAIL = f"biz-ui-qa-{TAG}@orrbbitqa.example.com"
PWD = "Password123!"

r = requests.post(f"{API}/auth/register", json={
    "email": EMAIL, "password": PWD, "name": "Iter82 QA Biz Owner",
    "display_name": f"BizQA{TAG[:4]}", "account_type": "business",
    "date_of_birth": "1990-01-01", "accept_policies": True,
}, timeout=30)
assert r.status_code == 200, r.text
d = r.json()
uid = d["user"]["id"]
tok = d["access_token"]
DB.users.update_one({"id": uid}, {"$set": {"email_verified": True}})

# Seed business profile via API — logo/cover are required by the UI's step 3 gate,
# but the POST endpoint only requires name/category/email/location/description.
r2 = requests.post(f"{API}/business/me", json={
    "name": f"Iter82 QA Cafe {TAG}", "category": "Café",
    "email": EMAIL, "location_display": "123 Collins St, Melbourne",
    "description": "QA cafe seeded for iter82 UI flow verification testing.",
    "logo_url": "https://picsum.photos/seed/qa82logo/200",
    "cover_url": "https://picsum.photos/seed/qa82cover/800/400",
    "lat": -37.8136, "lng": 144.9631,
    "website": "https://iter82qa.example.com", "phone": "+61 3 9000 0000",
    "country": "Australia", "primary_contact": "Iter82 QA",
}, headers={"Authorization": f"Bearer {tok}"}, timeout=30)
assert r2.status_code == 200, r2.text
biz_id = r2.json()["business"]["id"]

print(json.dumps({"email": EMAIL, "user_id": uid, "access_token": tok, "biz_id": biz_id, "tag": TAG}))

import os, sys, requests, base64
from pymongo import MongoClient

BASE = "https://nearby-connect-93.preview.emergentagent.com/api"
EMAIL = "biz-visual-qa@orrbbitqa.example.com"
PW = "VisualQa123!"

def main(stage):
    m = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = m[os.environ.get("DB_NAME", "test_database")]
    if stage == "create":
        r = requests.post(f"{BASE}/auth/register", json={
            "name": "Parker Davies", "display_name": "Park Hotel", "email": EMAIL,
            "password": PW, "account_type": "business", "date_of_birth": "1990-01-01",
            "accept_policies": True, "marketing_opt_in": False, "platform": "web",
            "app_version": "1.0.0", "locale": "en"})
        print("register:", r.status_code)
        db.users.update_one({"email": EMAIL}, {"$set": {"email_verified": True}})
        tok = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
        # tiny 1x1 png data uri
        px = "data:image/png;base64," + base64.b64encode(base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")).decode()
        r = requests.post(f"{BASE}/business/me", headers={"Authorization": f"Bearer {tok}"}, json={
            "name": "The Park Hotel", "category": "Hotel", "email": EMAIL,
            "location_display": "12 Collins St, Sydney NSW", "description": "A boutique hotel hosting community events in the heart of Sydney.",
            "logo_url": px, "cover_url": px, "lat": -33.8688, "lng": 151.2093,
            "website": "", "phone": "+61 2 9000 0000", "country": "Australia",
            "primary_contact": "Parker Davies", "registration_number": "12 345 678 901"})
        print("business:", r.status_code, r.json().get("business", {}).get("verification_status"))
        print("TOKEN:", tok)
    elif stage == "verify":
        tok = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
        r = requests.post(f"{BASE}/business/me/verification", headers={"Authorization": f"Bearer {tok}"}, json={
            "legal_name": "The Park Hotel Pty Ltd", "country": "Australia", "abn": "12 345 678 901",
            "email": EMAIL, "phone": "+61 2 9000 0000", "website": "", "address": "12 Collins St, Sydney NSW",
            "primary_contact": "Parker Davies", "document_name": "registration.pdf, address-proof.pdf"})
        print("verification:", r.status_code)
    elif stage == "subscribe":
        tok = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
        r = requests.post(f"{BASE}/business/subscription/activate", headers={"Authorization": f"Bearer {tok}"}, json={"platform": "sandbox"})
        print("subscribe:", r.status_code)
    elif stage == "approve":
        a = requests.post(f"{BASE}/control/auth/login", json={"email": "qa-admin@intro.control", "password": "Qa!hpgOlIndvj0UbVWk"}).json()
        atok = a["token"]
        biz = db.business_profiles.find_one({"email": EMAIL})
        r = requests.post(f"{BASE}/control/businesses/{biz['id']}/verification",
                          headers={"Authorization": f"Bearer {atok}"}, json={"action": "approve", "note": "Visual QA"})
        print("approve:", r.status_code, r.json().get("status"))
    elif stage == "event":
        tok = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
        from datetime import datetime, timedelta, timezone
        start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        end = (datetime.now(timezone.utc) + timedelta(days=2, hours=3)).isoformat()
        r = requests.post(f"{BASE}/events", headers={"Authorization": f"Bearer {tok}"}, json={
            "title": "Friday Happy Hour", "category": "Coffee / Drinks",
            "description": "Live music, canapés and drinks specials at The Park Hotel rooftop bar.",
            "start_datetime": start, "end_datetime": end,
            "location_name": "The Park Hotel Rooftop", "location_display": "12 Collins St, Sydney NSW",
            "lat": -33.8688, "lng": 151.2093, "capacity": 60, "approval_required": False})
        print("event:", r.status_code, r.json() if r.status_code >= 400 else r.json().get("event", {}).get("id"))
    elif stage == "token":
        tok = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PW}).json()["access_token"]
        print(tok)
    elif stage == "clean":
        u = db.users.find_one({"email": EMAIL})
        if u:
            uid = u["id"]
            db.users.delete_one({"id": uid})
            db.business_profiles.delete_many({"owner_id": uid})
            db.business_verifications.delete_many({"owner_id": uid})
            db.business_login_links.delete_many({"user_id": uid})
            db.events.delete_many({"host_id": uid})
            db.notifications.delete_many({"user_id": uid})
            db.consent_records.delete_many({"user_id": uid})
            db.email_events.delete_many({"to": EMAIL})
        print("cleaned")

if __name__ == "__main__":
    main(sys.argv[1])

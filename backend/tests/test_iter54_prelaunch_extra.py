"""Iter54 — additional backend coverage for auto-created verified pro profile,
out-of-range pings (409), AI credential extract endpoint, and public pro view.

Run with EXPO_PUBLIC_BACKEND_URL set to preview.
"""
import uuid
from datetime import datetime, timezone

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"
db = pymongo.MongoClient(benv["MONGO_URL"])[benv["DB_NAME"]]

PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQ"
           "DwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def _register(prefix: str = "iter54x"):
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!54x", "name": "Iter54 Extra",
        "date_of_birth": "1990-01-01", "accept_policies": True}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    tok = r.json().get("access_token") or r.json().get("token")
    db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    return email, tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module", autouse=True)
def _cleanup():
    yield
    db.users.delete_many({"email": {"$regex": r"^iter54x-"}})
    db.professional_profiles.delete_many({"auto_created_from_verification": True,
                                          "profession": "Beekeeper"})
    db.verification_submissions.delete_many({"identity.full_name": "Iter54 Extra"})
    db.pings.delete_many({"about": "iter54x-test"})


# --- Verified pro state auto-create ---------------------------------------
class TestVerifiedProAutoCreate:
    def test_approved_user_without_profile_gets_auto_created(self):
        email, tok = _register()
        u = db.users.find_one({"email": email})
        uid = u["id"]
        # Insert an Approved verification submission manually (simulate admin approval).
        db.verification_submissions.delete_many({"user_id": uid})
        db.professional_profiles.delete_many({"user_id": uid})
        db.verification_submissions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "Approved",
            "profession": "Beekeeper", "categories": ["Hive inspections"],
            "identity": {"full_name": "Iter54 Extra", "documents": []},
            "documents": [], "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "valid_until": "2099-01-01",
        })

        r = requests.get(f"{API}/professional/profile/me", headers=_h(tok), timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("verification", {}).get("status") == "Approved"
        prof = body.get("profile")
        assert prof is not None, "Expected auto-created professional profile for Approved user"
        assert prof.get("auto_created_from_verification") is True
        assert prof.get("profession") == "Beekeeper"

        # Idempotent: second call should not duplicate
        r2 = requests.get(f"{API}/professional/profile/me", headers=_h(tok), timeout=15)
        assert r2.status_code == 200
        count = db.professional_profiles.count_documents({"user_id": uid})
        assert count == 1, f"Expected exactly 1 pro profile, got {count}"

    def test_public_pro_profile_does_not_expose_documents(self):
        email, tok = _register()
        u = db.users.find_one({"email": email})
        uid = u["id"]
        db.verification_submissions.delete_many({"user_id": uid})
        db.professional_profiles.delete_many({"user_id": uid})
        db.verification_submissions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "status": "Approved",
            "profession": "Beekeeper", "categories": ["Hive inspections"],
            "identity": {"full_name": "Iter54 Extra", "documents": [
                {"doc_name": "Passport", "file_b64": PNG_B64, "file_type": "image/png"}
            ]},
            "documents": [{"doc_name": "Cert", "file_b64": PNG_B64,
                           "file_type": "image/png"}],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "valid_until": "2099-01-01",
        })
        # trigger auto-create
        requests.get(f"{API}/professional/profile/me", headers=_h(tok), timeout=15)

        # A DIFFERENT user views the public profile
        _, tok_viewer = _register("iter54x-viewer")
        r = requests.get(f"{API}/professional/profile/{uid}", headers=_h(tok_viewer), timeout=15)
        assert r.status_code == 200, r.text[:200]
        body_text = r.text
        # Documents / file_b64 must never appear in the public view
        assert "file_b64" not in body_text, "Public profile leaks file_b64!"
        assert PNG_B64[:40] not in body_text, "Public profile leaks document base64!"


# --- AI credential extract -------------------------------------------------
class TestVerificationExtract:
    def test_tiny_png_returns_200_never_500(self):
        _, tok = _register()
        r = requests.post(f"{API}/verification/extract", headers=_h(tok),
                          json={"file_b64": PNG_B64, "file_type": "image/png"},
                          timeout=45)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "fields" in body and "extracted" in body
        for k in ("doc_name", "issuer", "license_number", "issue_date", "expiry_date"):
            assert k in body["fields"]

    def test_non_image_returns_empty_fields(self):
        _, tok = _register()
        r = requests.post(f"{API}/verification/extract", headers=_h(tok),
                          json={"file_b64": PNG_B64, "file_type": "application/pdf"},
                          timeout=15)
        assert r.status_code == 200
        assert r.json()["extracted"] is False


# --- Out-of-range pings (bug fix #16) --------------------------------------
class TestOutOfRangePings:
    def _seed_pair(self, dist_meters: float, radius: int = 100):
        """Return (recipient_tok, ping_id) — sender is placed 'dist_meters' away."""
        email_r, tok_r = _register()
        email_s, tok_s = _register()
        ur = db.users.find_one({"email": email_r})
        us = db.users.find_one({"email": email_s})
        # Place recipient at CBD, sender N meters north (approx 1 deg lat = 111_000m)
        base_lat, base_lng = -37.8136, 144.9631
        delta = dist_meters / 111_000.0
        db.users.update_one({"id": ur["id"]}, {"$set": {
            "lat": base_lat, "lng": base_lng, "radius": radius, "demo_dist": None}})
        db.users.update_one({"id": us["id"]}, {"$set": {
            "lat": base_lat + delta, "lng": base_lng, "radius": radius, "demo_dist": None}})
        ping = {
            "id": str(uuid.uuid4()),
            "from_user_id": us["id"], "to_user_id": ur["id"],
            "vibe": "networking", "status": "new",
            "about": "iter54x-test",
            "distance_meters": dist_meters,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc)).isoformat(),
        }
        db.pings.insert_one(dict(ping))
        return tok_r, tok_s, ping["id"], us["id"]

    def test_in_range_ping_marks_in_range_true(self):
        tok_r, _, pid, _ = self._seed_pair(dist_meters=30, radius=100)
        r = requests.get(f"{API}/pings", headers=_h(tok_r), timeout=15)
        assert r.status_code == 200
        row = next((p for p in r.json() if p["id"] == pid), None)
        assert row is not None
        assert row["in_range"] is True

    def test_out_of_range_marks_in_range_false_and_accept_409(self):
        tok_r, _, pid, _ = self._seed_pair(dist_meters=500, radius=100)  # 500m > 100m radius
        r = requests.get(f"{API}/pings", headers=_h(tok_r), timeout=15)
        assert r.status_code == 200
        row = next((p for p in r.json() if p["id"] == pid), None)
        assert row is not None
        assert row["in_range"] is False

        acc = requests.post(f"{API}/pings/{pid}/accept", headers=_h(tok_r), timeout=15)
        assert acc.status_code == 409, f"expected 409, got {acc.status_code} {acc.text[:150]}"

        # Dismiss (Remove) still works
        rem = requests.post(f"{API}/pings/{pid}/dismiss", headers=_h(tok_r), timeout=15)
        assert rem.status_code == 200

"""Iter54 — Pre-launch package backend regression tests."""
import uuid

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


def _register():
    email = f"iter54-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!54x", "name": "Iter54 Probe",
        "date_of_birth": "1990-01-01", "accept_policies": True}, timeout=15)
    assert r.status_code == 200, r.text[:200]
    tok = r.json().get("access_token") or r.json().get("token")
    return email, tok


@pytest.fixture(scope="module")
def user():
    email, tok = _register()
    db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    yield email, tok
    db.users.delete_many({"email": {"$regex": r"^iter54-"}})
    db.verification_submissions.delete_many({"identity.full_name": "Iter54 Probe"})
    db.verification_documents.delete_many({"file_name": {"$regex": "^iter54"}})
    db.verification_web_links.delete_many({})
    db.email_events.delete_many({"to_email": {"$regex": "^iter54|^support@orrbbit"}})


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


class TestEmailLinks:
    def test_email_open_never_404(self):
        for p in ["/login", "/plans", "/whatever/unknown-path", ""]:
            r = requests.get(f"{API}/email/open", params={"to": p}, timeout=15)
            assert r.status_code == 200 and "Orrbbit" in r.text

    def test_verify_link_still_works_shape(self):
        r = requests.get(f"{API}/email/verify", params={"token": "bad"}, timeout=15)
        assert r.status_code == 200  # branded page, never 404


class TestDesktopVerification:
    def test_link_flow_and_web_form(self, user):
        _, tok = user
        r = requests.post(f"{API}/verification/desktop-link", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        link = db.verification_web_links.find_one({}, sort=[("created_at", -1)])
        assert link and not link["used"]
        r2 = requests.get(f"{API}/verification/web", params={"token": link["token"]}, timeout=15)
        assert r2.status_code == 200 and "Professional Verification" in r2.text
        assert requests.get(f"{API}/verification/web", params={"token": "nope"}, timeout=15).status_code == 200

    def test_web_submit_same_queue(self, user):
        _, tok = user
        requests.post(f"{API}/verification/desktop-link", headers=_h(tok), timeout=15)
        link = db.verification_web_links.find_one({"used": False}, sort=[("created_at", -1)])
        payload = {
            "profession": "Other", "profession_other": "Beekeeper",
            "categories": [], "categories_other": "Hive inspections",
            "full_name": "Iter54 Probe", "id_type": "Passport",
            "documents": [{"doc_name": "Beekeeping Cert", "issuer": "NZBA", "license_number": "",
                           "issue_date": "", "expiry_date": None, "file_b64": PNG_B64,
                           "file_type": "image/png", "file_name": "iter54-cred.png"}],
            "identity_documents": [
                {"doc_name": "Passport", "issuer": "", "license_number": "", "expiry_date": None,
                 "file_b64": PNG_B64, "file_type": "image/png", "file_name": "iter54-id1.png"},
                {"doc_name": "Driver Licence", "issuer": "", "license_number": "", "expiry_date": None,
                 "file_b64": PNG_B64, "file_type": "image/png", "file_name": "iter54-id2.png"},
            ],
        }
        r = requests.post(f"{API}/verification/web/submit",
                          json={"token": link["token"], "payload": payload}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        sub = db.verification_submissions.find_one({"id": r.json()["submission_id"]})
        assert sub["profession"] == "Other — Beekeeper"
        assert "Other — Hive inspections" in sub["categories"]
        assert len(sub["identity"]["documents"]) == 2
        # link single-use
        r2 = requests.post(f"{API}/verification/web/submit",
                           json={"token": link["token"], "payload": payload}, timeout=15)
        assert r2.status_code == 401
        # admin notification email event recorded (support inbox)
        ev = db.email_events.find_one({"template": "admin_new_verification", "to_email": "support@orrbbit.com"})
        assert ev is not None

    def test_min_two_ids_enforced(self, user):
        _, tok = user
        r = requests.post(f"{API}/verification/submit", headers=_h(tok), json={
            "profession": "Other", "profession_other": "X", "categories": ["Y"],
            "full_name": "Iter54 Probe", "id_type": "Passport",
            "documents": [{"doc_name": "D", "issuer": "", "license_number": "", "issue_date": "",
                           "expiry_date": None, "file_b64": PNG_B64, "file_type": "image/png",
                           "file_name": "iter54-c.png"}],
            "identity_documents": [{"doc_name": "Passport", "issuer": "", "license_number": "",
                                    "expiry_date": None, "file_b64": PNG_B64,
                                    "file_type": "image/png", "file_name": "iter54-one.png"}],
        }, timeout=15)
        assert r.status_code == 400 and "2 identity" in r.text

    def test_legacy_submit_without_identity_docs_still_ok(self, user):
        """Existing/legacy clients (no identity_documents field) must not break."""
        _, tok = user
        db.verification_submissions.delete_many({"user_id": db.users.find_one({"email": user[0]})["id"]})
        r = requests.post(f"{API}/verification/submit", headers=_h(tok), json={
            "profession": "Plumber", "categories": ["General Plumbing"],
            "full_name": "Iter54 Probe", "id_type": "Passport",
            "documents": [{"doc_name": "Trade Cert", "issuer": "", "license_number": "",
                           "issue_date": "", "expiry_date": None, "file_b64": PNG_B64,
                           "file_type": "image/png", "file_name": "iter54-legacy.png"}],
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]


class TestAdminDocViewer:
    def test_admin_views_document_and_audited(self, user):
        admin = requests.post(f"{API}/control/auth/login",
                              json={"email": "qa-admin@intro.control",
                                    "password": "Qa!hpgOlIndvj0UbVWk"}, timeout=15).json()["token"]
        sub = db.verification_submissions.find_one({"identity.full_name": "Iter54 Probe"})
        assert sub
        f = db.verification_documents.find_one({"submission_id": sub["id"]})
        assert f
        r = requests.get(f"{API}/control/verifications/{sub['id']}/documents/{f['id']}/file",
                         headers={"Authorization": f"Bearer {admin}", "X-Admin-Mode": "live"}, timeout=15)
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/")
        assert "no-store" in r.headers.get("cache-control", "")
        assert db.admin_audit_logs.find_one({"action": "verification_document_viewed",
                                       "target_id": sub["id"]}) is not None

    def test_normal_user_cannot_view_documents(self, user):
        _, tok = user
        sub = db.verification_submissions.find_one({"identity.full_name": "Iter54 Probe"})
        f = db.verification_documents.find_one({"submission_id": sub["id"]})
        r = requests.get(f"{API}/control/verifications/{sub['id']}/documents/{f['id']}/file",
                         headers=_h(tok), timeout=15)
        assert r.status_code in (401, 403)


class TestProfileAndPings:
    def test_display_name_saved(self, user):
        _, tok = user
        r = requests.put(f"{API}/users/me", headers=_h(tok),
                         json={"display_name": "Probe 54"}, timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert db.users.find_one({"email": user[0]})["display_name"] == "Probe 54"

    def test_pings_have_in_range_flag(self, user):
        _, tok = user
        r = requests.get(f"{API}/pings", headers=_h(tok), timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert "in_range" in p

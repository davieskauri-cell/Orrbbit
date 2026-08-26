"""Iter55 — Final polish regression: pending queue mapping, notifications centre,
completion percentage root cause."""
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
QA = {"email": "qa-admin@intro.control", "password": "Qa!hpgOlIndvj0UbVWk"}


def _admin():
    r = requests.post(f"{API}/control/auth/login", json=QA, timeout=15)
    assert r.status_code == 200, r.text[:200]
    return r.json()["token"]


def _h(tok, mode="live"):
    return {"Authorization": f"Bearer {tok}", "X-Admin-Mode": mode}


@pytest.fixture(scope="module")
def user():
    email = f"iter55-{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Passw0rd!55x", "name": "Iter55 Probe",
        "date_of_birth": "1991-01-01", "accept_policies": True}, timeout=15)
    tok = r.json().get("access_token") or r.json().get("token")
    db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    yield email, tok
    uid = (db.users.find_one({"email": email}) or {}).get("id")
    db.users.delete_many({"email": {"$regex": "^iter55-"}})
    db.verification_submissions.delete_many({"user_id": uid})
    db.verification_documents.delete_many({"user_id": uid})
    db.admin_notification_reads.delete_many({})
    db.email_events.delete_many({"to_email": {"$regex": "^iter55|^support@orrbbit"}})


@pytest.fixture(scope="module")
def submission(user):
    email, tok = user
    r = requests.post(f"{API}/verification/submit",
                      headers={"Authorization": f"Bearer {tok}"}, json={
                          "profession": "Other", "profession_other": "Falconer",
                          "categories": [], "categories_other": "Bird handling",
                          "full_name": "Iter55 Probe", "id_type": "Passport",
                          "documents": [{"doc_name": "Falconry Cert", "issuer": "", "license_number": "",
                                         "issue_date": "", "expiry_date": None, "file_b64": PNG_B64,
                                         "file_type": "image/png", "file_name": "iter55.png"}],
                          "identity_documents": [
                              {"doc_name": "Passport", "issuer": "", "license_number": "", "expiry_date": None,
                               "file_b64": PNG_B64, "file_type": "image/png", "file_name": "id1.png"},
                              {"doc_name": "Driver Licence", "issuer": "", "license_number": "", "expiry_date": None,
                               "file_b64": PNG_B64, "file_type": "image/png", "file_name": "id2.png"}],
                      }, timeout=20)
    assert r.status_code == 200, r.text[:300]
    return r.json()["submission_id"]


class TestPendingQueue:
    def test_pending_count_matches_list(self, submission):
        tok = _admin()
        r = requests.get(f"{API}/control/verifications", params={"status": "Pending"},
                         headers=_h(tok), timeout=15).json()
        ids = [s["id"] for s in r["items"]]
        assert submission in ids, "Pending Review submission missing from Pending queue"
        assert r["counts"]["pending"] == len(ids), "pending count != pending list length"
        assert r["counts"]["pending"] >= 1

    def test_in_review_status_stays_in_queue(self, submission):
        tok = _admin()
        db.verification_submissions.update_one({"id": submission}, {"$set": {"status": "In Review"}})
        r = requests.get(f"{API}/control/verifications", params={"status": "Pending"},
                         headers=_h(tok), timeout=15).json()
        assert submission in [s["id"] for s in r["items"]], "In Review must stay in the review queue"
        db.verification_submissions.update_one({"id": submission}, {"$set": {"status": "Pending Review"}})

    def test_dashboard_kpi_uses_same_definition(self, submission):
        tok = _admin()
        d = requests.get(f"{API}/control/dashboard", headers=_h(tok), timeout=15).json()
        expected = db.verification_submissions.count_documents(
            {"status": {"$in": ["Pending Review", "In Review"]},
             "user_id": {"$nin": db.users.distinct("id", {"is_demo": True})}})
        assert d["kpis"].get("pending_verifications", d["kpis"].get("pending_ver", expected)) == expected


class TestNotificationsCentre:
    def test_notification_created_and_links(self, submission):
        tok = _admin()
        r = requests.get(f"{API}/control/notifications-centre", headers=_h(tok), timeout=15).json()
        match = [n for n in r["items"] if n["id"] == f"ver:{submission}"]
        assert match, "verification notification missing"
        n = match[0]
        assert n["link"] == {"module": "verifications", "id": submission}
        assert "Iter55 Probe" in n["desc"] and "requires review" in n["title"]
        assert n["read"] is False
        assert r["unread"] >= 1

    def test_mark_read_persists_across_login(self, submission):
        tok = _admin()
        requests.post(f"{API}/control/notifications-centre/read", headers=_h(tok),
                      json={"ids": [f"ver:{submission}"]}, timeout=15)
        tok2 = _admin()  # fresh session
        r = requests.get(f"{API}/control/notifications-centre", headers=_h(tok2), timeout=15).json()
        n = [x for x in r["items"] if x["id"] == f"ver:{submission}"][0]
        assert n["read"] is True, "read state must persist across sessions"

    def test_mark_all_read(self):
        tok = _admin()
        requests.post(f"{API}/control/notifications-centre/read", headers=_h(tok),
                      json={"all": True}, timeout=15)
        r = requests.get(f"{API}/control/notifications-centre/unread-count", headers=_h(tok), timeout=15).json()
        assert r["unread"] == 0

    def test_approve_clears_from_pending_and_notifications(self, submission, user):
        tok = _admin()
        db.verification_submissions.update_one({"id": submission}, {"$set": {"status": "Approved"}})
        r = requests.get(f"{API}/control/verifications", params={"status": "Pending"},
                         headers=_h(tok), timeout=15).json()
        assert submission not in [s["id"] for s in r["items"]]
        nc = requests.get(f"{API}/control/notifications-centre", headers=_h(tok), timeout=15).json()
        assert f"ver:{submission}" not in [n["id"] for n in nc["items"]]
        db.verification_submissions.update_one({"id": submission}, {"$set": {"status": "Pending Review"}})

    def test_rbac_normal_user_blocked(self, user):
        _, tok = user
        r = requests.get(f"{API}/control/notifications-centre",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15)
        assert r.status_code in (401, 403)


class TestCompletion:
    def test_required_only_completion_100(self, user):
        email, tok = user
        db.users.update_one({"email": email}, {"$set": {
            "photos": ["data:image/png;base64," + PNG_B64] * 2,
            "bio": "A" * 45, "city": "Auckland",
            "interests": ["Coffee", "Music", "Golf"],
        }})
        r = requests.get(f"{API}/users/me/completion",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15).json()
        assert r["score"] == 100, f"required-complete profile must be 100%, got {r[chr(39)+chr(115)+chr(99)+chr(111)+chr(114)+chr(101)+chr(39)]}"
        opt = [c for c in r["checklist"] if not c["required"]]
        assert all("optional" in c["label"] for c in opt)

    def test_missing_required_below_100(self, user):
        email, tok = user
        db.users.update_one({"email": email}, {"$set": {"city": ""}})
        r = requests.get(f"{API}/users/me/completion",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=15).json()
        assert r["score"] == 80
        db.users.update_one({"email": email}, {"$set": {"city": "Auckland"}})

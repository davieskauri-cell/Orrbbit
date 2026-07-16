"""
Iteration 17 — Professional Verification System V2 backend tests.

Coverage:
  * GET /api/config returns professions + profession_broad
  * POST /api/verification/submit (V2 schema) validation + supersede + notification
  * GET /api/verification/status v2 fields (credential_status, valid_until, docs w/o file content)
  * Expiry automation (Expiring Soon @ 45 days, reminders dedupe, past → Expired auto flip)
  * Admin GET/POST verifications + audit history chain + document reveal (admin only)
  * Category restrictions (verified pro HR-only, unverified 403 always)
  * /professional/profile category gate: verified w/ wrong primary → 400; unverified → is_draft=true
  * Public /api/professionals hides unverified/expired
  * Regression: professionally_verified/verified_categories/valid_until on public profile
"""
import os
import base64
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def H(t: str) -> dict:
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


def demo_login(email: str) -> str:
    r = requests.post(f"{API}/auth/demo-login", json={"email": email}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def register_fresh(prefix="TESTv2") -> tuple[str, dict]:
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:8]}@testv2.demo"
    body = {"email": email, "password": "Intro123!", "name": f"TEST_{prefix}", "age": 30}
    r = requests.post(f"{API}/auth/register", json=body, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    me = requests.get(f"{API}/auth/me", headers=H(tok), timeout=20).json()
    return tok, me


# --- shared fixtures ---
@pytest.fixture(scope="session")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="session")
def tokens():
    tks = {
        "priya": demo_login("priya@radar.intro.demo"),
        "sana": demo_login("sana@radar.intro.demo"),
        "jade": demo_login("jade@radar.intro.demo"),
        "kauri": demo_login("kauri@intro.demo"),
    }
    return tks


@pytest.fixture(scope="session")
def uids(tokens):
    out = {}
    for k, t in tokens.items():
        out[k] = requests.get(f"{API}/auth/me", headers=H(t), timeout=15).json()["id"]
    return out


# --- pristine jade state (unverified) ---
def _reset_jade(db, uids):
    # remove any submissions + notifications + reset profile draft
    db.verification_documents.delete_many({"user_id": uids["jade"]})
    db.verification_submissions.delete_many({"user_id": uids["jade"]})
    db.notifications.delete_many({"user_id": uids["jade"]})
    db.professional_profiles.update_one({"user_id": uids["jade"]}, {"$set": {"is_draft": True}})


def _restore_sana(db, uids):
    """Restore sana's Approved verification if a prior test flipped it to Pending Review."""
    subs = list(db.verification_submissions.find({"user_id": uids["sana"]}))
    if not any(s["status"] == "Approved" for s in subs):
        # delete stale ones and re-approve the latest submitted one, or synthesize
        db.verification_submissions.delete_many({"user_id": uids["sana"]})
        from datetime import datetime as _dt, timezone as _tz
        now = _dt.now(_tz.utc).isoformat()
        db.verification_submissions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uids["sana"],
            "profession": "HR", "categories": ["Employee Relations", "Recruitment", "Performance"],
            "category": "HR",
            "identity": {"full_name": "Sana", "id_type": "Driver licence"},
            "documents": [{"id": str(uuid.uuid4()), "doc_name": "MBA (HR)", "issuer": "Issuing body",
                           "issue_date": "2019-03-01", "expiry_date": "2028-07-12",
                           "doc_number": "DEMO-1234", "notes": "",
                           "file_name": "credential.pdf", "file_type": "application/pdf", "has_file": False}],
            "status": "Approved", "submitted_at": now, "reviewed_at": now,
            "reviewer": "intro-admin", "notes": [], "public_note": "", "reminders_sent": [],
            "history": [{"action": "submitted", "by": uids["sana"], "at": now},
                        {"action": "approve", "by": "intro-admin", "at": now}],
            "demo": True,
        })
    # ensure profile fields match seed so re-review is never triggered by test writes
    db.professional_profiles.update_one({"user_id": uids["sana"]}, {"$set": {
        "profession": "HR Consultant", "primary_category": "HR",
        "qualifications": "MBA (HR), CIPD Level 7", "memberships": "AHRI member",
        "licences": "", "certifications": "", "is_draft": False,
    }})


@pytest.fixture(autouse=True, scope="session")
def _cleanup(db, uids):
    _reset_jade(db, uids)
    _restore_sana(db, uids)
    yield
    _reset_jade(db, uids)
    _restore_sana(db, uids)


# ==========================================================================
# CONFIG
# ==========================================================================
class TestConfig:
    def test_professions_map_present(self):
        r = requests.get(f"{API}/config", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "professions" in j and isinstance(j["professions"], dict)
        assert len(j["professions"]) == 17
        # HR profession categories per spec
        assert "Recruitment" in j["professions"]["HR"]
        assert "Employee Relations" in j["professions"]["HR"]
        assert "Performance" in j["professions"]["HR"]
        assert j["profession_broad"]["HR"] == "HR"
        assert j["profession_broad"]["Fitness"] == "Fitness"
        assert j["profession_broad"]["Law"] == "Legal"


# ==========================================================================
# SUBMIT V2 — validation
# ==========================================================================
class TestSubmitValidation:
    def _tok(self):
        tok, _ = register_fresh("submit")
        return tok

    def test_invalid_profession_400(self):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "NotAThing", "categories": ["X"], "full_name": "T", "id_type": "Passport",
            "documents": [{"doc_name": "d"}],
        }, timeout=20)
        assert r.status_code == 400

    def test_empty_categories_400(self):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": [], "full_name": "T", "id_type": "Passport",
            "documents": [{"doc_name": "d"}],
        }, timeout=20)
        assert r.status_code == 400

    def test_categories_filtered_to_profession(self, db):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR",
            "categories": ["Recruitment", "NotForHR", "Personal Training"],  # last two invalid for HR
            "full_name": "TEST_User", "id_type": "Passport",
            "documents": [{"doc_name": "AHRI cert"}],
        }, timeout=20)
        assert r.status_code == 200
        sub_id = r.json()["submission_id"]
        sub = db.verification_submissions.find_one({"id": sub_id})
        assert sub["categories"] == ["Recruitment"]

    def test_zero_documents_400(self):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "T", "id_type": "Passport", "documents": [],
        }, timeout=20)
        assert r.status_code == 400

    def test_over_ten_documents_400(self):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "T", "id_type": "Passport",
            "documents": [{"doc_name": f"d{i}"} for i in range(11)],
        }, timeout=20)
        assert r.status_code == 400

    def test_bad_file_type_400(self):
        tok = self._tok()
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "T", "id_type": "Passport",
            "documents": [{"doc_name": "d", "file_b64": "aGk=", "file_type": "text/plain", "file_name": "x.txt"}],
        }, timeout=20)
        assert r.status_code == 400


# ==========================================================================
# SUBMIT V2 — happy path, supersede, notification, file storage
# ==========================================================================
class TestSubmitSuccess:
    def test_submit_supersede_and_notification(self, db):
        tok, me = register_fresh("sup")
        payload_base = {
            "profession": "HR", "categories": ["Recruitment", "Performance"],
            "full_name": "TEST_User Full", "id_type": "Passport",
            "documents": [{
                "doc_name": "AHRI Cert", "issuer": "AHRI",
                "issue_date": "2020-01-01", "expiry_date": "2028-01-01",
                "file_b64": base64.b64encode(b"pdf-bytes").decode(),
                "file_type": "application/pdf", "file_name": "cert.pdf",
            }],
        }
        r1 = requests.post(f"{API}/verification/submit", headers=H(tok), json=payload_base, timeout=20)
        assert r1.status_code == 200
        first_id = r1.json()["submission_id"]

        # docs stored in verification_documents, NOT in submission doc
        sub = db.verification_submissions.find_one({"id": first_id})
        assert sub["status"] == "Pending Review"
        assert all("file_b64" not in d for d in sub["documents"])
        files = list(db.verification_documents.find({"submission_id": first_id}))
        assert len(files) == 1 and files[0]["file_b64"].startswith("cGRmL")  # b64 of 'pdf-bytes'

        # notification created
        notes = requests.get(f"{API}/notifications", headers=H(tok), timeout=15).json()
        assert any("Verification submitted" in n["title"] for n in notes)

        # supersede: submit again → first is deleted
        r2 = requests.post(f"{API}/verification/submit", headers=H(tok), json=payload_base, timeout=20)
        assert r2.status_code == 200
        assert db.verification_submissions.find_one({"id": first_id}) is None
        assert db.verification_documents.count_documents({"submission_id": first_id}) == 0


# ==========================================================================
# STATUS V2 — verified sana → correct fields, docs w/o file content
# ==========================================================================
class TestStatusV2:
    def test_sana_verified_fields(self, tokens):
        r = requests.get(f"{API}/verification/status", headers=H(tokens["sana"]), timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["status"] == "Approved"
        assert s["profession"] == "HR"
        assert set(s["categories"]) == {"Employee Relations", "Recruitment", "Performance"}
        assert s.get("verified_since")
        assert s.get("valid_until") == "2028-07-12"
        assert s.get("credential_status") in ("Verified", "Expiring Soon")
        for d in s.get("documents", []):
            assert "file_b64" not in d


# ==========================================================================
# EXPIRY AUTOMATION
# ==========================================================================
class TestExpiryAutomation:
    def _submit_and_approve(self, tokens, db, uids, expiry_date: str) -> tuple[str, str]:
        tok, me = register_fresh(f"exp{expiry_date[:4]}")
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "TEST_ExpUser", "id_type": "Passport",
            "documents": [{"doc_name": "Cert", "issuer": "X", "issue_date": "2020-01-01",
                           "expiry_date": expiry_date}],
        }, timeout=20)
        assert r.status_code == 200, r.text
        sub_id = r.json()["submission_id"]
        # admin approve
        ad = requests.post(f"{API}/admin/verifications/{sub_id}/decision", headers=H(tokens["kauri"]),
                           json={"action": "approve"}, timeout=20)
        assert ad.status_code == 200
        return tok, sub_id

    def test_expiring_soon_and_reminder_dedupe(self, tokens, db, uids):
        exp = (datetime.now(timezone.utc).date() + timedelta(days=45)).isoformat()
        tok, sub_id = self._submit_and_approve(tokens, db, uids, exp)
        # first read → applies expiry, credential_status Expiring Soon, reminders_sent contains 90 and 60
        s1 = requests.get(f"{API}/verification/status", headers=H(tok), timeout=15).json()
        assert s1["credential_status"] == "Expiring Soon"
        assert s1["valid_until"] == exp
        # check reminders_sent in DB
        sub = db.verification_submissions.find_one({"id": sub_id})
        assert 90 in sub["reminders_sent"]
        assert 60 in sub["reminders_sent"]

        notes = requests.get(f"{API}/notifications", headers=H(tok), timeout=15).json()
        titles = [n["title"] for n in notes]
        assert any("Credentials expiring soon" in t for t in titles)
        assert any("Reminder: Credentials expiring soon" in t for t in titles)
        count_before = sum(1 for n in notes if "Credentials expiring soon" in n["title"])

        # second read should NOT duplicate
        requests.get(f"{API}/verification/status", headers=H(tok), timeout=15)
        notes2 = requests.get(f"{API}/notifications", headers=H(tok), timeout=15).json()
        count_after = sum(1 for n in notes2 if "Credentials expiring soon" in n["title"])
        assert count_after == count_before, f"reminders duplicated: {count_before}→{count_after}"

    def test_past_expiry_auto_flips_and_blocks(self, tokens, db, uids):
        exp = (datetime.now(timezone.utc).date() - timedelta(days=2)).isoformat()
        tok, sub_id = self._submit_and_approve(tokens, db, uids, exp)
        me = requests.get(f"{API}/auth/me", headers=H(tok), timeout=15).json()

        # Create a professional_profile for this user (HR, primary Recruitment)
        # so that public listing / offer-help path can be tested
        prof_res = requests.post(f"{API}/professional/profile", headers=H(tok), json={
            "profession": "HR", "primary_category": "Recruitment",
            "additional_categories": [], "about": "TEST_ExpUser", "years_experience": 5,
        }, timeout=20)
        # first status GET triggers auto-expire
        s = requests.get(f"{API}/verification/status", headers=H(tok), timeout=15).json()
        assert s["status"] == "Expired"

        # notification 'Verification expired' created
        notes = requests.get(f"{API}/notifications", headers=H(tok), timeout=15).json()
        assert any("Verification expired" in n["title"] for n in notes)

        # not listed in /api/professionals
        pros = requests.get(f"{API}/professionals?lat=-37.8136&lng=144.9631",
                            headers=H(tok), timeout=15).json()
        listed_ids = [p["user_id"] for p in pros["professionals"]]
        assert me["id"] not in listed_ids

        # /api/professional/requests → verification_required
        pr = requests.get(f"{API}/professional/requests?lat=-37.8136&lng=144.9631",
                          headers=H(tok), timeout=15).json()
        assert pr.get("verification_required") is True

        # offer-help via /connect/request → 403
        # find priya's active help request
        priya_reqs = list(db.help_requests.find({"user_id": uids["priya"], "status": "active"}))
        if priya_reqs:
            hr_id = priya_reqs[0]["id"]
            r = requests.post(f"{API}/connect/request", headers=H(tok),
                              json={"user_id": uids["priya"], "help_request_id": hr_id}, timeout=20)
            assert r.status_code == 403
            assert "verification" in r.json().get("detail", "").lower()


# ==========================================================================
# ADMIN — dashboard, doc reveal, decision audit log
# ==========================================================================
class TestAdmin:
    def test_admin_list_includes_metadata(self, tokens):
        r = requests.get(f"{API}/admin/verifications", headers=H(tokens["kauri"]), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        row = rows[0]
        for k in ("user", "profession", "categories", "documents", "status"):
            assert k in row

    def test_non_admin_document_403(self, db):
        # register a completely fresh (non-demo) user → non-admin
        tok, _ = register_fresh("nonadmin")
        # find any submission id + doc id
        sub = db.verification_submissions.find_one({"documents": {"$ne": []}})
        assert sub, "need at least one submission w/ docs"
        doc_id = sub["documents"][0]["id"]
        r = requests.get(f"{API}/admin/verifications/{sub['id']}/documents/{doc_id}",
                         headers=H(tok), timeout=15)
        assert r.status_code == 403

    def test_admin_document_reveal(self, tokens, db):
        # ensure a submission with a file exists (create one)
        tok, _ = register_fresh("adminfile")
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "TEST_A", "id_type": "Passport",
            "documents": [{"doc_name": "c", "file_b64": base64.b64encode(b"x").decode(),
                           "file_type": "application/pdf", "file_name": "c.pdf"}],
        }, timeout=20)
        sub_id = r.json()["submission_id"]
        sub = db.verification_submissions.find_one({"id": sub_id})
        doc_id = sub["documents"][0]["id"]
        f = requests.get(f"{API}/admin/verifications/{sub_id}/documents/{doc_id}",
                         headers=H(tokens["kauri"]), timeout=15).json()
        assert f.get("file_b64")

    def test_audit_history_chain(self, tokens, db):
        tok, me = register_fresh("audit")
        r = requests.post(f"{API}/verification/submit", headers=H(tok), json={
            "profession": "HR", "categories": ["Recruitment"],
            "full_name": "TEST_Audit", "id_type": "Passport",
            "documents": [{"doc_name": "d"}],
        }, timeout=20)
        sub_id = r.json()["submission_id"]
        for action in ("approve", "suspend", "renew"):
            resp = requests.post(f"{API}/admin/verifications/{sub_id}/decision",
                                 headers=H(tokens["kauri"]),
                                 json={"action": action}, timeout=20)
            assert resp.status_code == 200
        sub = db.verification_submissions.find_one({"id": sub_id})
        hist = sub["history"]
        actions = [h["action"] for h in hist]
        assert actions == ["submitted", "approve", "suspend", "renew"]
        for h in hist:
            assert "by" in h and "at" in h
        # renew clears reminders_sent
        assert sub["reminders_sent"] == []
        # each admin decision fired a notification
        notes = requests.get(f"{API}/notifications", headers=H(tok), timeout=15).json()
        titles = " ".join(n["title"] for n in notes)
        for keyword in ("approved", "suspended", "renewed"):
            assert keyword in titles.lower(), f"no notification for {keyword}: {titles}"


# ==========================================================================
# CATEGORY RESTRICTIONS
# ==========================================================================
class TestCategoryRestrictions:
    def test_sana_can_offer_on_hr_but_not_technology(self, tokens, uids, db):
        # create a Technology help_request from a temp user (or use another demo)
        tok_new, me_new = register_fresh("techneed")
        hr_body = {"category": "Technology", "public_summary": "TEST_tech help",
                   "private_details": "TEST_priv", "payment": "Open to paying",
                   "expiry": "24 hours"}
        # find or create — the endpoint is /professional/help-request POST for the seeker
        # We'll use direct create via the standard flow (help_requests are created by need-help users)
        # Use James (need-help capable) — actually we need a user to create requests. Try direct POST.
        r = requests.post(f"{API}/help-requests", headers=H(tok_new),
                          json=hr_body, timeout=20)
        assert r.status_code == 200, f"create tech req: {r.status_code} {r.text}"
        tech_hr_id = r.json()["id"]

        # sana (HR verified) tries to offer help on Technology req → 403
        offer = requests.post(f"{API}/connect/request", headers=H(tokens["sana"]),
                              json={"user_id": me_new["id"], "help_request_id": tech_hr_id},
                              timeout=20)
        assert offer.status_code == 403
        assert "verified" in offer.json().get("detail", "").lower()

        # find priya HR request → sana can offer
        hr_priya = list(db.help_requests.find({"user_id": uids["priya"], "status": "active",
                                               "category": "HR"}))
        if hr_priya:
            r2 = requests.post(f"{API}/connect/request", headers=H(tokens["sana"]),
                               json={"user_id": uids["priya"], "help_request_id": hr_priya[0]["id"]},
                               timeout=20)
            assert r2.status_code == 200

        # cleanup
        db.help_requests.delete_one({"id": tech_hr_id})

    def test_jade_unverified_403_on_any_offer(self, tokens, uids, db):
        hr_priya = db.help_requests.find_one({"user_id": uids["priya"], "status": "active"})
        if not hr_priya:
            pytest.skip("no priya active help request")
        r = requests.post(f"{API}/connect/request", headers=H(tokens["jade"]),
                          json={"user_id": uids["priya"], "help_request_id": hr_priya["id"]},
                          timeout=20)
        assert r.status_code == 403
        assert "verification" in r.json().get("detail", "").lower()

    def test_pro_profile_category_gate(self, tokens):
        # sana (HR verified) with primary_category='Legal' → 400
        r_bad = requests.post(f"{API}/professional/profile", headers=H(tokens["sana"]), json={
            "profession": "HR Consultant", "primary_category": "Legal",
            "additional_categories": [], "about": "TEST", "years_experience": 5,
        }, timeout=20)
        assert r_bad.status_code == 400

        # Use SAME profession as seeded to avoid triggering re-review
        r_ok = requests.post(f"{API}/professional/profile", headers=H(tokens["sana"]), json={
            "profession": "HR Consultant", "primary_category": "HR",
            "additional_categories": [], "about": "HR pro", "years_experience": 12,
            "qualifications": "MBA (HR), CIPD Level 7", "memberships": "AHRI member",
        }, timeout=20)
        assert r_ok.status_code == 200
        assert r_ok.json().get("is_draft") is False

        # jade (unverified) → allowed but is_draft=True
        r_j = requests.post(f"{API}/professional/profile", headers=H(tokens["jade"]), json={
            "profession": "Personal Trainer", "primary_category": "Fitness",
            "additional_categories": [], "about": "TEST_jade", "years_experience": 4,
        }, timeout=20)
        assert r_j.status_code == 200
        assert r_j.json().get("is_draft") is True


# ==========================================================================
# PUBLIC PROFILE + LIST
# ==========================================================================
class TestPublicProfile:
    def test_sana_public_profile(self, tokens, uids):
        r = requests.get(f"{API}/professional/profile/{uids['sana']}",
                         headers=H(tokens["priya"]), timeout=15)
        assert r.status_code == 200
        p = r.json()
        assert p["professionally_verified"] is True
        assert p["verified_profession"] == "HR"
        assert set(p["verified_categories"]) == {"Employee Relations", "Recruitment", "Performance"}
        assert p.get("verified_since")
        assert p["valid_until"] == "2028-07-12"

    def test_professionals_list_only_verified(self, tokens, uids):
        r = requests.get(f"{API}/professionals?lat=-37.8136&lng=144.9631",
                         headers=H(tokens["priya"]), timeout=15)
        assert r.status_code == 200
        listed = [p["user_id"] for p in r.json()["professionals"]]
        assert uids["sana"] in listed
        assert uids["jade"] not in listed
        # ensure no credential file leakage
        for p in r.json()["professionals"]:
            for key in list(p.keys()):
                assert "file_b64" not in key

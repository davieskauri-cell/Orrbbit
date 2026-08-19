"""Iteration 46 — Demo data refresh: current_profile_v2 fixture invariants."""
from collections import Counter
from datetime import date, datetime, timezone

import pymongo
import pytest
import requests
from dotenv import dotenv_values

fenv = dotenv_values("/app/frontend/.env")
benv = dotenv_values("/app/backend/.env")
API = f"{fenv['EXPO_PUBLIC_BACKEND_URL']}/api"

PRIMARIES = ["kauri", "james", "sarah", "olivia", "jake", "mia", "liam", "sophie", "ryan", "emily"]


@pytest.fixture(scope="module")
def db():
    c = pymongo.MongoClient(benv["MONGO_URL"])
    yield c[benv["DB_NAME"]]
    c.close()


class TestDemoSchema:
    def test_all_demo_users_stamped_v2(self, db):
        total = db.users.count_documents({"is_demo": True})
        stamped = db.users.count_documents({"is_demo": True, "demo_schema_version": "current_profile_v2"})
        assert total == stamped and total >= 70

    def test_no_real_user_touched(self, db):
        assert db.users.count_documents({"is_demo": {"$ne": True}, "demo_schema_version": {"$exists": True}}) == 0
        assert db.users.count_documents({"is_demo": {"$ne": True}, "demo_fixture": {"$exists": True}}) == 0

    def test_no_duplicate_demo_emails(self, db):
        emails = [u["email"] for u in db.users.find({"is_demo": True}, {"email": 1})]
        assert not [e for e, n in Counter(emails).items() if n > 1]

    def test_dob_age_consistent_and_adult(self, db):
        for u in db.users.find({"is_demo": True}, {"name": 1, "age": 1, "date_of_birth": 1}):
            dob = u.get("date_of_birth")
            assert dob, f"{u.get('name')} missing DOB"
            y, m, d = map(int, dob.split("-"))
            t = date.today()
            calc = t.year - y - ((t.month, t.day) < (m, d))
            assert calc == u.get("age"), f"{u.get('name')}: DOB {dob} != displayed age {u.get('age')}"
            assert calc >= 18


class TestPrimaryProfiles:
    def test_primary_standard(self, db):
        for name in PRIMARIES:
            u = db.users.find_one({"email": f"{name}@intro.demo"})
            assert u, f"{name} missing"
            assert len(u.get("photos") or []) >= 2, f"{name}: <2 photos"
            assert len(u.get("photos") or []) <= 6
            assert len(u.get("bio") or "") >= 40, f"{name}: bio too short"
            assert u.get("current_city"), f"{name}: no current city"
            assert u.get("home_city"), f"{name}: no home city"
            assert len(u.get("interests") or []) >= 3, f"{name}: <3 interests"
            assert 1 <= len(u.get("prompts") or []) <= 3, f"{name}: prompts out of range"
            assert u.get("occupation"), f"{name}: no occupation"
            assert u.get("email_verified") is True

    def test_photos_are_demo_assets(self, db):
        for name in PRIMARIES:
            u = db.users.find_one({"email": f"{name}@intro.demo"}, {"photos": 1})
            for p in u["photos"]:
                assert p.startswith("/api/demo-assets/"), f"{name}: stock photo leaked {p}"

    def test_mutual_interests_exist(self, db):
        k = set(db.users.find_one({"email": "kauri@intro.demo"}, {"interests": 1})["interests"])
        j = set(db.users.find_one({"email": "james@intro.demo"}, {"interests": 1})["interests"])
        assert len(k & j) >= 2  # real shared interests, not hard-coded labels


class TestCrowdAndFixtures:
    def test_no_legacy_repetitive_interests(self, db):
        assert db.users.count_documents({"is_demo": True, "interests": ["Coffee", "Melbourne"]}) == 0
        assert db.users.count_documents({"is_demo": True, "interests": ["Coffee", "Travel"]}) == 0

    def test_radar_crowd_enriched(self, db):
        for u in db.users.find({"email": {"$regex": "@radar.intro.demo$"},
                                "demo_fixture": "radar_crowd"}, {"name": 1, "interests": 1, "home_city": 1, "current_city": 1}):
            assert len(u.get("interests") or []) >= 3, f"{u['name']}: interests"
            assert u.get("current_city") == "Melbourne, Australia"
            assert u.get("home_city"), f"{u['name']}: home city"

    def test_intentional_incomplete_fixtures_tagged(self, db):
        a = db.users.find_one({"email": "ezra@radar.intro.demo"})
        assert a["demo_fixture"] == "incomplete_profile_a"
        assert len(a.get("bio") or "") < 40
        b = db.users.find_one({"email": "luna@radar.intro.demo"})
        assert b["demo_fixture"] == "incomplete_profile_b"
        assert not b.get("home_city")

    def test_age_spread_supports_filter(self, db):
        ages = sorted(set(u["age"] for u in db.users.find(
            {"email": {"$regex": "@radar.intro.demo$"}}, {"age": 1})))
        assert ages[0] >= 18
        assert any(a >= 48 for a in ages) and any(a <= 24 for a in ages)  # wide adult spread


class TestProfessionalReviewStates:
    def test_representative_annual_review_states(self, db):
        now = datetime.now(timezone.utc)
        states = {"current": 0, "due_soon": 0, "overdue": 0}
        for v in db.verification_submissions.find({"demo_env": True, "status": "Approved"},
                                                   {"credential_next_review_at": 1}):
            nr = v.get("credential_next_review_at")
            assert nr, "approved demo credential missing next review date"
            days = (datetime.fromisoformat(nr) - now).days
            if days < 0:
                states["overdue"] += 1
            elif days <= 30:
                states["due_soon"] += 1
            else:
                states["current"] += 1
        assert states["current"] >= 1 and states["due_soon"] >= 1 and states["overdue"] >= 1, states

    def test_all_verification_lifecycle_states_present(self, db):
        statuses = set(db.verification_submissions.distinct("status", {"demo_env": True}))
        assert {"Approved", "Pending Review", "Rejected", "Expired"} <= statuses


class TestIdempotentSeed:
    def test_demo_reset_no_duplicates(self, db):
        before = db.users.count_documents({"is_demo": True})
        tok = requests.post(f"{API}/auth/login",
                            json={"email": "kauri@intro.demo", "password": "Intro123!"}).json()["access_token"]
        r = requests.post(f"{API}/demo/reset", headers={"Authorization": f"Bearer {tok}"}, timeout=120)
        assert r.status_code == 200
        after = db.users.count_documents({"is_demo": True})
        assert before == after
        assert db.users.count_documents({"is_demo": True, "name": {"$regex": "Copy"}}) == 0

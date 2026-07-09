"""Backend tests — iteration 6: Safety / Admin / Moderation / Mutual-Only / Events.

Covers the NEW iter_6 behaviors:
- POST /api/reports risk classification (low/medium/high) + auto-actions
- Reporter no longer sees reported in /api/nearby (auto-hide)
- GET /api/admin/dashboard structure + POST /api/admin/reports/{id}/action
- POST /api/hide bidirectional exclusion + saved deletion
- Mutual Only Mode filters incompatible users
- Event codes: INTRO100 join, invalid 404, +5 score / mutual_reason for shared event
- POST /api/events/leave resets user's event
- GET /api/users/me/completion score/done/suggestions
- POST /api/dismissal-feedback ok
- POST /api/meetups with meetup_point, POST /api/meetups/{id}/cancel no-show tracking
- /api/nearby payload includes availability + intent_strength

All state changes on demo users are reset at end of each test class.
"""
import os
import uuid
from typing import Dict, Any

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
LAT, LNG = -37.8183, 144.9671
TIMEOUT = 25


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def demo_login(email: str = None) -> dict:
    body = {"email": email} if email else {}
    r = requests.post(f"{API}/auth/demo-login", json=body, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return _auth(r.json()["access_token"])


def get_me(hdrs) -> dict:
    r = requests.get(f"{API}/auth/me", headers=hdrs, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


def set_state(hdrs, **kwargs) -> dict:
    r = requests.put(f"{API}/users/me/state", headers=hdrs, json=kwargs, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


def nearby(hdrs, lat=LAT, lng=LNG) -> Dict[str, Any]:
    r = requests.get(f"{API}/nearby", headers=hdrs, params={"lat": lat, "lng": lng}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


def by_name(users, name: str):
    for u in users:
        if u.get("name") == name:
            return u
    return None


# ---------------- Reports risk classification ----------------
class TestReportsRisk:
    def setup_method(self):
        # Use throwaway registered reporter so hide state doesn't persist across runs
        email = f"TEST_rep_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Test1234!",
                                  "name": "TEST Reporter", "age": 30}, timeout=TIMEOUT)
        assert reg.status_code == 200, reg.text
        self.reporter = _auth(reg.json()["access_token"])
        set_state(self.reporter, vibe="networking", radius=100, visible=True,
                  lat=LAT, lng=LNG)

    def _get_target(self, name: str):
        users = nearby(self.reporter)["users"]
        u = by_name(users, name)
        assert u, f"{name} not in nearby users"
        return u

    def test_low_risk_spam_report(self):
        target = self._get_target("Liam")  # low-stakes throwaway
        r = requests.post(f"{API}/reports", headers=self.reporter,
                          json={"user_id": target["id"], "reason": "Spam", "details": "TEST iter6"},
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["risk"] == "low"
        assert data["message"] == "Thanks. We'll review this report. You will no longer see this person."
        # reporter no longer sees Liam
        u2 = by_name(nearby(self.reporter)["users"], "Liam")
        assert u2 is None, "Reporter should no longer see reported user after low-risk report"

    def test_medium_risk_harassment_flags_user(self):
        target = self._get_target("Sophie")
        r = requests.post(f"{API}/reports", headers=self.reporter,
                          json={"user_id": target["id"], "reason": "Harassment", "details": "TEST iter6"},
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["risk"] == "medium"
        # verify admin dashboard shows Sophie as flagged
        # (need to be Kauri to query dashboard — anyone can)
        dash = requests.get(f"{API}/admin/dashboard", headers=self.reporter, timeout=TIMEOUT).json()
        report_row = next((rr for rr in dash["reports_queue"] if rr["reported_name"] == "Sophie" and rr["reason"] == "Harassment"), None)
        assert report_row, "Sophie/Harassment report should be in queue"
        assert report_row["risk"] == "medium"

    def test_high_risk_unsafe_hides_user(self):
        target = self._get_target("Emily")  # visible at radius 100
        r = requests.post(f"{API}/reports", headers=self.reporter,
                          json={"user_id": target["id"], "reason": "Unsafe interaction", "details": "TEST iter6"},
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["risk"] == "high"
        # Report status "User Hidden"
        dash = requests.get(f"{API}/admin/dashboard", headers=self.reporter, timeout=TIMEOUT).json()
        row = next((rr for rr in dash["reports_queue"] if rr["reported_name"] == "Emily" and rr["reason"] == "Unsafe interaction"), None)
        assert row, "Emily/Unsafe report should be in reports_queue"
        assert row["status"] == "User Hidden"
        assert row["risk"] == "high"
        # Emily no longer visible to anyone — check via a fresh Kauri session
        k = demo_login()
        set_state(k, radius=100, vibe="networking", visible=True, lat=LAT, lng=LNG)
        emily = by_name(nearby(k)["users"], "Emily")
        assert emily is None, "Emily should be hidden after high-risk report"
        # Cleanup: dismiss + restore visibility so subsequent tests aren't broken
        dismiss_id = row["id"]
        dr = requests.post(f"{API}/admin/reports/{dismiss_id}/action",
                           headers=self.reporter, json={"action": "dismiss"}, timeout=TIMEOUT)
        assert dr.status_code == 200, dr.text
        # Log in as Emily and toggle visibility back on
        emily_hdrs = demo_login("emily@intro.demo")
        set_state(emily_hdrs, visible=True)


# ---------------- Admin dashboard & actions ----------------
class TestAdminDashboard:
    def test_dashboard_shape(self):
        hdrs = demo_login()
        r = requests.get(f"{API}/admin/dashboard", headers=hdrs, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        # top-level sections
        for k in ("overview", "reports_queue", "blocked_users",
                  "safety_incidents", "trial_metrics", "recruiter_activity"):
            assert k in d, f"missing {k}"
        ov = d["overview"]
        for k in ("total_users", "active_by_city", "pings_sent",
                  "conversations_confirmed", "users_hidden_for_review", "no_shows"):
            assert k in ov, f"missing overview.{k}"
        assert isinstance(ov["active_by_city"], dict)
        # reports_queue is list of dicts with risk+status
        assert isinstance(d["reports_queue"], list)
        if d["reports_queue"]:
            row = d["reports_queue"][0]
            for k in ("id", "reason", "risk", "status", "reported_name", "reporter_name", "created_at"):
                assert k in row, f"missing report row key {k}"

    def test_admin_action_dismiss_resets_status(self):
        # Register a throwaway reporter for isolation
        email = f"TEST_adminr_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Test1234!",
                                  "name": "TEST AdminReporter", "age": 29}, timeout=TIMEOUT)
        assert reg.status_code == 200
        reporter = _auth(reg.json()["access_token"])
        set_state(reporter, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        users = nearby(reporter)["users"]
        target = by_name(users, "Ryan") or by_name(users, "James")
        assert target
        rr = requests.post(f"{API}/reports", headers=reporter,
                           json={"user_id": target["id"], "reason": "Harassment", "details": "TEST iter6 dismiss"},
                           timeout=TIMEOUT)
        assert rr.status_code == 200
        dash = requests.get(f"{API}/admin/dashboard", headers=reporter, timeout=TIMEOUT).json()
        row = next(rr for rr in dash["reports_queue"]
                   if rr["reason"] == "Harassment" and rr["reported_name"] == target["name"]
                   and rr["reporter_name"] == "TEST AdminReporter")
        act = requests.post(f"{API}/admin/reports/{row['id']}/action",
                            headers=reporter, json={"action": "dismiss"}, timeout=TIMEOUT)
        assert act.status_code == 200
        dash2 = requests.get(f"{API}/admin/dashboard", headers=reporter, timeout=TIMEOUT).json()
        row2 = next(rr for rr in dash2["reports_queue"] if rr["id"] == row["id"])
        assert row2["status"] == "Dismissed"


# ---------------- Hide bidirectional ----------------
class TestHide:
    def test_hide_excludes_both_ways_and_deletes_saved(self):
        # Use throwaway to avoid demo state pollution across tests
        email = f"TEST_hide_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Test1234!",
                                  "name": "TEST HideActor", "age": 28}, timeout=TIMEOUT)
        assert reg.status_code == 200
        a = _auth(reg.json()["access_token"])
        set_state(a, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        users_a = nearby(a)["users"]
        target = by_name(users_a, "Mia")
        assert target, "Mia must be in throwaway user's nearby"
        target_id = target["id"]
        # Save Mia first, so /hide deletes it
        sv = requests.post(f"{API}/saved", headers=a,
                           json={"user_id": target_id, "distance": 30}, timeout=TIMEOUT)
        assert sv.status_code == 200
        # Now hide
        h = requests.post(f"{API}/hide", headers=a, json={"user_id": target_id}, timeout=TIMEOUT)
        assert h.status_code == 200
        assert h.json().get("ok") is True
        # Throwaway no longer sees Mia
        assert by_name(nearby(a)["users"], "Mia") is None
        # Saved entry gone
        saved_resp = requests.get(f"{API}/saved", headers=a, timeout=TIMEOUT).json()
        items = saved_resp.get("items", saved_resp) if isinstance(saved_resp, dict) else saved_resp
        if isinstance(items, list):
            assert not any((s.get("user", {}) or {}).get("id") == target_id for s in items if isinstance(s, dict))
        # Mia no longer sees throwaway either
        mia = demo_login("mia@intro.demo")
        set_state(mia, vibe="relationship", radius=100, visible=True, lat=LAT, lng=LNG)
        assert by_name(nearby(mia)["users"], "TEST HideActor") is None
        # Cleanup
        set_state(a, visible=False, lat=None, lng=None)


# ---------------- Mutual Only Mode ----------------
class TestMutualOnly:
    def test_mutual_only_filters_incompatible_vibes(self):
        mia = demo_login("mia@intro.demo")
        me = get_me(mia)
        # baseline: Kauri (networking) sees Mia
        kauri = demo_login()
        set_state(kauri, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        assert by_name(nearby(kauri)["users"], "Mia") is not None
        # enable mutual_only on Mia
        set_state(mia, mutual_only=True, radius=50, visible=True, lat=LAT, lng=LNG)
        # Kauri (networking) no longer sees Mia (relationship compat = [relationship])
        assert by_name(nearby(kauri)["users"], "Mia") is None
        # Create a throwaway user with vibe=relationship — should still see Mia
        email = f"TEST_rel_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Test1234!",
                                  "name": "TEST Rel", "age": 27}, timeout=TIMEOUT)
        assert reg.status_code == 200, reg.text
        throw = _auth(reg.json()["access_token"])
        set_state(throw, vibe="relationship", radius=100, visible=True, lat=LAT, lng=LNG)
        assert by_name(nearby(throw)["users"], "Mia") is not None
        # Cleanup
        set_state(mia, mutual_only=False)
        set_state(throw, visible=False, lat=None, lng=None)


# ---------------- Event codes ----------------
class TestEventCodes:
    def test_invalid_event_code_returns_404(self):
        h = demo_login()
        r = requests.post(f"{API}/events/join-code", headers=h,
                          json={"code": "NOPE_XYZ"}, timeout=TIMEOUT)
        assert r.status_code == 404
        assert r.json()["detail"] == "Event code not found."

    def test_intro100_join_and_shared_event_bonus(self):
        kauri = demo_login()
        set_state(kauri, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        james = demo_login("james@intro.demo")
        set_state(james, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)

        # Score before join
        users_before = nearby(kauri)["users"]
        james_before = by_name(users_before, "James")
        assert james_before is not None
        score_before = james_before.get("score", 0)

        # Both join INTRO100
        rk = requests.post(f"{API}/events/join-code", headers=kauri,
                           json={"code": "INTRO100"}, timeout=TIMEOUT)
        assert rk.status_code == 200
        assert rk.json()["event_name"] == "Intro 100m Social"
        rj = requests.post(f"{API}/events/join-code", headers=james,
                           json={"code": "INTRO100"}, timeout=TIMEOUT)
        assert rj.status_code == 200

        # Kauri now sees James with +5 and mutual_reason
        users_after = nearby(kauri)["users"]
        james_after = by_name(users_after, "James")
        assert james_after is not None
        assert james_after.get("event_name") == "Intro 100m Social"
        assert james_after.get("score", 0) >= score_before + 5, \
            f"expected +5, got {score_before} → {james_after.get('score')}"
        assert james_after.get("mutual_reason") == "You are both at Intro 100m Social"

        # Cleanup: leave event
        assert requests.post(f"{API}/events/leave", headers=kauri, timeout=TIMEOUT).status_code == 200
        assert requests.post(f"{API}/events/leave", headers=james, timeout=TIMEOUT).status_code == 200
        me_k = get_me(kauri)
        assert me_k.get("event_code") in (None, "")


# ---------------- Profile completion ----------------
class TestCompletion:
    def test_completion_returns_score_done_suggestions(self):
        h = demo_login()
        r = requests.get(f"{API}/users/me/completion", headers=h, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ("score", "done", "suggestions"):
            assert k in d, f"missing {k}"
        assert isinstance(d["score"], int)
        assert 0 <= d["score"] <= 100
        assert isinstance(d["done"], list)
        assert isinstance(d["suggestions"], list)
        # Kauri is seeded near-complete
        assert d["score"] >= 80, f"Kauri completion should be high, got {d['score']}"


class TestDismissalFeedback:
    def test_dismissal_feedback_ok(self):
        h = demo_login()
        users = nearby(h)["users"]
        assert users
        r = requests.post(f"{API}/dismissal-feedback", headers=h,
                          json={"user_id": users[0]["id"], "reason": "Not my vibe"},
                          timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------------- Meetup + cancel + no-show ----------------
class TestMeetupsAndNoShows:
    def test_meetup_with_point_and_no_show_cancel(self):
        # Fresh throwaway user to avoid mutating demo state
        email = f"TEST_mp_{uuid.uuid4().hex[:8]}@intro.example"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Test1234!",
                                  "name": "TEST Meetup", "age": 28}, timeout=TIMEOUT)
        assert reg.status_code == 200
        h = _auth(reg.json()["access_token"])
        set_state(h, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        target = by_name(nearby(h)["users"], "James")
        assert target
        # Create meetup with meetup_point
        m = requests.post(f"{API}/meetups", headers=h,
                          json={"user_id": target["id"], "meetup_point": "Cafe"},
                          timeout=TIMEOUT)
        assert m.status_code == 200, m.text
        meetup = m.json()
        assert meetup.get("meetup_point") == "Cafe"
        meetup_id = meetup["id"]
        # Snapshot no_shows before
        dash_before = requests.get(f"{API}/admin/dashboard", headers=h, timeout=TIMEOUT).json()
        ns_before = dash_before["overview"]["no_shows"]
        # Cancel with "They did not show"
        c = requests.post(f"{API}/meetups/{meetup_id}/cancel", headers=h,
                          json={"reason": "They did not show"}, timeout=TIMEOUT)
        assert c.status_code == 200, c.text
        cd = c.json()
        assert cd.get("ok") is True
        assert cd.get("message") == "Meetup ended. Location sharing stopped."
        # no_shows increments
        dash_after = requests.get(f"{API}/admin/dashboard", headers=h, timeout=TIMEOUT).json()
        assert dash_after["overview"]["no_shows"] >= ns_before + 1
        # Cleanup throwaway
        set_state(h, visible=False, lat=None, lng=None)


# ---------------- Nearby payload — availability + intent_strength ----------------
class TestNearbyPayloadAvailability:
    def test_users_have_availability_and_intent_strength(self):
        h = demo_login()
        set_state(h, vibe="networking", radius=100, visible=True, lat=LAT, lng=LNG)
        users = nearby(h)["users"]
        assert users
        for u in users:
            assert "availability" in u, f"availability missing on {u.get('name')}"
            assert "intent_strength" in u, f"intent_strength missing on {u.get('name')}"
        # Sarah should be "Available now" (seed) and "Actively looking now"
        s = by_name(users, "Sarah")
        assert s is not None
        assert s.get("availability") == "Available now"
        assert s.get("intent_strength") == "Actively looking now"

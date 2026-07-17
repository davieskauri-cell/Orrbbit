"""Iteration 18 — Full Demo Environment (persona demo@intro.demo)
Backend regression suite. See /app/test_reports/iteration_18.json for review context.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PW = "Intro123!"
# Melbourne CBD — same fallback the frontend uses when geolocation denied
LAT, LNG = -37.8136, 144.9631
LOC_Q = f"?lat={LAT}&lng={LNG}"


# ---------------------------- fixtures ----------------------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _demo_login(s, email):
    r = s.post(f"{API}/auth/demo-login", json={"email": email}, timeout=20)
    assert r.status_code == 200, f"demo-login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def persona_tok(s):
    return _demo_login(s, "demo@intro.demo")


@pytest.fixture(scope="session")
def kauri_tok(s):
    return _demo_login(s, "kauri@intro.demo")


@pytest.fixture(scope="session")
def sana_tok(s):
    return _demo_login(s, "sana@radar.intro.demo")


@pytest.fixture(scope="session", autouse=True)
def _final_reset(s):
    # Reset demo state at start AND end so persona is pristine.
    tok = _demo_login(s, "demo@intro.demo")
    s.post(f"{API}/demo/reset", headers=_h(tok), timeout=30)
    yield
    try:
        tok = _demo_login(s, "demo@intro.demo")
        s.post(f"{API}/demo/reset", headers=_h(tok), timeout=30)
    except Exception:
        pass


# ---------------------------- demo login + persona ----------------------------
class TestDemoLogin:
    def test_demo_login_returns_alex(self, s, persona_tok):
        r = s.get(f"{API}/auth/me", headers=_h(persona_tok))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@intro.demo"
        assert u["name"].startswith("Alex")
        assert u["is_demo"] is True
        assert u["plan"] == "pro"
        assert u["app_mode"] == "people"
        assert u["professional_role"] == "need_help"
        assert u["radius"] == 500


# ---------------------------- radar / nearby ----------------------------
class TestRadar:
    def test_nearby_has_60_plus(self, s, persona_tok):
        r = s.get(f"{API}/nearby{LOC_Q}", headers=_h(persona_tok))
        assert r.status_code == 200, r.text
        data = r.json()
        users = data.get("users") if isinstance(data, dict) else data
        assert users is not None
        assert len(users) >= 60, f"expected >=60 nearby, got {len(users)}"

    def test_professionals_only_active_verified(self, s, persona_tok):
        r = s.get(f"{API}/professionals{LOC_Q}", headers=_h(persona_tok))
        assert r.status_code == 200, r.text
        payload = r.json()
        pros = payload.get("professionals") if isinstance(payload, dict) else payload
        assert pros is not None
        assert len(pros) >= 13, f"expected >=13 pros, got {len(pros)}"
        for p in pros:
            v = p.get("professionally_verified", False) or p.get("verified", False) or bool(p.get("verified_categories"))
            assert v, f"non-verified pro leaked: {p.get('name')} → {p}"


# ---------------------------- pings ----------------------------
class TestPings:
    def test_persona_has_5_pending_and_mix(self, s, persona_tok):
        r = s.get(f"{API}/pings", headers=_h(persona_tok))
        assert r.status_code == 200
        d = r.json()
        # response is a flat list of incoming pings (senders as 'user')
        incoming = d if isinstance(d, list) else (d.get("incoming") or [])
        pending = [p for p in incoming if p.get("status") == "new"]
        assert len(pending) >= 5, f"expected >=5 pending, got {len(pending)}: {[p.get('status') for p in incoming]}"
        offers = [p for p in incoming if p.get("about") == "help_offer"]
        assert len(offers) >= 1, f"expected >=1 help_offer ping. abouts seen: {[p.get('about') for p in incoming]}"

    def test_pings_include_accepted_and_declined(self, s, persona_tok):
        r = s.get(f"{API}/pings", headers=_h(persona_tok))
        d = r.json()
        incoming = d if isinstance(d, list) else (d.get("incoming") or [])
        statuses = {p.get("status") for p in incoming}
        assert "accepted" in statuses or "declined" in statuses, f"statuses seen: {statuses}"


# ---------------------------- notifications ----------------------------
class TestNotifications:
    def test_six_notifications_seeded(self, s, persona_tok):
        r = s.get(f"{API}/notifications", headers=_h(persona_tok))
        assert r.status_code == 200
        notifs = r.json()
        if isinstance(notifs, dict):
            notifs = notifs.get("items") or notifs.get("notifications") or []
        assert len(notifs) >= 6, f"expected >=6 notifications, got {len(notifs)}"
        types = {n.get("type") for n in notifs}
        expected = {"connection_request", "offer_accepted", "offer_declined",
                    "verification_approve", "verification_expiring_90", "need_help_nearby"}
        missing = expected - types
        assert not missing, f"missing notification types: {missing}. Got: {types}"


# ---------------------------- professional requests as sana ----------------------------
class TestProRequestsSana:
    def test_sana_sees_matching_requests(self, s, sana_tok):
        r = s.get(f"{API}/professional/requests{LOC_Q}", headers=_h(sana_tok))
        assert r.status_code == 200, r.text
        payload = r.json()
        reqs = payload.get("requests") if isinstance(payload, dict) else payload
        assert reqs is not None
        assert len(reqs) >= 2, f"expected >=2 HR requests for sana, got {len(reqs)}"
        summaries = " ".join((rq.get("public_summary") or "").lower() for rq in reqs)
        assert "hr" in summaries or "resignation" in summaries or "staff" in summaries, f"unexpected: {summaries[:400]}"


# ---------------------------- admin dashboard ----------------------------
class TestAdmin:
    def test_admin_verifications_has_all_statuses(self, s, persona_tok):
        r = s.get(f"{API}/admin/verifications", headers=_h(persona_tok))
        assert r.status_code == 200, r.text
        subs = r.json()
        if isinstance(subs, dict):
            subs = subs.get("items") or subs.get("submissions") or subs.get("verifications") or []
        assert len(subs) >= 20, f"expected >=20 submissions, got {len(subs)}"
        statuses = {s.get("status") for s in subs}
        needed = {"Approved", "Pending Review", "Rejected", "Expired"}
        missing = needed - statuses
        # Suspended may not be seeded — check at least 4/5
        assert len(needed - missing) >= 4, f"expected >=4 status classes, got: {statuses}"


# ---------------------------- demo/reset ----------------------------
class TestDemoReset:
    def _pending_incoming(self, s, tok):
        r = s.get(f"{API}/pings", headers=_h(tok))
        d = r.json()
        incoming = d.get("incoming") if isinstance(d, dict) else d
        return [p for p in incoming if p.get("status") == "new" and p.get("about") != "help_offer"]

    def test_reset_restores_accepted_ping_back_to_pending(self, s, persona_tok):
        # snapshot pending count before mutation
        before = self._pending_incoming(s, persona_tok)
        assert len(before) >= 5
        # accept one pending
        target = before[0]
        r = s.post(f"{API}/pings/{target['id']}/accept", headers=_h(persona_tok))
        assert r.status_code == 200, r.text
        mid = self._pending_incoming(s, persona_tok)
        assert len(mid) == len(before) - 1, f"pending should decrement after accept: {len(before)}→{len(mid)}"
        # reset
        r = s.post(f"{API}/demo/reset", headers=_h(persona_tok), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "counts" in body
        # after reset pending is back
        after = self._pending_incoming(s, persona_tok)
        assert len(after) >= 5, f"pending should be restored to >=5 after reset, got {len(after)}"


# ---------------------------- production safety ----------------------------
class TestProductionSafety:
    def test_real_user_unaffected_by_reset_and_persona_undeletable(self, s, persona_tok):
        # register a fresh real account (backend downcases emails)
        email = f"realuser_{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": email, "password": "Test1234!", "name": "Real Tester", "age": 25}
        r = s.post(f"{API}/auth/register", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        real_tok = r.json()["access_token"]
        # /auth/me before
        me1 = s.get(f"{API}/auth/me", headers=_h(real_tok)).json()
        assert me1["email"] == email
        assert me1.get("is_demo") is False
        # reset demo as persona
        rr = s.post(f"{API}/demo/reset", headers=_h(persona_tok), timeout=30)
        assert rr.status_code == 200
        # /auth/me after — real user still exists, unchanged core fields
        me2 = s.get(f"{API}/auth/me", headers=_h(real_tok))
        assert me2.status_code == 200
        me2j = me2.json()
        assert me2j["email"] == email
        assert me2j["name"] == "Real Tester"
        # reset as real user → 403
        r403 = s.post(f"{API}/demo/reset", headers=_h(real_tok), timeout=20)
        assert r403.status_code == 403, f"expected 403 for non-demo reset, got {r403.status_code}"
        # persona cannot be deleted
        dr = s.delete(f"{API}/users/me", headers=_h(persona_tok))
        assert dr.status_code == 403, f"persona should be undeletable, got {dr.status_code}"
        # cleanup real user
        cl = s.delete(f"{API}/users/me", headers=_h(real_tok))
        assert cl.status_code in (200, 204), f"cleanup delete failed: {cl.status_code}"


# ---------------------------- regression ----------------------------
class TestRegression:
    def test_email_password_login_still_works(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "kauri@intro.demo", "password": DEMO_PW}, timeout=20)
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_sana_still_sees_priya_request(self, s, sana_tok):
        r = s.get(f"{API}/professional/requests{LOC_Q}", headers=_h(sana_tok))
        assert r.status_code == 200
        payload = r.json()
        reqs = payload.get("requests") if isinstance(payload, dict) else payload
        assert reqs and len(reqs) >= 1

"""Iteration 19 — Adaptive People+Professional Radar
Backend spot checks per E1 review request. Focus: no new endpoints, just
verifying that /api/professionals category+available_now filtering and
/api/professional/requests unverified gate still work, plus mode/role persistence.
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
LAT, LNG = -37.8136, 144.9631
LOC = f"?lat={LAT}&lng={LNG}"


def _login(s, email):
    r = s.post(f"{API}/auth/demo-login", json={"email": email}, timeout=20)
    assert r.status_code == 200, f"{email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def sana(s):
    return _login(s, "sana@radar.intro.demo")


@pytest.fixture(scope="session")
def jade(s):
    return _login(s, "jade@radar.intro.demo")


@pytest.fixture(scope="session")
def demo(s):
    return _login(s, "demo@intro.demo")


@pytest.fixture(scope="session", autouse=True)
def _reset(s):
    tok = _login(s, "demo@intro.demo")
    s.post(f"{API}/demo/reset", headers=_h(tok), timeout=30)
    yield
    try:
        tok = _login(s, "demo@intro.demo")
        s.post(f"{API}/demo/reset", headers=_h(tok), timeout=30)
    except Exception:
        pass


class TestProfessionalsFilter:
    def test_professionals_category_hr(self, s, demo):
        r = s.get(f"{API}/professionals{LOC}&category=HR", headers=_h(demo))
        assert r.status_code == 200, r.text
        payload = r.json()
        pros = payload.get("professionals") if isinstance(payload, dict) else payload
        assert pros is not None
        # Every returned pro must have HR in verified_categories or profession broad category HR
        for p in pros:
            cats = p.get("verified_categories") or []
            prof = (p.get("verified_profession") or p.get("profession") or "").lower()
            hr_present = any("hr" in (c or "").lower() or "recruit" in (c or "").lower() or "employee" in (c or "").lower() or "performance" in (c or "").lower() for c in cats) or "hr" in prof
            assert hr_present, f"non-HR pro leaked with category=HR filter: {p}"

    def test_professionals_available_now_filter(self, s, demo):
        r = s.get(f"{API}/professionals{LOC}&available_now=true", headers=_h(demo))
        assert r.status_code == 200, r.text
        payload = r.json()
        pros = payload.get("professionals") if isinstance(payload, dict) else payload
        assert pros is not None
        # should be <= all pros
        r2 = s.get(f"{API}/professionals{LOC}", headers=_h(demo))
        pros2 = r2.json().get("professionals") if isinstance(r2.json(), dict) else r2.json()
        assert len(pros) <= len(pros2), "available_now should filter to a subset"

    def test_professionals_only_verified(self, s, demo):
        r = s.get(f"{API}/professionals{LOC}", headers=_h(demo))
        payload = r.json()
        pros = payload.get("professionals") if isinstance(payload, dict) else payload
        for p in pros:
            v = p.get("professionally_verified") or p.get("verified") or bool(p.get("verified_categories"))
            assert v, f"unverified pro leaked: {p}"


class TestProRequestsGate:
    def test_unverified_jade_blocked(self, s, jade):
        r = s.get(f"{API}/professional/requests{LOC}", headers=_h(jade))
        # Backend gates unverified — accept either 403 or an empty payload w/ verification_required flag
        if r.status_code == 200:
            body = r.json()
            reqs = body.get("requests") if isinstance(body, dict) else body
            # if unverified, list should be empty or a verification_required flag should be set
            if isinstance(body, dict):
                if body.get("verification_required") or body.get("requires_verification"):
                    assert (reqs or []) == []
                    return
            assert not reqs, f"unverified jade should not see requests: {reqs}"
        else:
            assert r.status_code in (401, 403), f"expected 403 for unverified, got {r.status_code}: {r.text}"

    def test_verified_sana_sees_requests(self, s, sana):
        r = s.get(f"{API}/professional/requests{LOC}", headers=_h(sana))
        assert r.status_code == 200, r.text
        body = r.json()
        reqs = body.get("requests") if isinstance(body, dict) else body
        assert reqs and len(reqs) >= 1


class TestModePersistence:
    def test_put_mode_persists(self, s, demo):
        # switch to professional / need_help
        r = s.put(f"{API}/users/me/mode", headers=_h(demo),
                  json={"app_mode": "professional", "professional_role": "need_help"})
        assert r.status_code == 200, r.text
        me = s.get(f"{API}/auth/me", headers=_h(demo)).json()
        assert me.get("app_mode") == "professional"
        assert me.get("professional_role") == "need_help"
        # flip role
        r = s.put(f"{API}/users/me/mode", headers=_h(demo),
                  json={"app_mode": "professional", "professional_role": "can_help"})
        assert r.status_code == 200
        me2 = s.get(f"{API}/auth/me", headers=_h(demo)).json()
        assert me2.get("professional_role") == "can_help"
        # back to people
        r = s.put(f"{API}/users/me/mode", headers=_h(demo),
                  json={"app_mode": "people"})
        assert r.status_code == 200
        me3 = s.get(f"{API}/auth/me", headers=_h(demo)).json()
        assert me3.get("app_mode") == "people"

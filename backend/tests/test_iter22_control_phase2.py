"""Iteration 22 — INTRO Control Centre Phase 2 backend tests.

Covers: Connections, Chats moderation, Radar insights, Notifications composer,
Analytics, Feature Flags (+ real enforcement on user endpoints), App Config,
System Health, Audit logs.

CRITICAL: This suite MUST restore all feature flags to defaults at the end.
"""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
QA_EMAIL = "qa-admin@intro.control"
QA_PW = "QaControl!2026x"
DEMO_APP_EMAIL = "priya@radar.intro.demo"
DEMO_APP_PW = "Intro123!"

# module-scope state
_state = {"admin_token": None, "app_token": None}


def hdr(token=None, mode="demo"):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if mode:
        h["X-Admin-Mode"] = mode
    return h


@pytest.fixture(scope="session", autouse=True)
def admin_token():
    r = requests.post(f"{BASE_URL}/api/control/auth/login", json={"email": QA_EMAIL, "password": QA_PW})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    _state["admin_token"] = r.json()["token"]
    yield _state["admin_token"]
    # restore flags at the end
    tok = _state["admin_token"]
    # reauth for high-risk flags
    requests.post(f"{BASE_URL}/api/control/auth/reauth", headers=hdr(tok), json={"password": QA_PW})
    for key, val in [("help_requests", True), ("connections", True), ("registration", True),
                      ("maintenance_mode", False), ("beta_features", True)]:
        requests.put(f"{BASE_URL}/api/control/feature-flags/{key}", headers=hdr(tok), json={"enabled": val})


@pytest.fixture(scope="session")
def app_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_APP_EMAIL, "password": DEMO_APP_PW})
    assert r.status_code == 200, f"app user login failed: {r.status_code} {r.text}"
    j = r.json()
    _state["app_token"] = j.get("access_token") or j.get("token")
    assert _state["app_token"], f"no token in {j}"
    return _state["app_token"]


# --------------------------- Connections ---------------------------
class TestConnections:
    def test_pending(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/connections?status=pending", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(["total", "items", "counts"]).issubset(d.keys())
        assert "active_matches" in d["counts"]
        assert all(k in d["counts"] for k in ("pending", "accepted", "rejected", "expired"))
        if d["items"]:
            it = d["items"][0]
            assert "from_user" in it and "to_user" in it
            assert "name" in it["from_user"]

    @pytest.mark.parametrize("status", ["accepted", "rejected", "expired"])
    def test_status_filters(self, admin_token, status):
        r = requests.get(f"{BASE_URL}/api/control/connections?status={status}", headers=hdr(admin_token))
        assert r.status_code == 200, r.text


# --------------------------- Chats ---------------------------
class TestChats:
    def test_list_conversations(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/chats", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "items" in d
        for c in d["items"]:
            assert len(c["participants"]) == 2
            assert c["message_count"] == 0  # messaging not launched
        # remember one match_id for the next test if available
        _state["match_id"] = d["items"][0]["match_id"] if d["items"] else None

    def test_view_messages_audits(self, admin_token):
        mid = _state.get("match_id")
        if not mid:
            pytest.skip("no matches to view")
        r = requests.get(f"{BASE_URL}/api/control/chats/{mid}/messages", headers=hdr(admin_token))
        assert r.status_code == 200
        assert r.json()["items"] == []
        # audit log entry should exist
        time.sleep(0.5)
        a = requests.get(f"{BASE_URL}/api/control/audit-logs?action=chat_viewed", headers=hdr(admin_token))
        assert a.status_code == 200
        assert any(x.get("target_id") == mid for x in a.json()["items"])


# --------------------------- Radar insights ---------------------------
class TestRadarInsights:
    def test_people(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/radar-insights?kind=people", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("stats", "by_vibe", "hot_areas", "by_intent", "sample"):
            assert k in d, f"missing {k}"

    def test_professional(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/radar-insights?kind=professional", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("stats", "by_category", "requests_by_category", "hot_areas", "sample"):
            assert k in d, f"missing {k}"
        assert "available_now" in d["stats"]


# --------------------------- Notifications ---------------------------
class TestNotifications:
    def test_send_professionals(self, admin_token):
        payload = {"title": "QA Iter22 test", "body": "hello pros", "audience": "professionals"}
        r = requests.post(f"{BASE_URL}/api/control/notifications", headers=hdr(admin_token), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "sent"
        assert d["targeted"] >= 1
        _state["camp_id"] = d["id"]

    def test_delivered_notifications_persisted(self, admin_token):
        cid = _state.get("camp_id")
        if not cid:
            pytest.skip("no campaign id")
        # list appears in GET
        r = requests.get(f"{BASE_URL}/api/control/notifications", headers=hdr(admin_token))
        assert r.status_code == 200
        items = r.json()["items"]
        camp = next((x for x in items if x["id"] == cid), None)
        assert camp is not None
        assert camp["status"] == "sent"
        assert camp["delivered"] == camp["targeted"]

    def test_city_requires_city(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/control/notifications", headers=hdr(admin_token),
                          json={"title": "x", "body": "y", "audience": "city"})
        assert r.status_code == 400

    def test_scheduled_appears_in_queue(self, admin_token):
        future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        r = requests.post(f"{BASE_URL}/api/control/notifications", headers=hdr(admin_token),
                          json={"title": "QA scheduled", "body": "later", "audience": "everyone", "scheduled_at": future})
        assert r.status_code == 200
        assert r.json()["status"] == "scheduled"
        cid = r.json()["id"]
        # appears in list
        lst = requests.get(f"{BASE_URL}/api/control/notifications", headers=hdr(admin_token)).json()["items"]
        assert any(x["id"] == cid and x["status"] == "scheduled" for x in lst)
        # appears in system-health queues
        h = requests.get(f"{BASE_URL}/api/control/system-health", headers=hdr(admin_token)).json()
        assert any(q["id"] == cid for q in h["queues"]["scheduled_notifications"])
        _state["scheduled_id"] = cid


# --------------------------- Analytics ---------------------------
class TestAnalytics:
    def test_analytics_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/analytics", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kpis"]["session_length"] is None
        assert set(d["series"].keys()) >= {"signups", "connections", "pings", "help_requests", "professional_growth"}
        assert len(d["funnel"]) == 4
        assert "retention_cohorts" in d
        assert "popular_categories" in d and "popular_locations" in d


# --------------------------- Feature Flags ---------------------------
class TestFeatureFlags:
    def test_defaults(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/feature-flags", headers=hdr(admin_token))
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 13
        # maintenance_mode default False; others True unless already toggled
        m = next(x for x in items if x["key"] == "maintenance_mode")
        assert m.get("enabled") in (False, None) or m["enabled"] is False

    def test_non_emergency_no_reauth(self, admin_token):
        r = requests.put(f"{BASE_URL}/api/control/feature-flags/help_requests",
                         headers=hdr(admin_token), json={"enabled": False})
        assert r.status_code == 200, r.text
        # restore
        r2 = requests.put(f"{BASE_URL}/api/control/feature-flags/help_requests",
                          headers=hdr(admin_token), json={"enabled": True})
        assert r2.status_code == 200

    def test_maintenance_requires_reauth(self, admin_token):
        # Clear last_reauth_at on QA admin first to ensure the check triggers 428
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            import asyncio
            client = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = client[os.environ["DB_NAME"]]
            asyncio.get_event_loop().run_until_complete(
                db.admin_users.update_one({"email": QA_EMAIL}, {"$set": {"last_reauth_at": None}}))
        except Exception as e:
            pytest.skip(f"could not reset reauth ts: {e}")
        r = requests.post(f"{BASE_URL}/api/control/auth/login", json={"email": QA_EMAIL, "password": QA_PW})
        tok = r.json()["token"]
        r2 = requests.put(f"{BASE_URL}/api/control/feature-flags/maintenance_mode",
                          headers=hdr(tok), json={"enabled": True})
        assert r2.status_code == 428, f"expected 428, got {r2.status_code}: {r2.text}"
        # reauth and retry
        r3 = requests.post(f"{BASE_URL}/api/control/auth/reauth", headers=hdr(tok), json={"password": QA_PW})
        assert r3.status_code == 200
        r4 = requests.put(f"{BASE_URL}/api/control/feature-flags/maintenance_mode",
                          headers=hdr(tok), json={"enabled": True})
        assert r4.status_code == 200


# --------------------------- Enforcement ---------------------------
class TestEnforcement:
    def test_help_requests_gate(self, admin_token, app_token):
        # disable help_requests
        r = requests.put(f"{BASE_URL}/api/control/feature-flags/help_requests",
                         headers=hdr(admin_token), json={"enabled": False})
        assert r.status_code == 200
        # existing help request for priya blocks by "existing"? — endpoint gate runs first
        r2 = requests.post(f"{BASE_URL}/api/help-requests",
                           headers={"Authorization": f"Bearer {app_token}", "Content-Type": "application/json"},
                           json={"category": "Business", "public_summary": "test", "details": "test"})
        assert r2.status_code == 503, f"expected 503, got {r2.status_code}: {r2.text}"
        # re-enable
        requests.put(f"{BASE_URL}/api/control/feature-flags/help_requests",
                     headers=hdr(admin_token), json={"enabled": True})

    def test_maintenance_blocks_registration(self, admin_token):
        # Enable maintenance mode (need reauth)
        requests.post(f"{BASE_URL}/api/control/auth/reauth", headers=hdr(admin_token), json={"password": QA_PW})
        me = requests.put(f"{BASE_URL}/api/control/feature-flags/maintenance_mode",
                          headers=hdr(admin_token), json={"enabled": True})
        assert me.status_code == 200, me.text
        payload = {"name": "QA Iter22", "email": f"qa_iter22_{int(time.time())}@example.com", "password": "Intro123!", "age": 25}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code == 503, f"expected 503 (maintenance), got {r.status_code}: {r.text}"
        # turn off maintenance (need reauth still valid ~5min)
        rz = requests.put(f"{BASE_URL}/api/control/feature-flags/maintenance_mode",
                          headers=hdr(admin_token), json={"enabled": False})
        assert rz.status_code in (200, 428)
        if rz.status_code == 428:
            requests.post(f"{BASE_URL}/api/control/auth/reauth", headers=hdr(admin_token), json={"password": QA_PW})
            rz = requests.put(f"{BASE_URL}/api/control/feature-flags/maintenance_mode",
                              headers=hdr(admin_token), json={"enabled": False})
            assert rz.status_code == 200
        # after restore, register should not be 503; reachability of age<18 check
        payload2 = {"name": "QA under", "email": f"qa_iter22u_{int(time.time())}@example.com", "password": "Intro123!", "age": 16}
        r2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload2)
        assert r2.status_code != 503
        assert r2.status_code in (400, 422), f"expected 400/422 for under-age, got {r2.status_code}: {r2.text}"

    def test_connections_gate(self, admin_token, app_token):
        r = requests.put(f"{BASE_URL}/api/control/feature-flags/connections",
                         headers=hdr(admin_token), json={"enabled": False})
        assert r.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/connect/request",
                           headers={"Authorization": f"Bearer {app_token}", "Content-Type": "application/json"},
                           json={"user_id": "someone"})
        assert r2.status_code == 503, f"expected 503, got {r2.status_code}: {r2.text}"
        requests.put(f"{BASE_URL}/api/control/feature-flags/connections",
                     headers=hdr(admin_token), json={"enabled": True})


# --------------------------- App Config ---------------------------
class TestAppConfig:
    def test_get_config(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/app-config", headers=hdr(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert len(d["items"]) == 8

    def test_update_config_and_audit(self, admin_token):
        # update min_age to 18 (its default)
        r = requests.put(f"{BASE_URL}/api/control/app-config", headers=hdr(admin_token),
                         json={"key": "min_age", "value": "18"})
        assert r.status_code == 200, r.text
        # audit log
        a = requests.get(f"{BASE_URL}/api/control/audit-logs?action=app_config_updated", headers=hdr(admin_token))
        assert a.status_code == 200
        assert any(x.get("target_id") == "min_age" for x in a.json()["items"])


# --------------------------- System Health ---------------------------
class TestSystemHealth:
    def test_health(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/system-health", headers=hdr(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for s in ("api", "database", "storage", "email", "push_notifications", "memory"):
            assert s in d["services"]
        assert d["services"]["email"]["status"] == "not_configured"
        assert d["services"]["push_notifications"]["status"] == "mocked"
        assert "collections" in d
        assert "background_jobs" in d and len(d["background_jobs"]) >= 3
        assert "queues" in d
        assert "security" in d and "failed_admin_logins_24h" in d["security"]


# --------------------------- Audit consolidated ---------------------------
class TestAuditsConsolidated:
    def test_all_actions_present(self, admin_token):
        for action in ("feature_flag_updated", "app_config_updated", "notification_created", "chat_viewed"):
            r = requests.get(f"{BASE_URL}/api/control/audit-logs?action={action}", headers=hdr(admin_token))
            assert r.status_code == 200
            assert r.json()["total"] >= 1, f"no audit entries for {action}"

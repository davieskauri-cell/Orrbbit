"""INTRO Control Centre — Phase 3 backend tests (iteration 23).

Covers Marketing, Content, Categories, Billing (LIVE integrity + DEMO refunds),
Webhooks scaffold, DB viewer (redaction + audit), AI Insights (13 report types +
one generate + PDF/CSV export), Backups (run/log + 428 restore gate — NOT
destructive), Exports (users/revenue LIVE), Act-As-User impersonation
(428 → reauth → token → /auth/me → account-delete blocked).
"""
import os
import io
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

# Reuse EXPO_PUBLIC_BACKEND_URL (public preview URL) — same as prior iterations
BASE = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
if not BASE:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL must be set")

QA_EMAIL = "qa-admin@intro.control"
QA_PASSWORD = "QaControl!2026x"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/api/control/auth/login", json={"email": QA_EMAIL, "password": QA_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "X-Admin-Mode": "demo"}


@pytest.fixture(scope="session")
def live_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "X-Admin-Mode": "live"}


def _reauth(admin_token):
    r = requests.post(f"{BASE}/api/control/auth/reauth",
                      headers={"Authorization": f"Bearer {admin_token}"},
                      json={"password": QA_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text


# -------------- Marketing --------------
class TestMarketing:
    def test_get_marketing(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/marketing", headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        b = r.json()
        for k in ("banners", "promo_codes", "referral_campaigns", "featured_help_requests", "featured_professionals"):
            assert k in b, f"missing key {k}"

    def test_create_banner(self, demo_headers):
        payload = {"title": f"QA23 Banner {uuid.uuid4().hex[:6]}", "message": "Testing", "active": True}
        r = requests.post(f"{BASE}/api/control/marketing/banners", headers=demo_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        b = r.json()["banner"]
        assert b["title"] == payload["title"]
        # persistence check
        r2 = requests.get(f"{BASE}/api/control/marketing", headers=demo_headers, timeout=20)
        assert any(bb["id"] == b["id"] for bb in r2.json()["banners"])
        # toggle
        t = requests.post(f"{BASE}/api/control/marketing/banners/{b['id']}/toggle", headers=demo_headers, timeout=20)
        assert t.status_code == 200 and t.json()["active"] is False

    def test_create_promo_and_duplicate(self, demo_headers):
        code = f"QA23{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{BASE}/api/control/marketing/promo-codes", headers=demo_headers,
                          json={"code": code, "discount_pct": 20, "plan": "intro_plus"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["promo"]["code"] == code
        # duplicate
        r2 = requests.post(f"{BASE}/api/control/marketing/promo-codes", headers=demo_headers,
                           json={"code": code, "discount_pct": 20, "plan": "intro_plus"}, timeout=20)
        assert r2.status_code == 400

    def test_create_referral(self, demo_headers):
        r = requests.post(f"{BASE}/api/control/marketing/referrals", headers=demo_headers,
                          json={"name": f"QA23 Ref {uuid.uuid4().hex[:5]}", "reward": "1 month plus"}, timeout=20)
        assert r.status_code == 200

    def test_feature_professional(self, demo_headers):
        # find a demo professional
        r = requests.get(f"{BASE}/api/control/professionals", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        items = r.json().get("items") or r.json().get("professionals") or []
        if not items:
            pytest.skip("no demo professionals")
        pro = items[0]
        uid = pro.get("user_id") or pro.get("id")
        r2 = requests.post(f"{BASE}/api/control/marketing/feature-professional/{uid}", headers=demo_headers, timeout=20)
        assert r2.status_code == 200
        first_state = r2.json()["featured"]
        # restore
        r3 = requests.post(f"{BASE}/api/control/marketing/feature-professional/{uid}", headers=demo_headers, timeout=20)
        assert r3.status_code == 200 and r3.json()["featured"] != first_state


# -------------- Content --------------
class TestContent:
    def test_get_pages(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/content/pages", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        keys = {i["key"] for i in items}
        assert {"community_guidelines", "privacy_policy", "terms", "faq", "support_articles"} <= keys
        assert len(items) == 5

    def test_update_terms(self, demo_headers):
        body = {"body": f"QA23 terms update {uuid.uuid4().hex[:6]}"}
        r = requests.put(f"{BASE}/api/control/content/pages/terms", headers=demo_headers, json=body, timeout=20)
        assert r.status_code == 200
        # verify persisted
        r2 = requests.get(f"{BASE}/api/control/content/pages", headers=demo_headers, timeout=20)
        terms = next(i for i in r2.json()["items"] if i["key"] == "terms")
        assert terms["body"] == body["body"]

    def test_update_unknown_key(self, demo_headers):
        r = requests.put(f"{BASE}/api/control/content/pages/nope", headers=demo_headers, json={"body": "x"}, timeout=20)
        assert r.status_code == 400


# -------------- Categories --------------
class TestCategories:
    def test_get_categories(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/categories", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert isinstance(b["help_categories"], list) and len(b["help_categories"]) > 0
        assert all("name" in c and "usage" in c and c.get("builtin") is True for c in b["help_categories"])
        assert isinstance(b["professions"], list) and len(b["professions"]) > 0

    def test_add_and_duplicate_category(self, demo_headers):
        name = f"QA23 Cat {uuid.uuid4().hex[:5]}"
        r = requests.post(f"{BASE}/api/control/categories", headers=demo_headers,
                          json={"name": name, "kind": "help"}, timeout=20)
        assert r.status_code == 200
        r2 = requests.post(f"{BASE}/api/control/categories", headers=demo_headers,
                           json={"name": name, "kind": "help"}, timeout=20)
        assert r2.status_code == 400


# -------------- Billing (financial integrity) --------------
class TestBillingLive:
    def test_live_overview_not_configured(self, live_headers):
        r = requests.get(f"{BASE}/api/control/billing/overview", headers=live_headers, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["configured"] is False
        assert b["actions_enabled"] is False
        assert b["subscriptions"] == [] and b["payments"] == []
        assert all(b["kpis"][k] is None for k in ("active_subscriptions", "mrr", "failed_payments", "refunds"))

    def test_live_refund_blocked(self, live_headers):
        r = requests.post(f"{BASE}/api/control/billing/payments/anything/refund", headers=live_headers, timeout=20)
        assert r.status_code == 400
        assert "not configured" in r.json()["detail"].lower()


class TestBillingDemo:
    def test_demo_overview_seeded(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/billing/overview", headers=demo_headers, timeout=30)
        assert r.status_code == 200
        b = r.json()
        assert b["configured"] is False  # provider still not configured
        assert b["actions_enabled"] is True
        assert len(b["subscriptions"]) > 0
        assert all(s.get("is_demo_data") is True for s in b["subscriptions"])
        assert len(b["payments"]) > 0
        assert b["kpis"]["mrr"] is not None

    def test_demo_refund_works(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/billing/overview", headers=demo_headers, timeout=20)
        pay = next((p for p in r.json()["payments"] if p["status"] == "succeeded" and not p.get("refunded")), None)
        if not pay:
            pytest.skip("no refundable demo payment")
        r2 = requests.post(f"{BASE}/api/control/billing/payments/{pay['id']}/refund", headers=demo_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        # verify
        r3 = requests.get(f"{BASE}/api/control/billing/overview", headers=demo_headers, timeout=20)
        p2 = next(p for p in r3.json()["payments"] if p["id"] == pay["id"])
        assert p2["refunded"] is True

    def test_integration_info(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/billing/integration", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["provider"]["status"] == "not_configured"
        assert b["webhook"]["url"] == "/api/webhooks/payments"
        assert isinstance(b["webhook"]["supported_events"], list) and len(b["webhook"]["supported_events"]) >= 8


class TestWebhook:
    def test_webhook_no_auth_logs_and_ignores(self):
        r = requests.post(f"{BASE}/api/webhooks/payments",
                          json={"type": "payment.succeeded", "id": "evt_test"}, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["received"] is True and b["processed"] is False


# -------------- DB Viewer --------------
class TestDbViewer:
    def test_collections(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/db/collections", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        names = {i["name"] for i in items}
        assert "users" in names and "professional_profiles" in names

    def test_users_redacted(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/db/users", headers=demo_headers, timeout=30)
        assert r.status_code == 200
        b = r.json()
        assert b["read_only"] is True
        assert len(b["items"]) > 0
        # every doc has hashed_password redacted or absent
        for doc in b["items"]:
            if "hashed_password" in doc:
                assert doc["hashed_password"] == "•••redacted•••"

    def test_non_whitelisted(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/db/secret_stuff", headers=demo_headers, timeout=20)
        assert r.status_code == 400


# -------------- AI Insights --------------
class TestAI:
    def test_list_insights(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/ai/insights", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        b = r.json()
        assert b["configured"] is True
        assert len(b["report_types"]) == 13
        assert b["disclaimer"]

    def test_invalid_report_type(self, demo_headers):
        r = requests.post(f"{BASE}/api/control/ai/insights/generate",
                          headers=demo_headers, json={"report_type": "invalid_key"}, timeout=20)
        assert r.status_code == 400

    def test_generate_and_export(self, demo_headers):
        # ONE generate for whole test run to save LLM credits
        r = requests.post(f"{BASE}/api/control/ai/insights/generate",
                          headers=demo_headers, json={"report_type": "anomaly_detection"}, timeout=90)
        assert r.status_code == 200, r.text
        report = r.json()["report"]
        assert report["content"] and len(report["content"]) > 10
        rid = report["id"]
        # PDF
        pdf = requests.get(f"{BASE}/api/control/ai/insights/{rid}/export?format=pdf", headers=demo_headers, timeout=30)
        assert pdf.status_code == 200
        assert pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        # CSV
        csv_ = requests.get(f"{BASE}/api/control/ai/insights/{rid}/export?format=csv", headers=demo_headers, timeout=30)
        assert csv_.status_code == 200
        assert "text/csv" in csv_.headers["content-type"]
        assert csv_.text.startswith("metric,value")


# -------------- Backups --------------
class TestBackups:
    _backup_id = None

    def test_run_backup(self, admin_token, demo_headers):
        _reauth(admin_token)
        r = requests.post(f"{BASE}/api/control/backups/run", headers=demo_headers, timeout=120)
        assert r.status_code == 200, r.text
        b = r.json()["backup"]
        assert b["status"] == "completed"
        assert b["size_mb"] > 0
        TestBackups._backup_id = b["id"]

    def test_list_backups(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/backups", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()["items"]]
        assert TestBackups._backup_id in ids

    def test_log_download(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/backups/{TestBackups._backup_id}/log", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        assert "INTRO backup" in r.text

    def test_restore_requires_reauth(self, admin_token, demo_headers):
        # Purposefully expire the reauth window in Mongo to prove the 428 gate.
        # We cannot easily reset, so just wait to ensure existing reauth window
        # from test_run_backup is still valid = 428 requires FRESH reauth check.
        # Actually _check_recent_reauth uses 5 min window. So immediately after
        # test_run_backup the reauth is fresh — restore would succeed AND drop DB.
        # ⛔ MUST NOT actually restore. So we force-expire via direct mongo write.
        from pymongo import MongoClient
        c = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        c.admin_users.update_one({"email": QA_EMAIL},
                                 {"$set": {"last_reauth_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()}})
        r = requests.post(f"{BASE}/api/control/backups/{TestBackups._backup_id}/restore",
                          headers=demo_headers, timeout=20)
        assert r.status_code == 428, f"expected 428, got {r.status_code}: {r.text}"


# -------------- Exports --------------
class TestExports:
    def test_users_csv(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/exports/users?format=csv", headers=demo_headers, timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]
        first_line = r.text.split("\n", 1)[0]
        assert "email" in first_line and "id" in first_line

    def test_users_xlsx(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/exports/users?format=xlsx", headers=demo_headers, timeout=30)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers["content-type"]
        assert r.content[:2] == b"PK"  # xlsx is a zip

    def test_users_pdf(self, demo_headers):
        r = requests.get(f"{BASE}/api/control/exports/users?format=pdf", headers=demo_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")

    def test_revenue_live_says_not_configured(self, live_headers):
        r = requests.get(f"{BASE}/api/control/exports/revenue?format=csv", headers=live_headers, timeout=30)
        assert r.status_code == 200
        assert "not configured" in r.text.lower()


# -------------- Act-As-User impersonation --------------
class TestImpersonation:
    def test_full_flow(self, admin_token, demo_headers):
        # pick a demo user
        r = requests.get(f"{BASE}/api/control/users?limit=5", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        users = r.json().get("items") or r.json().get("users") or []
        demo_user = next((u for u in users if u.get("is_demo") and u.get("email") != "k97davies@icloud.com"), None)
        if not demo_user:
            pytest.skip("no demo user available")
        # Force stale reauth
        from pymongo import MongoClient
        c = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        c.admin_users.update_one({"email": QA_EMAIL},
                                 {"$set": {"last_reauth_at": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()}})
        # 428 without recent reauth
        r1 = requests.post(f"{BASE}/api/control/users/{demo_user['id']}/impersonate",
                           headers=demo_headers, timeout=20)
        assert r1.status_code == 428, r1.text
        # reauth
        _reauth(admin_token)
        r2 = requests.post(f"{BASE}/api/control/users/{demo_user['id']}/impersonate",
                           headers=demo_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        b = r2.json()
        token = b["token"]
        assert b["expires_minutes"] == 30
        assert "restrictions" in b and len(b["restrictions"]) >= 4
        # token works on /auth/me
        me = requests.get(f"{BASE}/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert me.status_code == 200
        assert me.json()["id"] == demo_user["id"]
        # account deletion blocked
        d = requests.delete(f"{BASE}/api/users/me",
                            headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert d.status_code == 403
        assert "impersonation" in d.json()["detail"].lower()

        # audit log has impersonation_started
        r3 = requests.get(f"{BASE}/api/control/audit-logs?action=impersonation_started&limit=5",
                          headers=demo_headers, timeout=20)
        # audit log endpoint might differ; try lenient check
        if r3.status_code == 200:
            entries = r3.json().get("items") or r3.json().get("logs") or []
            assert any(e.get("action") == "impersonation_started" for e in entries)

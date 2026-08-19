"""Iteration 37 — 3-tier radius subscription + billing sandbox coverage."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nearby-connect-93.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def demo_sarah():
    r = requests.post(f"{API}/auth/login", json={"email": "sarah@intro.demo", "password": "Intro123!"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/control/auth/login",
                      json={"email": "qa-admin@intro.control", "password": "QawqvEcQ-eOdWT!7"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def fresh_user(verify_email):
    email = f"test_iter37_{uuid.uuid4().hex[:10]}@example.com"
    payload = {
        "email": email, "password": "Passw0rd!23", "name": "Test Iter37",
        "date_of_birth": "1990-01-01", "accept_policies": True,
    }
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    verify_email(email)  # pass iter43 hard gate
    return r.json()["access_token"], r.json()["user"], email


# ---------------- Fresh register defaults ----------------
class TestFreshRegisterDefaults:
    def test_default_free_plan_and_radius(self, fresh_user):
        _, user, _ = fresh_user
        assert user["plan"] == "free"
        assert user["radius"] == 250
        assert user["max_radius"] == 250
        assert user["radius_options"] == [100, 250]


# ---------------- Free user radius clamping + plan self-set 403 ----------------
class TestFreeUserRadiusAndPlan:
    def _put(self, token, body):
        return requests.put(f"{API}/users/me/state", json=body, headers=_headers(token))

    def test_radius_over_cap_clamped_to_250(self, fresh_user):
        token, _, _ = fresh_user
        for r_val in [500, 750, 1000]:
            resp = self._put(token, {"radius": r_val})
            assert resp.status_code == 200, resp.text
            assert resp.json()["radius"] == 250, f"radius {r_val} not clamped to 250 (got {resp.json()['radius']})"

    def test_radius_100_allowed(self, fresh_user):
        token, _, _ = fresh_user
        resp = self._put(token, {"radius": 100})
        assert resp.status_code == 200
        assert resp.json()["radius"] == 100

    def test_free_user_cannot_self_upgrade_to_pro(self, fresh_user):
        token, _, _ = fresh_user
        r = self._put(token, {"plan": "pro"})
        assert r.status_code == 403

    def test_free_user_cannot_self_upgrade_to_plus(self, fresh_user):
        token, _, _ = fresh_user
        r = self._put(token, {"plan": "plus"})
        assert r.status_code == 403

    def test_free_user_setting_free_ok(self, fresh_user):
        token, _, _ = fresh_user
        r = self._put(token, {"plan": "free"})
        assert r.status_code == 200
        assert r.json()["plan"] == "free"


# ---------------- Real user sandbox purchase → 403 ----------------
class TestRealUserSandboxDenied:
    def test_real_user_sandbox_purchase_403(self, fresh_user):
        token, _, _ = fresh_user
        r = requests.post(f"{API}/billing/sandbox/purchase",
                          json={"plan": "plus", "platform": "ios"},
                          headers=_headers(token))
        assert r.status_code == 403
        assert "aren't available yet" in r.json().get("detail", "").lower()


# ---------------- billing/config + verify + subscription shape ----------------
class TestBillingConfig:
    def test_config_products_and_mode(self, demo_sarah):
        token, _ = demo_sarah
        r = requests.get(f"{API}/billing/config", headers=_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert data["billing_mode"] == "sandbox"
        ids = {p["ios_product_id"] for p in data["products"]}
        aids = {p["android_product_id"] for p in data["products"]}
        prices = {p["preview_price"] for p in data["products"]}
        assert "com.orrbbit.mobile.plus.monthly" in ids
        assert "orrbbit_plus_monthly" in aids
        assert "$6.99" in prices and "$11.99" in prices

    def test_verify_returns_501(self, demo_sarah):
        token, _ = demo_sarah
        r = requests.post(f"{API}/billing/verify",
                          json={"platform": "ios", "receipt": "abc"},
                          headers=_headers(token))
        assert r.status_code == 501


# ---------------- Demo user full lifecycle ----------------
class TestDemoUserSubscriptionLifecycle:
    """IMPORTANT: leaves Sarah on FREE plan at the end."""

    def test_full_lifecycle(self, demo_sarah):
        token, user = demo_sarah
        h = _headers(token)

        # Start clean: expire any active entitlement first
        requests.post(f"{API}/billing/sandbox/expire", json={}, headers=h)

        # 1) Purchase plus
        r = requests.post(f"{API}/billing/sandbox/purchase",
                          json={"plan": "plus", "platform": "ios"}, headers=h)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["ok"] is True
        assert "Welcome to Orrbbit Plus" in j["message"]
        assert "500 m" in j["message"]
        ent = j["entitlement"]
        assert ent["sandbox"] is True
        assert ent["original_transaction_id"].startswith("SANDBOX-")
        assert ent["plan"] == "plus"

        # 2) /auth/me reflects plus
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["plan"] == "plus"
        assert me["max_radius"] == 500

        # 3) Radius 500 allowed for plus
        r = requests.put(f"{API}/users/me/state", json={"radius": 500}, headers=h)
        assert r.status_code == 200
        assert r.json()["radius"] == 500

        # 4) Radius 750 clamped to 500
        r = requests.put(f"{API}/users/me/state", json={"radius": 750}, headers=h)
        assert r.status_code == 200
        assert r.json()["radius"] == 500

        # 5) Upgrade to pro
        r = requests.post(f"{API}/billing/sandbox/purchase",
                          json={"plan": "pro", "platform": "ios"}, headers=h)
        assert r.status_code == 200
        assert "Pro" in r.json()["message"] and "1 km" in r.json()["message"]

        # 6) Radius 1000 allowed for pro
        r = requests.put(f"{API}/users/me/state", json={"radius": 1000}, headers=h)
        assert r.status_code == 200
        assert r.json()["radius"] == 1000

        # 7) GET /users/me/subscription reflects pro + renewal
        r = requests.get(f"{API}/users/me/subscription", headers=h)
        assert r.status_code == 200
        sub = r.json()
        assert sub["plan"] == "pro"
        assert sub["max_radius_m"] == 1000
        assert sub["entitlement"]["renewal_date"]
        assert sub["entitlement"]["auto_renew_status"] is True

        # 8) Cancel → auto_renew false
        r = requests.post(f"{API}/billing/sandbox/cancel", json={}, headers=h)
        assert r.status_code == 200
        sub = requests.get(f"{API}/users/me/subscription", headers=h).json()
        assert sub["entitlement"]["auto_renew_status"] is False

        # 9) Restore within period should still work (auto_renew false but not expired)
        r = requests.post(f"{API}/billing/restore", json={}, headers=h)
        assert r.status_code == 200
        # Message may be restored=True since expiration_date > now
        assert "message" in r.json()

        # 10) Expire → back to free, radius clamped, radius_migration_notice flag
        r = requests.post(f"{API}/billing/sandbox/expire", json={}, headers=h)
        assert r.status_code == 200
        assert r.json()["plan"] == "free"

        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["plan"] == "free"
        assert me["radius"] <= 250
        assert me["radius_migration_notice"] is True

        # 11) Restore now — may return no-purchases OR restore superseded plus (still within 30d period).
        # Both are acceptable per spec; endpoint must respond 200 with a message.
        r = requests.post(f"{API}/billing/restore", json={}, headers=h)
        assert r.status_code == 200
        assert "message" in r.json()
        # If restored (superseded plus still valid), expire again so sarah ends on FREE.
        if r.json().get("restored"):
            requests.post(f"{API}/billing/sandbox/expire", json={}, headers=h)

        # 12) Clear the radius-migration-notice flag
        r = requests.post(f"{API}/users/me/radius-notice-seen", headers=h)
        assert r.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["radius_migration_notice"] is False


# ---------------- Admin ----------------
class TestAdminBilling:
    def test_control_billing_get(self, admin_token):
        r = requests.get(f"{API}/control/billing", headers=_headers(admin_token))
        assert r.status_code == 200
        assert r.json()["billing_mode"] == "sandbox"
        assert "products" in r.json()

    def test_admin_cannot_set_entitlement_on_real_user(self, admin_token, fresh_user):
        _, _, email = fresh_user
        r = requests.post(f"{API}/control/billing/demo-entitlement",
                          json={"email": email, "plan": "plus"},
                          headers=_headers(admin_token))
        assert r.status_code == 403

    def test_admin_can_set_entitlement_on_demo_user_then_revert(self, admin_token):
        # Use james@intro.demo (was plus in seed anyway) — set plus then back to free
        r = requests.post(f"{API}/control/billing/demo-entitlement",
                          json={"email": "james@intro.demo", "plan": "plus"},
                          headers=_headers(admin_token))
        assert r.status_code == 200
        # revert back
        r2 = requests.post(f"{API}/control/billing/demo-entitlement",
                           json={"email": "james@intro.demo", "plan": "free"},
                           headers=_headers(admin_token))
        assert r2.status_code == 200


# ---------------- Regressions ----------------
class TestRegressions:
    def test_nearby_free_user(self, fresh_user):
        token, _, _ = fresh_user
        # set melbourne coords
        r = requests.put(f"{API}/users/me/state",
                         json={"lat": -37.8136, "lng": 144.9631, "vibe": "open_to_chat", "visible": True, "radius": 250},
                         headers=_headers(token))
        assert r.status_code == 200
        r = requests.get(f"{API}/nearby?lat=-37.8136&lng=144.9631", headers=_headers(token))
        assert r.status_code == 200
        assert "users" in r.json()
        assert r.json()["radius"] <= 250

    def test_vibes_still_returns_visible_list(self):
        r = requests.get(f"{API}/vibes")
        assert r.status_code == 200
        keys = [v["key"] for v in r.json()]
        assert "networking" in keys

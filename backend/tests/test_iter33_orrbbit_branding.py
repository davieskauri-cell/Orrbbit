"""
Iteration 33 — Orrbbit final native-identifier migration + logo installation
Backend regression:
  1. Config sanity (app.json / eas.json) — scheme, package/bundle IDs, name
  2. Assets present & valid on disk (icon, adaptive, notification, favicon, email)
  3. Preview backend serves /api/email-assets/orrbbit-logo-v2.png as 200 image/png
  4. EVENT_CODES: ORB100 present, INTRO100 removed
  5. Control email templates: welcome preview references v2 logo + ORRBBIT alt + browser hint
  6. Auth regression: register QA user, login, forgot-password, demo-login, cleanup
"""
import json
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from PIL import Image

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

APP_JSON = Path("/app/frontend/app.json")
EAS_JSON = Path("/app/frontend/eas.json")
ASSETS = Path("/app/frontend/assets/images")
EMAIL_ASSET = Path("/app/backend/static/email-assets/orrbbit-logo-v2.png")
BACKEND_ENV = Path("/app/backend/.env")


def _read_env(key: str) -> str:
    for line in BACKEND_ENV.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"')
    return ""


QA_EMAIL = "qa-admin@intro.control"
QA_PASSWORD = "QawqvEcQ-eOdWT!7"


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/control/auth/login",
                      json={"email": QA_EMAIL, "password": QA_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"control admin login failed: {r.status_code} {r.text[:200]}")
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in response {r.json()}"
    return tok


# ============ (1) Config sanity ============

class TestConfigSanity:
    def test_app_json_name_orrbbit(self):
        cfg = json.loads(APP_JSON.read_text())["expo"]
        assert cfg["name"] == "ORRBBIT"

    def test_app_json_scheme_orrbbit(self):
        cfg = json.loads(APP_JSON.read_text())["expo"]
        assert cfg["scheme"] == "orrbbit"

    def test_app_json_bundle_and_package(self):
        cfg = json.loads(APP_JSON.read_text())["expo"]
        assert cfg["ios"]["bundleIdentifier"] == "com.orrbbit.mobile"
        assert cfg["android"]["package"] == "com.orrbbit.mobile"

    def test_app_json_notification_icon(self):
        cfg = json.loads(APP_JSON.read_text())["expo"]
        notif = cfg.get("notification", {})
        assert notif.get("icon", "").endswith("notification-icon.png")
        assert notif.get("color", "").upper() == "#16B6B0"
        assert Path("/app/frontend", notif["icon"].lstrip("./")).exists()

    def test_no_introapp_or_scheme_frontend_in_configs(self):
        for p in [APP_JSON, EAS_JSON]:
            if not p.exists():
                continue
            txt = p.read_text()
            assert "com.introapp" not in txt, f"'com.introapp' still in {p}"
            # Ensure no scheme:"frontend" reference (be flexible on whitespace)
            assert '"scheme": "frontend"' not in txt, f'"scheme":"frontend" still in {p}'
            assert '"scheme":"frontend"' not in txt, f'"scheme":"frontend" still in {p}'

    def test_referenced_assets_exist(self):
        cfg = json.loads(APP_JSON.read_text())["expo"]
        refs = [
            cfg["icon"],
            cfg["android"]["adaptiveIcon"]["foregroundImage"],
            cfg["web"]["favicon"],
            cfg["notification"]["icon"],
        ]
        for plugin in cfg.get("plugins", []):
            if isinstance(plugin, list) and plugin[0] == "expo-splash-screen":
                refs.append(plugin[1]["image"])
        for r in refs:
            full = Path("/app/frontend") / r.lstrip("./")
            assert full.exists(), f"asset missing: {full}"


# ============ (2) Asset validation ============

class TestAssets:
    def test_icon_1024_rgb_opaque(self):
        img = Image.open(ASSETS / "icon.png")
        assert img.size == (1024, 1024)
        rgba = img.convert("RGBA")
        alpha = rgba.split()[-1].getextrema()
        assert alpha == (255, 255), f"icon.png must be opaque, got alpha range {alpha}"

    def test_adaptive_icon_transparent_corners(self):
        img = Image.open(ASSETS / "adaptive-icon.png").convert("RGBA")
        assert img.size == (1024, 1024)
        w, h = img.size
        for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            assert img.getpixel(c)[3] == 0, f"corner {c} not transparent"

    def test_favicon_32(self):
        img = Image.open(ASSETS / "favicon.png")
        assert img.size == (32, 32)

    def test_notification_icon_96_and_uses_alpha(self):
        img = Image.open(ASSETS / "notification-icon.png").convert("RGBA")
        assert img.size == (96, 96)
        # Must contain both transparent and visible pixels (silhouette shape)
        alpha_ext = img.split()[-1].getextrema()
        assert alpha_ext[0] == 0 and alpha_ext[1] > 0

    def test_email_asset_exists_rgba(self):
        assert EMAIL_ASSET.exists()
        img = Image.open(EMAIL_ASSET).convert("RGBA")
        alpha = img.split()[-1].getextrema()
        assert alpha[0] == 0, "email logo should have transparent pixels"


# ============ (3) Preview backend serves email logo ============

class TestEmailAssetEndpoint:
    def test_get_email_logo_v2_200_png(self):
        r = requests.get(f"{BASE_URL}/api/email-assets/orrbbit-logo-v2.png", timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        assert "image/png" in r.headers.get("content-type", ""), r.headers.get("content-type")
        assert len(r.content) > 1000

    def test_email_logo_url_env_matches_prod_host(self):
        url = _read_env("EMAIL_LOGO_URL")
        assert url.endswith("orrbbit-logo-v2.png"), f"EMAIL_LOGO_URL={url}"


# ============ (4) EVENT_CODES ORB100 ============

class TestEventCodes:
    def test_orb100_present_and_intro100_absent_in_server(self):
        server_py = Path("/app/backend/server.py").read_text()
        assert "ORB100" in server_py
        assert "INTRO100" not in server_py

    def test_join_event_placeholder_and_chips(self):
        txt = Path("/app/frontend/app/join-event.tsx").read_text()
        assert "ORB100" in txt
        assert "INTRO100" not in txt


# ============ (5) Email templates regression ============

class TestEmailTemplates:
    def test_templates_count_at_least_56(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/control/email/templates",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        templates = data if isinstance(data, list) else data.get("templates", data.get("items", []))
        assert len(templates) >= 56, f"expected >=56 templates, got {len(templates)}"

    def test_welcome_preview_has_v2_logo_and_branding(self, admin_token):
        hdr = {"Authorization": f"Bearer {admin_token}"}
        # Try multiple preview endpoint patterns
        candidates = [
            f"{BASE_URL}/api/control/email/templates/welcome/preview",
            f"{BASE_URL}/api/control/email/preview/welcome",
            f"{BASE_URL}/api/control/email/templates/preview?template=welcome",
        ]
        html = ""
        last_status = None
        for url in candidates:
            r = requests.get(url, headers=hdr, timeout=15)
            last_status = r.status_code
            if r.status_code == 200:
                data = r.json() if "application/json" in r.headers.get("content-type", "") else {"html": r.text}
                html = data.get("html") or data.get("body") or data.get("preview") or r.text
                if html:
                    break
        if not html:
            # POST fallback
            r = requests.post(f"{BASE_URL}/api/control/email/preview",
                              headers=hdr, json={"template": "welcome"}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                html = data.get("html") or data.get("body") or ""
                last_status = 200
        assert html, f"could not fetch welcome preview (last_status={last_status})"
        assert "orrbbit-logo-v2.png" in html, "welcome html missing orrbbit-logo-v2.png"
        assert 'alt="ORRBBIT"' in html or "alt='ORRBBIT'" in html, "welcome missing alt=ORRBBIT"
        assert "Open this securely in your browser." in html, "browser hint missing"
        assert "preview.emergentagent" not in html, "should not reference preview host"


# ============ (6) Auth regression ============

class TestAuthRegression:
    _created_email = None
    _created_token = None

    def test_register_qa_user(self, api_client):
        uniq = uuid.uuid4().hex[:8]
        email = f"QA_iter33_{uniq}@example.com"
        payload = {"name": "QA Iter33", "email": email,
                   "password": "QaIter33Pass!", "age": 27}
        r = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        tok = data.get("token") or data.get("access_token")
        assert tok, f"no token in register response: {list(data.keys())}"
        TestAuthRegression._created_email = email
        TestAuthRegression._created_token = tok

    def test_login_with_registered_qa_user(self, api_client):
        assert TestAuthRegression._created_email
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": TestAuthRegression._created_email,
                                  "password": "QaIter33Pass!"}, timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert r.json().get("token") or r.json().get("access_token")

    def test_forgot_password(self, api_client):
        # Use delivered@resend.dev — safe test sink
        r = api_client.post(f"{BASE_URL}/api/auth/forgot-password",
                            json={"email": "delivered@resend.dev"}, timeout=20)
        assert r.status_code in (200, 202), f"forgot-password: {r.status_code} {r.text[:200]}"

    def test_demo_login_regression(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("token") or r.json().get("access_token")

    def test_cleanup_qa_user(self, api_client):
        """Delete the QA user via DELETE /api/users/me."""
        if not TestAuthRegression._created_token:
            pytest.skip("no user was created")
        r = api_client.delete(f"{BASE_URL}/api/users/me",
                              headers={"Authorization": f"Bearer {TestAuthRegression._created_token}"},
                              timeout=15)
        # 200 or 204 acceptable
        assert r.status_code in (200, 204), f"cleanup failed: {r.status_code} {r.text[:200]}"

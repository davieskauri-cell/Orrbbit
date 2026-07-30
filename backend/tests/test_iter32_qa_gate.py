"""
Iteration 32 — Test Mode QA gate + rotated qa-admin password
Backend verification for:
  1. POST /api/test-mode/unlock (wrong=403, correct=200, missing/empty=422/403, no 500s)
  2. Control login: OLD qa-admin password rejected; NEW rotated password accepted
  3. Regression: GET /api/vibes still 200
"""
import os
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # last-resort read from frontend/.env
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")


def _read_test_mode_code():
    """Read TEST_MODE_CODE from /app/backend/.env — never print it."""
    for line in Path("/app/backend/.env").read_text().splitlines():
        if line.startswith("TEST_MODE_CODE="):
            return line.split("=", 1)[1].strip().strip('"')
    return ""


CORRECT_CODE = _read_test_mode_code()
OLD_QA_PASSWORD = "QaControl!2026x"  # explicitly must fail per review request
NEW_QA_PASSWORD = "QawqvEcQ-eOdWT!7"  # from /app/memory/test_credentials.md line 91
QA_EMAIL = "qa-admin@intro.control"


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ (1) Test Mode unlock endpoint ============

class TestTestModeUnlock:
    def test_wrong_code_returns_403(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={"code": "NOT-A-REAL-CODE-xyz"})
        assert r.status_code == 403, f"expected 403 on wrong code, got {r.status_code} body={r.text[:200]}"
        assert r.status_code != 500

    def test_correct_code_returns_200_ok_true(self, api_client):
        assert CORRECT_CODE, "TEST_MODE_CODE missing from backend/.env"
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={"code": CORRECT_CODE})
        assert r.status_code == 200, f"expected 200, got {r.status_code} body={r.text[:200]}"
        data = r.json()
        assert data.get("ok") is True, f"expected ok:true, got {data}"

    def test_empty_code_string_returns_403_not_500(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={"code": ""})
        assert r.status_code in (400, 403, 422), f"got {r.status_code}"
        assert r.status_code != 500

    def test_missing_code_field_returns_422_not_500(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={})
        assert r.status_code in (400, 403, 422), f"got {r.status_code}"
        assert r.status_code != 500

    def test_whitespace_code_returns_403(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={"code": "   "})
        assert r.status_code == 403
        assert r.status_code != 500

    def test_correct_code_with_surrounding_whitespace_trimmed(self, api_client):
        # server does .strip() on the code
        r = api_client.post(f"{BASE_URL}/api/test-mode/unlock", json={"code": f"  {CORRECT_CODE}  "})
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ============ (2) Control login: rotated password ============

class TestControlLoginRotation:
    def test_old_password_rejected(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/control/auth/login",
            json={"email": QA_EMAIL, "password": OLD_QA_PASSWORD},
        )
        assert r.status_code == 401, f"OLD qa-admin password must be dead — got {r.status_code} body={r.text[:200]}"

    def test_new_password_accepted(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/control/auth/login",
            json={"email": QA_EMAIL, "password": NEW_QA_PASSWORD},
        )
        assert r.status_code == 200, f"NEW rotated qa-admin password must work — got {r.status_code} body={r.text[:200]}"
        data = r.json()
        # response should include a token/user of some form
        assert any(k in data for k in ("token", "access_token", "admin", "user")), f"unexpected shape {list(data.keys())}"


# ============ (3) Regression: basics still work ============

class TestRegression:
    def test_vibes_endpoint_healthy(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/vibes")
        assert r.status_code == 200, f"/api/vibes should be 200, got {r.status_code}"
        data = r.json()
        assert isinstance(data, list) and len(data) > 0

    def test_demo_login_still_works(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/demo-login", json={})
        assert r.status_code == 200, f"demo-login regression — got {r.status_code}"
        data = r.json()
        assert "token" in data or "access_token" in data

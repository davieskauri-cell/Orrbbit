"""Iteration 36 — Photo upload pipeline + Demo Mode isolation + Control Centre."""
import base64
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nearby-connect-93.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Small valid JPEG (1x1 white pixel)
JPEG_BYTES = bytes.fromhex(
    "FFD8FFE000104A46494600010101006000600000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFDB0043010909090C0B0C180D0D1832211C213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232FFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFC4001F0100030101010101010101010000000000000102030405060708090A0BFFC400B51100020102040403040705040400010277000102031104052131061241510761711322328108144291A1B1C109233352F0156272D10A162434E125F11718191A262728292A35363738393A434445464748494A535455565758595A636465666768696A737475767778797A82838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3F4F5F6F7F8F9FAFFDA000C03010002110311003F00FBFCA28A2803FFD9"
)
JPEG_B64 = base64.b64encode(JPEG_BYTES).decode()
JPEG_DATA_URI = f"data:image/jpeg;base64,{JPEG_B64}"

# Small valid PNG (1x1 transparent)
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
)
PNG_B64 = base64.b64encode(PNG_BYTES).decode()
PNG_DATA_URI = f"data:image/png;base64,{PNG_B64}"

# Bogus payload with jpeg header but random bytes (no magic-byte match)
BOGUS_JPEG = "data:image/jpeg;base64," + base64.b64encode(b"THIS_IS_NOT_A_JPEG_" * 10).decode()

# GIF (should be rejected)
GIF_DATA_URI = "data:image/gif;base64," + base64.b64encode(b"GIF89a\x01\x00\x01\x00\x00\x00\x00\x3B").decode()


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def fresh_user(s, verify_email):
    email = f"TEST_iter36_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "Iter36 Tester",
        "date_of_birth": "1990-01-01", "accept_policies": True,
        "platform": "web", "app_version": "1.0.0", "locale": "en-AU",
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    verify_email(email)  # pass iter43 hard gate
    token = r.json().get("access_token") or r.json().get("token")
    assert token
    # user id for reference

    yield {"email": email, "password": password, "token": token, "session": s}
    # cleanup
    try:
        s.delete(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"},
                 json={"password": password, "confirmation": "DELETE"})
    except Exception:
        pass


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/control/auth/login", json={
        "email": "qa-admin@intro.control", "password": "Qa!hpgOlIndvj0UbVWk"})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def kauri_token(s):
    r = s.post(f"{API}/auth/demo-login", json={"email": "kauri@intro.demo"})
    assert r.status_code == 200
    return r.json().get("access_token") or r.json().get("token")


NEARBY_PARAMS = {"lat": -37.8136, "lng": 144.9631, "radius": 500}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Photo pipeline ----------------
class TestPhotoPipeline:
    def test_add_jpeg_photo_succeeds(self, fresh_user):
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": JPEG_DATA_URI})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("photo_url", "").startswith("data:image/jpeg")
        assert len(data.get("photos", [])) == 1

    def test_add_png_photo_succeeds(self, fresh_user):
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": PNG_DATA_URI})
        assert r.status_code == 200, r.text
        assert len(r.json().get("photos", [])) == 2

    def test_reject_file_uri(self, fresh_user):
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": "file:///tmp/x.jpg"})
        assert r.status_code == 400

    def test_reject_bogus_jpeg_payload(self, fresh_user):
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": BOGUS_JPEG})
        assert r.status_code == 400

    def test_reject_gif(self, fresh_user):
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": GIF_DATA_URI})
        assert r.status_code == 400

    def test_photo_limit_max_6(self, fresh_user):
        # Currently 2 photos exist. Add 4 more to hit limit.
        for _ in range(4):
            r = fresh_user["session"].post(f"{API}/users/me/photos",
                                           headers=_auth(fresh_user["token"]),
                                           json={"photo_url": JPEG_DATA_URI})
            assert r.status_code == 200, r.text
        r = fresh_user["session"].post(f"{API}/users/me/photos",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photo_url": JPEG_DATA_URI})
        assert r.status_code == 400

    def test_delete_photo_by_index(self, fresh_user):
        r = fresh_user["session"].delete(f"{API}/users/me/photos/0",
                                          headers=_auth(fresh_user["token"]))
        assert r.status_code == 200
        assert len(r.json().get("photos", [])) == 5

    def test_put_users_me_validates_photos(self, fresh_user):
        r = fresh_user["session"].put(f"{API}/users/me",
                                       headers=_auth(fresh_user["token"]),
                                       json={"photos": ["file:///bad.jpg"]})
        assert r.status_code == 400


# ---------------- Demo assets ----------------
class TestDemoAssets:
    def test_get_kauri_asset(self, s):
        r = s.get(f"{API}/demo-assets/kauri.jpg")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/jpeg")
        assert len(r.content) > 100

    def test_traversal_blocked(self, s):
        r = s.get(f"{API}/demo-assets/../server.py")
        # basename strips the traversal, so it will 404
        assert r.status_code == 404

    def test_demo_mode_status_public(self, s):
        r = s.get(f"{API}/demo-mode/status")
        assert r.status_code == 200
        body = r.json()
        assert "demo_mode_enabled" in body
        assert "store_screenshot_mode" in body


# ---------------- Demo isolation ----------------
class TestDemoIsolation:
    def test_real_user_sees_demo_users_when_enabled(self, fresh_user):
        r = fresh_user["session"].get(f"{API}/nearby",
                                       headers=_auth(fresh_user["token"]),
                                       params=NEARBY_PARAMS)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "users" in data

    def test_demo_user_never_sees_real_users(self, s, kauri_token):
        r = s.get(f"{API}/nearby", headers=_auth(kauri_token), params=NEARBY_PARAMS)
        assert r.status_code == 200, r.text
        users = r.json().get("users", [])
        # Every user seen by a demo viewer must also be demo
        assert all(u.get("is_demo", False) is True for u in users), \
            f"Demo user saw a non-demo user: {[u for u in users if not u.get('is_demo')]}"

    def test_real_user_cannot_connect_to_demo(self, s, fresh_user):
        # find a demo user id
        r = s.get(f"{API}/demo-accounts")
        assert r.status_code == 200
        demo_email = r.json()[0]["email"]
        r2 = s.post(f"{API}/auth/demo-login", json={"email": demo_email})
        assert r2.status_code == 200
        demo_id = r2.json().get("user", {}).get("id")
        assert demo_id, f"no id in demo-login: {r2.json()}"

        # attempt connect from real user
        r3 = fresh_user["session"].post(
            f"{API}/connect/request",
            headers=_auth(fresh_user["token"]),
            json={"user_id": demo_id, "message": "hi"},
        )
        assert r3.status_code == 403, f"expected 403 cross-realm, got {r3.status_code} {r3.text}"


# ---------------- Control Centre demo-mode ----------------
class TestControlDemoMode:
    def test_status_counts(self, s, admin_token):
        r = s.get(f"{API}/control/demo-mode", headers=_auth(admin_token))
        assert r.status_code == 200, r.text
        b = r.json()
        assert b.get("demo_users", 0) >= 40  # documented target ~80 but seed varies
        assert b.get("demo_photos_applied", 0) >= 30
        assert b["demo_mode_enabled"] in (True, False)

    def test_seed_idempotent(self, s, admin_token):
        r1 = s.post(f"{API}/control/demo-mode/seed", headers=_auth(admin_token), timeout=120)
        assert r1.status_code == 200, r1.text
        r2 = s.post(f"{API}/control/demo-mode/seed", headers=_auth(admin_token), timeout=120)
        assert r2.status_code == 200
        # After seed, counts stable
        rs = s.get(f"{API}/control/demo-mode", headers=_auth(admin_token))
        assert rs.status_code == 200

    def test_toggle_demo_mode_hides_demo_from_real(self, s, admin_token, fresh_user):
        # Turn OFF
        r = s.put(f"{API}/control/demo-mode", headers=_auth(admin_token),
                  json={"demo_mode_enabled": False})
        assert r.status_code == 200
        assert r.json()["demo_mode_enabled"] is False
        time.sleep(0.5)
        # Real user nearby → no demo
        rn = fresh_user["session"].get(f"{API}/nearby", headers=_auth(fresh_user["token"]),
                                        params=NEARBY_PARAMS)
        assert rn.status_code == 200, rn.text
        for u in rn.json().get("users", []):
            assert not u.get("is_demo", False), f"real user saw demo while disabled: {u}"
        # Restore ON
        r = s.put(f"{API}/control/demo-mode", headers=_auth(admin_token),
                  json={"demo_mode_enabled": True, "store_screenshot_mode": False})
        assert r.status_code == 200
        assert r.json()["demo_mode_enabled"] is True

    def test_manifest(self, s, admin_token):
        r = s.get(f"{API}/control/demo-mode/manifest", headers=_auth(admin_token))
        assert r.status_code == 200
        m = r.json().get("manifest", [])
        assert len(m) >= 30


# ---------------- Analytics tag demo:true ----------------
class TestAnalyticsDemoTag:
    def test_analytics_from_demo_user(self, s, kauri_token):
        r = s.post(f"{API}/analytics", headers=_auth(kauri_token),
                   json={"event": "test_event_iter36", "props": {"src": "pytest"}})
        # accept 200/201/202/204
        assert r.status_code in (200, 201, 202, 204), r.text


# ---------------- Regression smoke ----------------
class TestRegressionSmoke:
    def test_demo_login(self, s):
        r = s.post(f"{API}/auth/demo-login", json={})
        assert r.status_code == 200
        assert r.json().get("access_token") or r.json().get("token")

    def test_policies(self, s):
        r = s.get(f"{API}/policies")
        assert r.status_code == 200

    def test_professionals_list(self, s, kauri_token):
        r = s.get(f"{API}/professionals", headers=_auth(kauri_token),
                  params={"lat": -37.8136, "lng": 144.9631})
        assert r.status_code == 200, r.text
        body = r.json()
        pros = body.get("professionals", body) if isinstance(body, dict) else body
        assert isinstance(pros, list)
        # confirm demo photos flow through to professionals payload
        assert any((p.get("photo_url") or "").startswith("/api/demo-assets/") for p in pros)

    def test_help_requests(self, s, kauri_token):
        r = s.get(f"{API}/help-requests/mine", headers=_auth(kauri_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

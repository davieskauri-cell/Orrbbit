"""Iteration 30 — Regression tests for 4 defect fixes applied after iter29 backend audit.

Fixes under test:
 1) Register now requires password >= 8 chars (422 on backend)
 2) Photo add endpoint field renamed to photo_url
 3) Banned words list extended (viagra, onlyfans, get rich quick, crypto pump, bitcoin investment)
 4) POST /api/pings/{id}/dismiss returns 404 for non-existent / non-recipient
"""
import os, requests, uuid, pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nearby-connect-93.preview.emergentagent.com").rstrip("/")

def _rand(): return uuid.uuid4().hex[:10]

def _token(email=None):
    body = {"email": email} if email else {}
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", json=body)
    j = r.json()
    return j.get("token") or j.get("access_token")

@pytest.fixture(scope="module")
def demo_token(): return _token()

# --- Fix 1 ---
class TestRegisterMinPassword:
    def test_short_password_rejected(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Short", "email": f"QA_short_{_rand()}@gmail.com", "password": "1234567", "age": 22})
        assert r.status_code == 422, f"{r.status_code}: {r.text}"

    def test_eight_char_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Eight", "email": f"QA_eight_{_rand()}@gmail.com", "password": "12345678",
            "date_of_birth": "1994-05-05", "accept_policies": True})
        assert r.status_code == 200, r.text

# --- Fix 2 ---
class TestPhotoUrlField:
    def test_photo_url_accepted(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/users/me/photos",
                          json={"photo_url": "https://example.com/img.jpg"},
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 200, r.text

# --- Fix 3 ---
class TestBannedWords:
    TERMS = ["viagra deals", "onlyfans link", "get rich quick", "crypto pump signal", "bitcoin investment guaranteed"]

    def test_prof_connect_blocks_terms(self, demo_token):
        r = requests.get(f"{BASE_URL}/api/professionals?lat=-37.8136&lng=144.9631",
                         headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        pros = d if isinstance(d, list) else d.get("professionals", [])
        pros = [p for p in pros if p.get("verified_by_intro")]
        assert pros, "no verified pros to test with"
        target = pros[0]
        target_id = target["user_id"]
        cat = target.get("primary_category") or (target.get("verified_categories") or ["General"])[0]
        for term in self.TERMS:
            r = requests.post(f"{BASE_URL}/api/professional/connect",
                              json={"professional_user_id": target_id, "category": cat, "message": term},
                              headers={"Authorization": f"Bearer {demo_token}"})
            assert r.status_code == 400, f"term '{term}' NOT blocked: {r.status_code} {r.text[:200]}"

    def test_vibe_details_blocks_terms(self, demo_token):
        # Use public_summary key (the one actually checked)
        for term in self.TERMS:
            r = requests.put(f"{BASE_URL}/api/users/me/vibe-details",
                             json={"details": {"public_summary": term}},
                             headers={"Authorization": f"Bearer {demo_token}"})
            assert r.status_code == 400, f"term '{term}' NOT blocked: {r.status_code} {r.text[:200]}"
        # cleanup — clear it
        requests.put(f"{BASE_URL}/api/users/me/vibe-details",
                     json={"details": {}}, headers={"Authorization": f"Bearer {demo_token}"})

# --- Fix 4 ---
class TestDismiss:
    def test_dismiss_nonexistent_404(self, demo_token):
        r = requests.post(f"{BASE_URL}/api/pings/does-not-exist-{_rand()}/dismiss",
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 404, f"{r.status_code}: {r.text}"

    def test_dismiss_not_recipient_404(self, demo_token):
        james = _token("james@intro.demo")
        requests.post(f"{BASE_URL}/api/pings/generate", headers={"Authorization": f"Bearer {james}"})
        r_list = requests.get(f"{BASE_URL}/api/pings", headers={"Authorization": f"Bearer {james}"})
        assert r_list.status_code == 200
        d = r_list.json()
        pings = d if isinstance(d, list) else d.get("pings", [])
        if not pings:
            pytest.skip("no pings available")
        ping_id = pings[0].get("id")
        # demo user (kauri) is NOT the recipient
        r = requests.post(f"{BASE_URL}/api/pings/{ping_id}/dismiss",
                          headers={"Authorization": f"Bearer {demo_token}"})
        assert r.status_code == 404, f"{r.status_code}: {r.text}"

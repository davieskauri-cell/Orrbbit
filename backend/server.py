from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import logging
import uuid
import jwt
from pathlib import Path
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ----------------------------- Models -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int
    bio: Optional[str] = ""
    interests: Optional[List[str]] = []
    photo_url: Optional[str] = None
    city: Optional[str] = "Melbourne"
    country: Optional[str] = "Australia"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DemoLoginIn(BaseModel):
    email: Optional[EmailStr] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None
    photo_url: Optional[str] = None
    photos: Optional[List[str]] = None


class PhotoIn(BaseModel):
    photo: str


class StateUpdate(BaseModel):
    vibe: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    visible: Optional[bool] = None
    radius: Optional[int] = None
    ghost_mode: Optional[bool] = None
    paused: Optional[bool] = None
    quiet_mode: Optional[bool] = None
    only_same_vibe: Optional[bool] = None
    verified_only: Optional[bool] = None
    who_can_see: Optional[str] = None
    visible_for: Optional[int] = None
    trial_mode_active: Optional[bool] = None
    event_active: Optional[bool] = None
    mode: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    intent: Optional[str] = None


class FeedbackIn(BaseModel):
    spoke: str
    experience: str
    comments: Optional[str] = ""


class AnalyticsIn(BaseModel):
    event: str


class MatchIn(BaseModel):
    user_id: str


class MeetupIn(BaseModel):
    user_id: str


class BlockIn(BaseModel):
    user_id: str


class ReportIn(BaseModel):
    user_id: str
    reason: str
    details: Optional[str] = ""


# ----------------------------- Helpers -----------------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


MAX_RADIUS = 100  # Intro never reveals anyone beyond 100 metres


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name"),
        "age": u.get("age"),
        "bio": u.get("bio", ""),
        "photo_url": u.get("photo_url"),
        "photos": u.get("photos", []),
        "interests": u.get("interests", []),
        "vibe": u.get("vibe"),
        "visible": u.get("visible", True),
        "radius": min(u.get("radius", 50) or 50, MAX_RADIUS),
        "ghost_mode": u.get("ghost_mode", False),
        "paused": u.get("paused", False),
        "quiet_mode": u.get("quiet_mode", False),
        "only_same_vibe": u.get("only_same_vibe", False),
        "verified_only": u.get("verified_only", False),
        "who_can_see": u.get("who_can_see", "everyone"),
        "visible_for": u.get("visible_for", 30),
        "visibility_expires_at": u.get("visibility_expires_at"),
        "verified": u.get("verified", False),
        "active_now": u.get("active_now", True),
        "trial_mode_active": u.get("trial_mode_active", False),
        "event_active": u.get("event_active", False),
        "mode": u.get("mode", "Social"),
        "intent": u.get("intent"),
        "city": u.get("city", "Melbourne"),
        "country": u.get("country", "Australia"),
        "ambassador": u.get("ambassador", False),
        "is_demo": u.get("is_demo", False),
    }


async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if cred is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_between(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination_point(lat, lng, distance_m, bearing_deg):
    R = 6371000.0
    d = distance_m / R
    theta = math.radians(bearing_deg)
    p1 = math.radians(lat)
    l1 = math.radians(lng)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(theta))
    l2 = l1 + math.atan2(
        math.sin(theta) * math.sin(d) * math.cos(p1),
        math.cos(d) - math.sin(p1) * math.sin(p2),
    )
    return math.degrees(p2), math.degrees(l2)


# ----------------------------- Vibes & demo data -----------------------------
VIBES = [
    {"key": "open_to_chat", "label": "Open to Chat", "description": "Make new connections", "color": "#20B2AA", "icon": "chatbubble-ellipses", "ping_title": "Someone nearby is open to chat 👋", "action": "Say Hi"},
    {"key": "relationship", "label": "Looking for a Relationship", "description": "Find something real", "color": "#FF2D55", "icon": "heart", "ping_title": "Someone nearby has the same intention ❤️", "action": "I'm Interested"},
    {"key": "coffee_drinks", "label": "Coffee / Drinks", "description": "Grab a coffee or drink", "color": "#FF5A1F", "icon": "cafe", "ping_title": "Someone nearby is up for coffee ☕", "action": "Grab a Coffee"},
    {"key": "networking", "label": "Networking", "description": "Meet professionals", "color": "#20B2AA", "icon": "briefcase", "ping_title": "Someone nearby wants to network 💼", "action": "Let's Connect"},
    {"key": "need_advice", "label": "Need Advice", "description": "Get or offer advice", "color": "#8B5CF6", "icon": "help-circle", "ping_title": "Someone nearby needs advice 💬", "action": "Offer Advice"},
    {"key": "gym_buddy", "label": "Gym Buddy", "description": "Train together", "color": "#22C55E", "icon": "barbell", "ping_title": "Someone nearby wants to train 🏋️", "action": "Let's Train"},
    {"key": "exploring", "label": "Exploring", "description": "Discover nearby", "color": "#F59E0B", "icon": "walk", "ping_title": "Someone nearby wants to explore 🧭", "action": "Explore Together"},
    {"key": "busy", "label": "Busy", "description": "Not available", "color": "#9CA3AF", "icon": "notifications-off", "ping_title": None, "action": None},
]
VIBE_KEYS = {v["key"] for v in VIBES}

COMPAT = {
    "open_to_chat": ["open_to_chat", "coffee_drinks", "exploring", "networking", "need_advice"],
    "relationship": ["relationship"],
    "coffee_drinks": ["open_to_chat", "coffee_drinks", "exploring"],
    "networking": ["networking", "open_to_chat", "need_advice"],
    "need_advice": ["need_advice", "networking", "open_to_chat"],
    "gym_buddy": ["gym_buddy", "open_to_chat"],
    "exploring": ["exploring", "coffee_drinks", "open_to_chat"],
    "busy": [],
}

DEMO_PASSWORD = "Intro123!"
DEMO_ACCOUNTS = [
    {"email": "kauri@intro.demo", "name": "Kauri", "age": 28, "vibe": "networking", "bio": "Building Intro and open to meeting ambitious people nearby.", "interests": ["Business", "Startups", "Fitness", "Golf", "HR"], "photo_url": "https://randomuser.me/api/portraits/men/11.jpg", "dist": 20, "bearing": 10, "minutes_ago": 5, "verified": True},
    {"email": "james@intro.demo", "name": "James", "age": 31, "vibe": "networking", "bio": "Startup founder in fintech. Always open to meeting new people and sharing ideas.", "interests": ["Startups", "Finance", "Tech", "Investing"], "photo_url": "https://randomuser.me/api/portraits/men/32.jpg", "dist": 32, "bearing": 40, "minutes_ago": 120, "verified": True},
    {"email": "sarah@intro.demo", "name": "Sarah", "age": 24, "vibe": "need_advice", "bio": "Feeling a bit stuck in my career. Would love some guidance from someone with experience.", "interests": ["Career", "Mindset", "Life Advice"], "photo_url": "https://randomuser.me/api/portraits/women/44.jpg", "dist": 25, "bearing": 210, "minutes_ago": 3, "verified": False},
    {"email": "olivia@intro.demo", "name": "Olivia", "age": 28, "vibe": "networking", "bio": "Marketing manager who loves meeting ambitious people and sharing ideas over coffee.", "interests": ["Marketing", "Business", "Coffee"], "photo_url": "https://randomuser.me/api/portraits/women/65.jpg", "dist": 41, "bearing": 120, "minutes_ago": 90, "verified": True},
    {"email": "jake@intro.demo", "name": "Jake", "age": 29, "vibe": "coffee_drinks", "bio": "Always up for a coffee and a good conversation.", "interests": ["Coffee", "Music", "Travel"], "photo_url": "https://randomuser.me/api/portraits/men/22.jpg", "dist": 28, "bearing": 300, "minutes_ago": 12, "verified": False},
    {"email": "mia@intro.demo", "name": "Mia", "age": 26, "vibe": "relationship", "bio": "Looking to meet someone genuine in real life, not just through endless swiping.", "interests": ["Fitness", "Travel", "Food"], "photo_url": "https://randomuser.me/api/portraits/women/68.jpg", "dist": 38, "bearing": 160, "minutes_ago": 20, "verified": True},
    {"email": "liam@intro.demo", "name": "Liam", "age": 30, "vibe": "gym_buddy", "bio": "Looking for someone to train with nearby.", "interests": ["Gym", "Running", "Health"], "photo_url": "https://randomuser.me/api/portraits/men/75.jpg", "dist": 45, "bearing": 250, "minutes_ago": 60, "verified": False},
    {"email": "sophie@intro.demo", "name": "Sophie", "age": 29, "vibe": "open_to_chat", "bio": "New to Melbourne and always open to random conversations.", "interests": ["Coffee", "Music", "Walks"], "photo_url": "https://randomuser.me/api/portraits/women/12.jpg", "dist": 36, "bearing": 80, "minutes_ago": 35, "verified": True},
    {"email": "ryan@intro.demo", "name": "Ryan", "age": 35, "vibe": "networking", "bio": "Business owner who enjoys meeting other driven people nearby.", "interests": ["Business", "Leadership", "Investing"], "photo_url": "https://randomuser.me/api/portraits/men/41.jpg", "dist": 78, "bearing": 330, "minutes_ago": 180, "verified": True},
    {"email": "emily@intro.demo", "name": "Emily", "age": 27, "vibe": "coffee_drinks", "bio": "Always happy to meet someone for a quick coffee and good conversation.", "interests": ["Coffee", "Food", "Travel"], "photo_url": "https://randomuser.me/api/portraits/women/33.jpg", "dist": 94, "bearing": 190, "minutes_ago": 240, "verified": False},
]


# ----------------------------- Auth routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Intro API", "tagline": "Real people. Real moments."}


@api_router.post("/auth/register")
async def register(body: RegisterIn):
    if body.age < 18:
        raise HTTPException(status_code=400, detail="You must be 18 or older to use Intro")
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "hashed_password": pwd_context.hash(body.password),
        "name": body.name,
        "age": body.age,
        "bio": body.bio or "",
        "interests": body.interests or [],
        "photo_url": body.photo_url,
        "city": body.city or "Melbourne",
        "country": body.country or "Australia",
        "mode": "Social",
        "vibe": None,
        "lat": None,
        "lng": None,
        "visible": True,
        "radius": 50,
        "ghost_mode": False,
        "paused": False,
        "only_same_vibe": False,
        "verified_only": False,
        "who_can_see": "everyone",
        "visible_for": 60,
        "verified": False,
        "is_demo": False,
        "created_at": now_iso(),
        "last_active": now_iso(),
    }
    await db.users.insert_one(user)
    return {"access_token": create_token(user["id"]), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not pwd_context.verify(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_token(user["id"]), "user": public_user(user)}


@api_router.post("/auth/demo-login")
async def demo_login(body: DemoLoginIn):
    email = (body.email or "kauri@intro.demo").lower()
    user = await db.users.find_one({"email": email, "is_demo": True})
    if not user:
        raise HTTPException(status_code=404, detail="Demo account not found")
    return {"access_token": create_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.get("/demo-accounts")
async def demo_accounts():
    users = await db.users.find({"is_demo": True}).to_list(50)
    order = {a["email"]: i for i, a in enumerate(DEMO_ACCOUNTS)}
    users.sort(key=lambda u: (order.get(u["email"], 99), u.get("city", "")))
    return [
        {"email": u["email"], "name": u.get("name"), "age": u.get("age"), "vibe": u.get("vibe"), "photo_url": u.get("photo_url"), "bio": u.get("bio", ""), "city": u.get("city", "Melbourne"), "mode": u.get("mode", "Social"), "verified": u.get("verified", False), "active_now": u.get("active_now", True)}
        for u in users
    ]


@api_router.get("/vibes")
async def get_vibes():
    return VIBES


# ----------------------------- Profile & state -----------------------------
@api_router.put("/users/me")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if "photos" in fields:
        fields["photo_url"] = fields["photos"][0] if fields["photos"] else None
    if fields:
        await db.users.update_one({"id": user["id"]}, {"$set": fields})
        user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


MAX_PHOTOS = 6


@api_router.post("/users/me/photos")
async def add_photo(body: PhotoIn, user: dict = Depends(get_current_user)):
    photos = list(user.get("photos") or [])
    if len(photos) >= MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_PHOTOS} photos")
    photos.append(body.photo)
    await db.users.update_one({"id": user["id"]}, {"$set": {"photos": photos, "photo_url": photos[0]}})
    user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


@api_router.delete("/users/me/photos/{index}")
async def remove_photo(index: int, user: dict = Depends(get_current_user)):
    photos = list(user.get("photos") or [])
    if index < 0 or index >= len(photos):
        raise HTTPException(status_code=404, detail="Photo not found")
    photos.pop(index)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"photos": photos, "photo_url": photos[0] if photos else None}},
    )
    user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


@api_router.put("/users/me/state")
async def update_state(body: StateUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if "radius" in fields:
        fields["radius"] = max(10, min(int(fields["radius"]), MAX_RADIUS))
    if "vibe" in fields and fields["vibe"] not in VIBE_KEYS:
        raise HTTPException(status_code=400, detail="Unknown vibe")
    # starting/refreshing a visibility session sets its expiry
    if fields.get("visible") is True or "visible_for" in fields:
        duration = fields.get("visible_for", user.get("visible_for", 30))
        fields["visibility_expires_at"] = (
            datetime.now(timezone.utc) + timedelta(minutes=duration)
        ).isoformat()
    fields["last_active"] = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": fields})
    user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


# ----------------------------- Nearby radar -----------------------------
async def get_blocked_ids(user_id: str) -> set:
    blocks = await db.blocks.find({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]}).to_list(500)
    ids = set()
    for b in blocks:
        ids.add(b["blocker_id"])
        ids.add(b["blocked_id"])
    ids.discard(user_id)
    return ids


async def compute_nearby(user: dict, lat: float, lng: float) -> list:
    radius = min(user.get("radius", 50) or 50, MAX_RADIUS)
    my_vibe = user.get("vibe")
    compat = COMPAT.get(my_vibe, []) if my_vibe else []
    blocked = await get_blocked_ids(user["id"])
    results = []
    others = await db.users.find({"id": {"$ne": user["id"]}}).to_list(500)
    for o in others:
        if o["id"] in blocked:
            continue
        # worldwide app, local radar: only people in the same city ever appear
        if o.get("city", "Melbourne") != user.get("city", "Melbourne"):
            continue
        if not o.get("visible", True) or o.get("ghost_mode") or o.get("paused"):
            continue
        if o.get("is_demo") and o.get("demo_dist") is not None:
            dist = o["demo_dist"]
            brg = o.get("demo_bearing", 0)
            plat, plng = destination_point(lat, lng, dist, brg)
        elif o.get("lat") is not None:
            dist = haversine(lat, lng, o["lat"], o["lng"])
            brg = bearing_between(lat, lng, o["lat"], o["lng"])
            plat, plng = o["lat"], o["lng"]
        else:
            continue
        if dist > radius or dist > MAX_RADIUS:
            continue
        o_vibe = o.get("vibe")
        if user.get("only_same_vibe") and o_vibe != my_vibe:
            continue
        if user.get("verified_only") and not o.get("verified"):
            continue
        results.append({
            "id": o["id"],
            "name": o.get("name"),
            "age": o.get("age"),
            "bio": o.get("bio", ""),
            "photo_url": o.get("photo_url"),
            "interests": o.get("interests", []),
            "vibe": o_vibe,
            "distance": round(dist),
            "bearing": round(brg),
            "lat": plat,
            "lng": plng,
            "compatible": bool(my_vibe and my_vibe != "busy" and o_vibe in compat),
            "verified": o.get("verified", False),
            "active_now": o.get("active_now", True),
            "is_demo": o.get("is_demo", False),
        })
    results.sort(key=lambda r: r["distance"])
    return results


@api_router.get("/nearby")
async def nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    user: dict = Depends(get_current_user),
):
    results = await compute_nearby(user, lat, lng)
    return {
        "count": len(results),
        "radius": min(user.get("radius", 50) or 50, MAX_RADIUS),
        "my_vibe": user.get("vibe"),
        "users": results,
    }


# ----------------------------- Pings -----------------------------
def ping_payload(p: dict, u_info: dict) -> dict:
    vibe_def = next((v for v in VIBES if v["key"] == p["vibe"]), None)
    return {
        "id": p["id"],
        "status": p["status"],
        "vibe": p["vibe"],
        "title": (vibe_def or {}).get("ping_title") or "Someone nearby wants to connect 👋",
        "distance": p.get("distance_meters"),
        "created_at": p["created_at"],
        "user": u_info,
    }


@api_router.post("/pings/generate")
async def generate_ping(
    lat: float = Query(...),
    lng: float = Query(...),
    user: dict = Depends(get_current_user),
):
    if not user.get("visible", True) or user.get("ghost_mode") or user.get("paused"):
        return {"ping": None}
    if user.get("quiet_mode"):
        return {"ping": None}
    exp = user.get("visibility_expires_at")
    if exp and exp < now_iso():
        return {"ping": None}
    if not user.get("vibe") or user.get("vibe") == "busy":
        return {"ping": None}
    candidates = [c for c in await compute_nearby(user, lat, lng) if c["compatible"]]
    if not candidates:
        return {"ping": None}
    # avoid re-pinging the same person within 2 minutes
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    recent = await db.pings.find({"to_user_id": user["id"], "created_at": {"$gt": cutoff}}).to_list(100)
    recent_from = {p["from_user_id"] for p in recent}
    candidates = [c for c in candidates if c["id"] not in recent_from]
    if not candidates:
        return {"ping": None}
    pick = candidates[0]
    ping = {
        "id": str(uuid.uuid4()),
        "from_user_id": pick["id"],
        "to_user_id": user["id"],
        "vibe": pick["vibe"],
        "status": "new",
        "distance_meters": pick["distance"],
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
    }
    await db.pings.insert_one(dict(ping))
    return {"ping": ping_payload(ping, pick)}


@api_router.get("/pings")
async def list_pings(user: dict = Depends(get_current_user)):
    pings = await db.pings.find({"to_user_id": user["id"]}).to_list(200)
    pings.sort(key=lambda p: p["created_at"], reverse=True)
    blocked = await get_blocked_ids(user["id"])
    out = []
    for p in pings:
        if p["from_user_id"] in blocked:
            continue
        u = await db.users.find_one({"id": p["from_user_id"]})
        if not u:
            continue
        info = {
            "id": u["id"], "name": u.get("name"), "age": u.get("age"),
            "photo_url": u.get("photo_url"), "vibe": u.get("vibe"), "bio": u.get("bio", ""),
        }
        out.append(ping_payload(p, info))
    return out


@api_router.post("/pings/{ping_id}/dismiss")
async def dismiss_ping(ping_id: str, user: dict = Depends(get_current_user)):
    await db.pings.update_one({"id": ping_id, "to_user_id": user["id"]}, {"$set": {"status": "dismissed"}})
    return {"ok": True}


@api_router.post("/pings/{ping_id}/accept")
async def accept_ping(ping_id: str, user: dict = Depends(get_current_user)):
    ping = await db.pings.find_one({"id": ping_id, "to_user_id": user["id"]})
    if not ping:
        raise HTTPException(status_code=404, detail="Ping not found")
    await db.pings.update_one({"id": ping_id}, {"$set": {"status": "recent"}})
    match = await create_match_docs(user["id"], ping["from_user_id"])
    return {"match": match}


# ----------------------------- Matches -----------------------------
async def create_match_docs(a: str, b: str) -> dict:
    existing = await db.matches.find_one({
        "active": True,
        "$or": [{"user_a": a, "user_b": b}, {"user_a": b, "user_b": a}],
    })
    if existing:
        existing.pop("_id", None)
        return existing
    match = {
        "id": str(uuid.uuid4()), "user_a": a, "user_b": b,
        "accepted_a": True, "accepted_b": True, "active": True, "created_at": now_iso(),
    }
    await db.matches.insert_one(dict(match))
    return match


@api_router.post("/matches")
async def create_match(body: MatchIn, user: dict = Depends(get_current_user)):
    other = await db.users.find_one({"id": body.user_id})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    match = await create_match_docs(user["id"], body.user_id)
    return {
        "match": match,
        "user": {"id": other["id"], "name": other.get("name"), "age": other.get("age"), "photo_url": other.get("photo_url"), "vibe": other.get("vibe")},
    }


# ----------------------------- Meetups -----------------------------
@api_router.post("/meetups")
async def start_meetup(body: MeetupIn, user: dict = Depends(get_current_user)):
    await db.meetups.update_many(
        {"active": True, "$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]},
        {"$set": {"active": False, "ended_at": now_iso()}},
    )
    meetup = {
        "id": str(uuid.uuid4()), "user_a": user["id"], "user_b": body.user_id,
        "active": True, "started_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
    }
    await db.meetups.insert_one(dict(meetup))
    return meetup


@api_router.get("/meetups/active")
async def active_meetup(
    lat: float = Query(...),
    lng: float = Query(...),
    user: dict = Depends(get_current_user),
):
    m = await db.meetups.find_one({"active": True, "$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]})
    if not m:
        return {"meetup": None}
    if m["expires_at"] < now_iso():
        await db.meetups.update_one({"id": m["id"]}, {"$set": {"active": False, "ended_at": now_iso()}})
        return {"meetup": None}
    other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
    o = await db.users.find_one({"id": other_id})
    dist, brg = 30, 45
    if o:
        if o.get("is_demo") and o.get("demo_dist") is not None:
            dist, brg = o["demo_dist"], o.get("demo_bearing", 45)
        elif o.get("lat") is not None:
            dist = round(haversine(lat, lng, o["lat"], o["lng"]))
            brg = round(bearing_between(lat, lng, o["lat"], o["lng"]))
    return {"meetup": {
        "id": m["id"], "started_at": m["started_at"], "expires_at": m["expires_at"],
        "user": {"id": o["id"], "name": o.get("name"), "age": o.get("age"), "photo_url": o.get("photo_url"), "vibe": o.get("vibe")} if o else None,
        "distance": dist, "bearing": brg,
    }}


@api_router.post("/meetups/{meetup_id}/end")
async def end_meetup(meetup_id: str, user: dict = Depends(get_current_user)):
    await db.meetups.update_one(
        {"id": meetup_id, "$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]},
        {"$set": {"active": False, "ended_at": now_iso()}},
    )
    return {"ok": True}


# ----------------------------- Encounters -----------------------------
@api_router.get("/encounters")
async def encounters(user: dict = Depends(get_current_user)):
    my_vibe = user.get("vibe")
    compat = COMPAT.get(my_vibe, []) if my_vibe else []
    blocked = await get_blocked_ids(user["id"])
    demo = await db.users.find({"is_demo": True, "id": {"$ne": user["id"]}}).to_list(50)
    now = datetime.now(timezone.utc)
    out = []
    for o in demo:
        if o["id"] in blocked:
            continue
        d = o.get("demo_dist")
        if d is None or d > MAX_RADIUS:
            continue
        mins = o.get("demo_minutes_ago", 30)
        out.append({
            "id": o["id"], "name": o.get("name"), "age": o.get("age"),
            "photo_url": o.get("photo_url"), "vibe": o.get("vibe"),
            "distance": d, "minutes_ago": mins,
            "seen_at": (now - timedelta(minutes=mins)).isoformat(),
            "compatible": bool(my_vibe and my_vibe != "busy" and o.get("vibe") in compat),
        })
    out.sort(key=lambda e: e["minutes_ago"])
    return out


# ----------------------------- Safety -----------------------------
@api_router.post("/blocks")
async def block_user(body: BlockIn, user: dict = Depends(get_current_user)):
    await db.blocks.update_one(
        {"blocker_id": user["id"], "blocked_id": body.user_id},
        {"$set": {"blocker_id": user["id"], "blocked_id": body.user_id, "created_at": now_iso()}},
        upsert=True,
    )
    # end any active meetup with the blocked user
    await db.meetups.update_many(
        {
            "active": True,
            "$or": [
                {"user_a": user["id"], "user_b": body.user_id},
                {"user_a": body.user_id, "user_b": user["id"]},
            ],
        },
        {"$set": {"active": False, "ended_at": now_iso()}},
    )
    return {"ok": True}


@api_router.post("/reports")
async def report_user(body: ReportIn, user: dict = Depends(get_current_user)):
    await db.reports.insert_one({
        "id": str(uuid.uuid4()), "reporter_id": user["id"], "reported_id": body.user_id,
        "reason": body.reason, "details": body.details or "", "created_at": now_iso(),
    })
    return {"ok": True}


# ----------------------------- Feedback, trial & metrics -----------------------------
TRIAL_EVENT = {
    "name": "Southbank Social Trial",
    "venue": "Melbourne Southbank",
    "start_time": "6:00pm",
    "end_time": "8:00pm",
    "active_users": 64,
    "pings_created": 28,
    "mutual_accepts": 12,
    "conversations_confirmed": 6,
    "invite_link": "intro.app/southbank-trial",
}


@api_router.get("/trial")
async def get_trial(user: dict = Depends(get_current_user)):
    return {"event": TRIAL_EVENT, "active": user.get("trial_mode_active", False)}


@api_router.post("/feedback")
async def submit_feedback(body: FeedbackIn, user: dict = Depends(get_current_user)):
    await db.feedback.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "spoke": body.spoke,
        "experience": body.experience, "comments": body.comments or "", "created_at": now_iso(),
    })
    return {"ok": True}


@api_router.post("/analytics")
async def track_event(body: AnalyticsIn, user: dict = Depends(get_current_user)):
    await db.analytics_events.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "event": body.event, "created_at": now_iso(),
    })
    return {"ok": True}


@api_router.get("/metrics")
async def metrics(user: dict = Depends(get_current_user)):
    signups = await db.users.count_documents({"is_demo": {"$ne": True}})
    active = await db.users.count_documents({"visible": True})
    vibes_selected = await db.users.count_documents({"vibe": {"$ne": None}})
    pings = await db.pings.count_documents({})
    profile_views = await db.analytics_events.count_documents({"event": "profile_view"})
    accepts = await db.matches.count_documents({})
    meetups_started = await db.meetups.count_documents({})
    meetups_completed = await db.meetups.count_documents({"active": False, "ended_at": {"$ne": None}})
    reports = await db.reports.count_documents({})
    blocks = await db.blocks.count_documents({})
    conversations = await db.feedback.count_documents({"spoke": "Yes, we spoke"})
    waitlist = await db.waitlist.count_documents({})
    users = await db.users.find({}).to_list(1000)
    by_city: dict = {}
    for u in users:
        c = u.get("city", "Melbourne")
        by_city[c] = by_city.get(c, 0) + 1
    return {
        "demo_signups": signups,
        "active_users": active,
        "vibes_selected": vibes_selected,
        "pings_sent": pings,
        "profile_views": profile_views,
        "mutual_accepts": accepts,
        "meetups_started": meetups_started,
        "meetups_completed": meetups_completed,
        "reports_submitted": reports,
        "blocks": blocks,
        "conversations_confirmed": conversations,
        "waitlist_signups": waitlist,
        "referral_signups": 0,
        "ambassador_invites": AMBASSADOR_DEMO["invites"],
        "event_joins": DEMO_EVENT["active_users"],
        "signups_by_city": by_city,
    }


# ----------------------------- Global launch system -----------------------------
CITIES = [
    {"name": "Melbourne", "country": "Australia", "status": "Trial Active", "zones": 2, "active_today": 64, "pings": 28, "matches": 12, "conversations": 6},
    {"name": "Sydney", "country": "Australia", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
    {"name": "Auckland", "country": "New Zealand", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
    {"name": "London", "country": "United Kingdom", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
    {"name": "New York", "country": "United States", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
    {"name": "Toronto", "country": "Canada", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
    {"name": "Singapore", "country": "Singapore", "status": "Coming Soon", "zones": 0, "active_today": 0, "pings": 0, "matches": 0, "conversations": 0},
]

ZONES = [
    {"name": "Melbourne CBD", "active_users": 26, "scheduled_trials": 2, "top_vibe": "networking"},
    {"name": "Southbank", "active_users": 18, "scheduled_trials": 1, "top_vibe": "coffee_drinks"},
    {"name": "Docklands", "active_users": 7, "scheduled_trials": 0, "top_vibe": "open_to_chat"},
    {"name": "Fitzroy", "active_users": 9, "scheduled_trials": 1, "top_vibe": "open_to_chat"},
    {"name": "St Kilda", "active_users": 5, "scheduled_trials": 0, "top_vibe": "exploring"},
    {"name": "Carlton", "active_users": 11, "scheduled_trials": 1, "top_vibe": "need_advice"},
    {"name": "Werribee", "active_users": 3, "scheduled_trials": 0, "top_vibe": "gym_buddy"},
]

DEMO_EVENT = {
    "name": "Melbourne Founder Mixer", "location": "Melbourne CBD", "start_time": "6:00pm", "end_time": "8:00pm",
    "types": ["Networking event", "University event", "Coworking mixer", "Fitness event", "Singles event", "Social club", "Creative event", "Business event", "Music/event venue"],
    "active_users": 82, "pings": 36, "profile_views": 18, "mutual_accepts": 11, "conversations_confirmed": 7,
}

DEMO_CAMPUS = {
    "name": "University of Melbourne Trial", "active_users": 124,
    "vibes": [{"key": "open_to_chat", "count": 42}, {"key": "coffee_drinks", "count": 21}, {"key": "study_buddy", "count": 18}, {"key": "need_advice", "count": 13}, {"key": "networking", "count": 9}],
}

COMMUNITIES = [
    {"name": c, "nearby": n, "events": e}
    for c, n, e in [("Fitness", 14, 2), ("Golf", 5, 1), ("Running", 9, 1), ("Business", 17, 3), ("Startups", 12, 2), ("Music", 8, 1), ("Food", 11, 1), ("Travel", 6, 0), ("Study", 10, 1), ("Creative", 7, 1), ("Tech", 15, 2), ("Wellness", 6, 0)]
]

MODES = ["Social", "Networking", "Campus", "Events", "Communities", "Dating", "Fitness"]

AMBASSADOR_DEMO = {
    "name": "Kauri", "city": "Melbourne", "invites": 42, "signups": 28,
    "active_users": 19, "mutual_accepts": 8, "conversations_confirmed": 4, "events_hosted": 2,
    "tasks": ["Invite 20 people", "Host a 100m social experiment", "Share a QR code", "Collect feedback", "Confirm real conversations"],
}

GLOBAL_DEMO_USERS = [
    ("amelia@intro.demo", "Amelia", 27, "open_to_chat", "London", 32, 40),
    ("oliver@intro.demo", "Oliver", 30, "networking", "London", 45, 130),
    ("priya@intro.demo", "Priya", 25, "coffee_drinks", "London", 58, 250),
    ("ethan@intro.demo", "Ethan", 29, "networking", "New York", 34, 60),
    ("ava@intro.demo", "Ava", 26, "relationship", "New York", 49, 170),
    ("marcus@intro.demo", "Marcus", 31, "open_to_chat", "New York", 73, 300),
    ("noah@intro.demo", "Noah", 28, "need_advice", "Toronto", 26, 80),
    ("chloe@intro.demo", "Chloe", 24, "coffee_drinks", "Toronto", 39, 210),
    ("maia@intro.demo", "Maia", 27, "open_to_chat", "Auckland", 31, 20),
    ("josh@intro.demo", "Josh", 30, "gym_buddy", "Auckland", 44, 190),
    ("lina@intro.demo", "Lina", 28, "networking", "Singapore", 35, 100),
    ("daniel@intro.demo", "Daniel", 33, "coffee_drinks", "Singapore", 52, 280),
]
GLOBAL_PHOTOS = ["women/50", "men/52", "women/71", "men/61", "women/24", "men/83", "men/36", "women/90", "women/29", "men/28", "women/61", "men/70"]


class WaitlistIn(BaseModel):
    name: str
    email: str
    city: str
    country: Optional[str] = ""
    interest: Optional[str] = ""
    ambassador: Optional[bool] = False


@api_router.get("/cities")
async def get_cities():
    return {"cities": CITIES, "zones": ZONES}


@api_router.get("/events/demo")
async def get_demo_event(user: dict = Depends(get_current_user)):
    return {"event": DEMO_EVENT, "active": user.get("event_active", False)}


@api_router.get("/campus")
async def get_campus():
    return DEMO_CAMPUS


@api_router.get("/communities")
async def get_communities():
    return COMMUNITIES


@api_router.get("/modes")
async def get_modes():
    return MODES


@api_router.get("/ambassador")
async def get_ambassador():
    return AMBASSADOR_DEMO


@api_router.post("/waitlist")
async def join_waitlist(body: WaitlistIn):
    await db.waitlist.insert_one({"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()})
    return {"ok": True}


@api_router.get("/trial-report")
async def trial_report(user: dict = Depends(get_current_user)):
    feedback = await db.feedback.find({}).to_list(500)
    reports = await db.reports.count_documents({})
    blocks = await db.blocks.count_documents({})
    meetups = await db.meetups.count_documents({})
    conversations = len([f for f in feedback if f.get("spoke") == "Yes, we spoke"])
    exp = [f.get("experience") for f in feedback if f.get("experience")]
    return {
        "event": DEMO_EVENT["name"], "city": "Melbourne", "date": now_iso()[:10],
        "active_users": DEMO_EVENT["active_users"], "pings_sent": DEMO_EVENT["pings"],
        "profile_views": DEMO_EVENT["profile_views"], "mutual_accepts": DEMO_EVENT["mutual_accepts"],
        "meetups_started": meetups, "conversations_confirmed": conversations,
        "feedback_summary": {e: exp.count(e) for e in set(exp)} or {"Great": 4, "Good": 2, "Okay": 1},
        "safety_reports": reports, "blocks": blocks,
        "key_learnings": ["Density drives conversations", "Networking vibe converts best", "Icebreakers reduce hesitation"],
    }


@api_router.get("/north-star")
async def north_star(user: dict = Depends(get_current_user)):
    feedback = await db.feedback.find({"spoke": "Yes, we spoke"}).to_list(1000)
    now = datetime.now(timezone.utc)
    today = len([f for f in feedback if f["created_at"][:10] == now_iso()[:10]])
    week_cut = (now - timedelta(days=7)).isoformat()
    week = len([f for f in feedback if f["created_at"] > week_cut])
    return {"today": today, "this_week": week, "this_city": len(feedback), "this_event": min(len(feedback), DEMO_EVENT["conversations_confirmed"]), "total": len(feedback)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_demo_accounts():
    for acc in DEMO_ACCOUNTS:
        doc = {
            "email": acc["email"], "name": acc["name"], "age": acc["age"], "vibe": acc["vibe"],
            "bio": acc["bio"], "interests": acc["interests"], "photo_url": acc["photo_url"],
            "photos": [
                acc["photo_url"],
                f"https://picsum.photos/seed/{acc['email']}-a/400/400",
                f"https://picsum.photos/seed/{acc['email']}-b/400/400",
            ],
            "demo_dist": acc["dist"], "demo_bearing": acc["bearing"], "demo_minutes_ago": acc["minutes_ago"],
            "visible": True, "radius": 50, "ghost_mode": False, "paused": False, "quiet_mode": False,
            "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
            "visible_for": 30, "verified": acc["verified"], "active_now": True, "is_demo": True,
            "trial_mode_active": False,
            "lat": None, "lng": None, "last_active": now_iso(),
        }
        existing = await db.users.find_one({"email": acc["email"]})
        if existing:
            await db.users.update_one({"email": acc["email"]}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["hashed_password"] = pwd_context.hash(DEMO_PASSWORD)
            doc["created_at"] = now_iso()
            await db.users.insert_one(doc)
    logger.info("Seeded %d demo accounts", len(DEMO_ACCOUNTS))
    # global demo users (same rules: <=100m within their own city)
    for i, (email, name, age, vibe, city, dist, brg) in enumerate(GLOBAL_DEMO_USERS):
        doc = {
            "email": email, "name": name, "age": age, "vibe": vibe, "city": city,
            "bio": f"{name} is exploring Intro in {city}.", "interests": ["Coffee", "Travel"],
            "photo_url": f"https://randomuser.me/api/portraits/{GLOBAL_PHOTOS[i]}.jpg",
            "photos": [
                f"https://randomuser.me/api/portraits/{GLOBAL_PHOTOS[i]}.jpg",
                f"https://picsum.photos/seed/{email}-a/400/400",
                f"https://picsum.photos/seed/{email}-b/400/400",
            ],
            "demo_dist": dist, "demo_bearing": brg, "demo_minutes_ago": 15 + i * 10,
            "visible": True, "radius": 50, "ghost_mode": False, "paused": False, "quiet_mode": False,
            "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
            "visible_for": 30, "verified": i % 2 == 0, "active_now": True, "is_demo": True,
            "trial_mode_active": False, "lat": None, "lng": None, "last_active": now_iso(),
        }
        existing = await db.users.find_one({"email": email})
        if existing:
            await db.users.update_one({"email": email}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["hashed_password"] = pwd_context.hash(DEMO_PASSWORD)
            doc["created_at"] = now_iso()
            await db.users.insert_one(doc)
    # mark Kauri as Melbourne ambassador
    await db.users.update_one({"email": "kauri@intro.demo"}, {"$set": {"ambassador": True}})
    logger.info("Seeded %d global demo users", len(GLOBAL_DEMO_USERS))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

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
    display_name: str
    bio: Optional[str] = ""
    avatar_url: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class StateUpdate(BaseModel):
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    visible: Optional[bool] = None
    radius: Optional[int] = None


class StatusOptionIn(BaseModel):
    label: str
    description: str
    color: str
    icon: str


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


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "display_name": u.get("display_name"),
        "bio": u.get("bio", ""),
        "avatar_url": u.get("avatar_url"),
        "status": u.get("status"),
        "visible": u.get("visible", True),
        "radius": u.get("radius", 150),
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


# complementary status matching graph
MATCH_GRAPH = {
    "open_to_chat": ["open_to_chat", "looking_for_relationship", "struggling"],
    "looking_for_relationship": ["looking_for_relationship", "open_to_chat"],
    "struggling": ["struggling", "open_to_chat"],
    "busy": [],
}

DEFAULT_STATUSES = [
    {"key": "open_to_chat", "label": "Open to Chat", "description": "Up for a friendly conversation with anyone nearby.", "color": "#10B981", "icon": "chatbubble-ellipses", "is_default": True},
    {"key": "looking_for_relationship", "label": "Looking for a Relationship", "description": "Hoping to meet someone special right now.", "color": "#E11D48", "icon": "heart", "is_default": True},
    {"key": "struggling", "label": "Struggling / Need Advice", "description": "Could use a listening ear or some guidance.", "color": "#0D9488", "icon": "help-buoy", "is_default": True},
    {"key": "busy", "label": "Busy", "description": "Around but not available to connect right now.", "color": "#8A9992", "icon": "moon", "is_default": True},
]

AVATARS = [
    "https://images.unsplash.com/photo-1782116673361-ee0d595c9fde?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwzfHxwb3J0cmFpdCUyMGNhc3VhbCUyMHlvdW5nJTIwYWR1bHR8ZW58MHx8fHwxNzgyOTkxMTIxfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1779997744346-a04b046a7e3f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxwb3J0cmFpdCUyMGNhc3VhbCUyMHlvdW5nJTIwYWR1bHR8ZW58MHx8fHwxNzgyOTkxMTIxfDA&ixlib=rb-4.1.0&q=85",
    "https://images.unsplash.com/photo-1567934859879-9addfb1e07f8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMGNhc3VhbCUyMHlvdW5nJTIwYWR1bHR8ZW58MHx8fHwxNzgyOTkxMTIxfDA&ixlib=rb-4.1.0&q=85",
]

# fixed relative offsets so mock users always appear around the requester
MOCK_USERS = [
    {"id": "mock-1", "display_name": "Aria", "status": "looking_for_relationship", "dist": 42, "bearing": 25, "bio": "New in town, love live music.", "avatar_url": AVATARS[0]},
    {"id": "mock-2", "display_name": "Leo", "status": "open_to_chat", "dist": 68, "bearing": 110, "bio": "Grabbing coffee, say hi!", "avatar_url": AVATARS[2]},
    {"id": "mock-3", "display_name": "Maya", "status": "struggling", "dist": 95, "bearing": 200, "bio": "Rough week, could use a chat.", "avatar_url": AVATARS[1]},
    {"id": "mock-4", "display_name": "Sam", "status": "busy", "dist": 55, "bearing": 300, "bio": "Heads down, working.", "avatar_url": AVATARS[2]},
    {"id": "mock-5", "display_name": "Noa", "status": "open_to_chat", "dist": 130, "bearing": 60, "bio": "Exploring the city solo.", "avatar_url": AVATARS[0]},
    {"id": "mock-6", "display_name": "Kai", "status": "looking_for_relationship", "dist": 160, "bearing": 245, "bio": "Foodie searching for a partner in crime.", "avatar_url": AVATARS[2]},
    {"id": "mock-7", "display_name": "Ivy", "status": "struggling", "dist": 180, "bearing": 155, "bio": "Feeling a bit lost lately.", "avatar_url": AVATARS[1]},
]


# ----------------------------- Auth routes -----------------------------
@api_router.get("/")
async def root():
    return {"message": "Intro API"}


@api_router.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "hashed_password": pwd_context.hash(body.password),
        "display_name": body.display_name,
        "bio": body.bio or "",
        "avatar_url": body.avatar_url or AVATARS[0],
        "status": None,
        "lat": None,
        "lng": None,
        "visible": True,
        "radius": 150,
        "created_at": now_iso(),
        "last_active": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    return {"access_token": token, "user": public_user(user)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not pwd_context.verify(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"])
    return {"access_token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.put("/users/me")
async def update_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if fields:
        await db.users.update_one({"id": user["id"]}, {"$set": fields})
        user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


@api_router.put("/users/me/state")
async def update_state(body: StateUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.dict().items() if v is not None}
    fields["last_active"] = now_iso()
    await db.users.update_one({"id": user["id"]}, {"$set": fields})
    user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


# ----------------------------- Statuses -----------------------------
@api_router.get("/statuses")
async def get_statuses():
    items = await db.statuses.find().to_list(200)
    return [{"key": i["key"], "label": i["label"], "description": i["description"], "color": i["color"], "icon": i["icon"], "is_default": i.get("is_default", False)} for i in items]


@api_router.post("/statuses")
async def add_status(body: StatusOptionIn, user: dict = Depends(get_current_user)):
    key = body.label.lower().strip().replace(" ", "_").replace("/", "")[:40] + "_" + str(uuid.uuid4())[:6]
    doc = {"key": key, "label": body.label, "description": body.description, "color": body.color, "icon": body.icon, "is_default": False}
    await db.statuses.insert_one(doc)
    return {"key": key, "label": body.label, "description": body.description, "color": body.color, "icon": body.icon, "is_default": False}


# ----------------------------- Nearby radar -----------------------------
@api_router.get("/nearby")
async def nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: int = Query(150),
    user: dict = Depends(get_current_user),
):
    my_status = user.get("status")
    complements = MATCH_GRAPH.get(my_status, []) if my_status else []
    results = []

    # mock users positioned relative to requester
    for m in MOCK_USERS:
        plat, plng = destination_point(lat, lng, m["dist"], m["bearing"])
        dist = m["dist"]
        if dist <= radius:
            results.append({
                "id": m["id"],
                "display_name": m["display_name"],
                "avatar_url": m["avatar_url"],
                "status": m["status"],
                "bio": m["bio"],
                "lat": plat,
                "lng": plng,
                "distance": round(dist),
                "bearing": round(m["bearing"]),
                "is_mock": True,
                "is_match": m["status"] in complements,
            })

    # real visible users nearby
    cursor = db.users.find({
        "visible": True,
        "lat": {"$ne": None},
        "id": {"$ne": user["id"]},
    })
    others = await cursor.to_list(500)
    for other in others:
        dist = haversine(lat, lng, other["lat"], other["lng"])
        if dist <= radius:
            brg = bearing_between(lat, lng, other["lat"], other["lng"])
            results.append({
                "id": other["id"],
                "display_name": other.get("display_name"),
                "avatar_url": other.get("avatar_url"),
                "status": other.get("status"),
                "bio": other.get("bio", ""),
                "lat": other["lat"],
                "lng": other["lng"],
                "distance": round(dist),
                "bearing": round(brg),
                "is_mock": False,
                "is_match": other.get("status") in complements,
            })

    results.sort(key=lambda r: r["distance"])
    return {"count": len(results), "my_status": my_status, "users": results}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_statuses():
    for s in DEFAULT_STATUSES:
        await db.statuses.update_one({"key": s["key"]}, {"$set": s}, upsert=True)
    logger.info("Seeded default statuses")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

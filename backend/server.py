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
from typing import List, Optional, Dict, Any
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


class VibeDetailsIn(BaseModel):
    details: Dict[str, Any]


class SaveProfileIn(BaseModel):
    user_id: str
    distance: Optional[int] = None


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
    show_recruiters: Optional[bool] = None
    mutual_only: Optional[bool] = None
    plan: Optional[str] = None
    high_density_demo: Optional[bool] = None


class FeedbackIn(BaseModel):
    spoke: str
    experience: str
    comments: Optional[str] = ""


class AnalyticsIn(BaseModel):
    event: str


class MatchIn(BaseModel):
    user_id: str
    help_request_id: Optional[str] = None


class MeetupIn(BaseModel):
    user_id: str
    meetup_point: Optional[str] = None


class BlockIn(BaseModel):
    user_id: str


class ReportIn(BaseModel):
    user_id: str
    reason: str
    details: Optional[str] = ""


class CancelMeetupIn(BaseModel):
    reason: str


class DismissFeedbackIn(BaseModel):
    user_id: str
    reason: str


class EventCodeIn(BaseModel):
    code: str


class AdminActionIn(BaseModel):
    action: str  # hide | warn | ban | dismiss | review


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


MAX_RADIUS = 100  # base hard cap; Pro extends discovery up to 500m (still approximate only)

PLAN_LIMITS = {
    "free": {"max_radius": 50, "radius_options": [10, 25, 50]},
    "plus": {"max_radius": 100, "radius_options": [10, 25, 50, 100]},
    "pro": {"max_radius": 500, "radius_options": [10, 25, 50, 100, 250, 500]},
}
MAX_DISCOVERY = 100  # never more than 100 discovery profiles
PLAN_DEFAULT_RADIUS = {"free": 50, "plus": 100, "pro": 250}


def plan_max_radius(u: dict) -> int:
    return PLAN_LIMITS.get(u.get("plan", "free"), PLAN_LIMITS["free"])["max_radius"]


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
        "radius": min(u.get("radius", 50) or 50, plan_max_radius(u)),
        "plan": u.get("plan", "free"),
        "max_radius": plan_max_radius(u),
        "radius_options": PLAN_LIMITS.get(u.get("plan", "free"), PLAN_LIMITS["free"])["radius_options"],
        "high_density_demo": u.get("high_density_demo", False),
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
        "vibe_details": u.get("vibe_details", {}),
        "show_recruiters": u.get("show_recruiters", True),
        "mutual_only": u.get("mutual_only", False),
        "event_code": u.get("event_code"),
        "event_name": u.get("event_name"),
        "admin_status": u.get("admin_status"),
        "city": u.get("city", "Melbourne"),
        "country": u.get("country", "Australia"),
        "ambassador": u.get("ambassador", False),
        "is_demo": u.get("is_demo", False),
        "app_mode": u.get("app_mode", "people"),
        "professional_role": u.get("professional_role"),
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
    {"key": "opportunity", "label": "Opportunity", "description": "Legacy — moved to Professional Mode", "color": "#F59E0B", "icon": "sparkles", "ping_title": "Opportunity nearby ✨", "action": "Connect to Discuss", "hidden": True},
    {"key": "busy", "label": "Busy", "description": "Not available", "color": "#9CA3AF", "icon": "notifications-off", "ping_title": None, "action": None},
]
VIBE_KEYS = {v["key"] for v in VIBES}

COMPAT = {
    "open_to_chat": ["open_to_chat", "coffee_drinks", "exploring", "networking", "need_advice", "opportunity"],
    "relationship": ["relationship"],
    "coffee_drinks": ["open_to_chat", "coffee_drinks", "exploring"],
    "networking": ["networking", "open_to_chat", "need_advice", "opportunity"],
    "need_advice": ["need_advice", "networking", "open_to_chat", "opportunity"],
    "gym_buddy": ["gym_buddy", "open_to_chat"],
    "exploring": ["exploring", "coffee_drinks", "open_to_chat"],
    "opportunity": ["opportunity", "networking", "need_advice", "open_to_chat"],
    "busy": [],
}

DEMO_PASSWORD = "Intro123!"

# Focus Map demo people — with the 9 core demo accounts this yields
# 61 nearby, 47 aligned and 12 strong matches (score >= 6) for a
# Networking Pro user at 500m in Melbourne.
def _build_radar_demo():
    users = []  # (name, age, vibe, dist_m, bearing_deg, portrait, bio)
    details = {}
    # 10 strong matches (high relevance -> individual markers with glow)
    strong = [
        ("Maya", 27, "need_advice", 40, 300, "women/68", "Marketing manager figuring out my next step."),
        ("Tom", 30, "networking", 90, 350, "men/52", "Product manager who loves meeting builders."),
        ("Grace", 28, "networking", 130, 45, "women/21", "Consultant who loves a good chat."),
        ("Oscar", 31, "networking", 160, 140, "men/23", "Agency founder, always up for ideas."),
        ("Ava", 25, "open_to_chat", 185, 240, "women/12", "New to Melbourne, always up for a chat."),
        ("Finn", 30, "need_advice", 215, 320, "men/77", "Thinking about a career pivot."),
        ("Aria", 27, "networking", 245, 70, "women/39", "Designer meeting other creatives."),
        ("Lucas", 35, "networking", 280, 180, "men/44", "Sales director open to a quick intro."),
        ("Ruby", 24, "open_to_chat", 320, 20, "women/47", "Say hi if you see me around!"),
        ("Theo", 33, "networking", 355, 260, "men/67", "Founder happy to swap stories."),
    ]
    users.extend(strong)
    for name, *_rest in strong[1:]:
        details[f"{name.lower()}@radar.intro.demo"] = {
            "intent_strength": "Actively looking now", "visibility": "public",
        }
    details["maya@radar.intro.demo"] = {
        "intent": "Need marketing advice", "advice_role": "Seeking Advice",
        "advice_category": "Marketing advice", "context": "Marketing Manager",
        "background": "Marketing manager at a retail brand",
        "looking_for": ["Career direction", "Marketing"],
        "tags": ["Marketing", "Startups", "Business"], "visibility": "public",
        "availability": "Available now", "intent_strength": "Actively looking now",
    }
    # heat pocket: +12 Chat (sector 90-135, outer band)
    chat = [("Poppy", "women/23"), ("Arlo", "men/12"), ("Daisy", "women/30"), ("Felix", "men/57"),
            ("Hazel", "women/44"), ("Jasper", "men/2"), ("Luna", "women/79"), ("Milo", "men/31"),
            ("Nora", "women/50"), ("Reuben", "men/86"), ("Sadie", "women/15"), ("Toby", "men/64")]
    for i, (n, p) in enumerate(chat):
        users.append((n, 22 + i % 12, "open_to_chat", 340 + i * 10, 96 + i * 3, p, "Around the city today — say hi."))
    # heat pocket: +8 Coffee (sector 180-225, outer band)
    coffee = [("Willow", "women/3"), ("Ezra", "men/19"), ("Iris", "women/62"), ("Hugo", "men/47"),
              ("Pearl", "women/71"), ("Angus", "men/74"), ("Bonnie", "women/36"), ("Callum", "men/38")]
    for i, (n, p) in enumerate(coffee):
        users.append((n, 23 + i % 10, "coffee_drinks", 350 + i * 13, 192 + i * 4, p, "Keen for a coffee catch-up."))
    # heat pocket: +6 Advice (sector 270-315, middle band)
    advice = [("Elsie", "women/56"), ("Rory", "men/25"), ("Freya", "women/82"),
              ("Lachlan", "men/91"), ("Matilda", "women/28"), ("Patrick", "men/6")]
    for i, (n, p) in enumerate(advice):
        users.append((n, 24 + i % 9, "need_advice", 210 + i * 17, 282 + i * 3, p, "Could use a second opinion on a few things."))
    # legacy opportunity pocket — now seeded as Professional Mode demo data (see seed_professional_demo)
    users.append(("Priya", 34, "networking", 80, 220, "women/33", "Small business owner in the CBD."))
    details["priya@radar.intro.demo"] = {
        "opportunity_type": "Need help", "category": "Business",
        "public_summary": "Need help with a staff issue",
        "private_details": "I run a small business and need practical HR help with a staff matter. Happy to discuss and pay for the right support.",
        "payment": "Open to paying", "intent": "Need help with a staff issue",
        "tags": ["Business", "HR"], "visibility": "public",
        "availability": "Available now", "intent_strength": "Actively looking now",
    }
    opportunity = [
        ("Dev", 29, "men/36", "Can help", "Tech", "Can help with websites and app bugs", "Free advice", 150, 212),
        ("Sana", 31, "women/85", "Paid task", "Home", "Paid task: help moving a couch this arvo", "Paid task", 260, 228),
        ("Jade", 26, "women/90", "Collaboration", "Fitness", "Looking for a run-club co-organiser", "Skill swap", 290, 221),
        ("Marco", 38, "men/85", "Selling something", "Car", "Selling roof racks, near new", "Not sure", 320, 215),
    ]
    for oname, oage, op, otype, ocat, osummary, opay, od, ob in opportunity:
        users.append((oname, oage, "open_to_chat", od, ob, op, "Melbourne local."))
        details[f"{oname.lower()}@radar.intro.demo"] = {
            "opportunity_type": otype, "category": ocat, "public_summary": osummary,
            "private_details": "Happy to share the full details once we connect.", "payment": opay,
            "intent": osummary, "visibility": "public",
        }
    # scattered crowd (mostly aligned, low relevance -> clustered organically)
    scatter = [
        ("Harvey", "men/33", "networking", 70, 15), ("Bella", "women/9", "open_to_chat", 110, 205),
        ("Archie", "men/48", "need_advice", 150, 95), ("Georgia", "women/41", "networking", 190, 165),
        ("Louis", "men/59", "open_to_chat", 230, 340), ("Evie", "women/66", "networking", 265, 120),
        ("Albie", "men/70", "need_advice", 300, 30), ("Millie", "women/18", "open_to_chat", 335, 225),
        ("Freddie", "men/81", "networking", 370, 305), ("Lottie", "women/88", "open_to_chat", 405, 55),
        ("Ollie", "men/16", "networking", 440, 150), ("Phoebe", "women/76", "need_advice", 465, 275),
        ("Barney", "men/28", "open_to_chat", 480, 10), ("Clara", "women/59", "networking", 490, 190),
        ("Ned", "men/93", "gym_buddy", 300, 155), ("Rosa", "women/95", "relationship", 430, 335),
    ]
    for i, (n, p, v, d, b) in enumerate(scatter):
        users.append((n, 22 + i % 15, v, d, b, p, "Out and about in Melbourne."))
    return users, details


RADAR_DEMO_USERS, RADAR_DEMO_DETAILS = _build_radar_demo()

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

DEMO_VIBE_DETAILS = {
    "kauri@intro.demo": {
        "intent": "Offering Career Advice", "advice_role": "Offering Advice",
        "context": "HR professional and founder building Intro.",
        "background": "HR professional and founder building Intro", "industry": "HR",
        "experience_level": "3-5 years", "professional_identity": "Founder",
        "looking_for": ["Business contacts", "App feedback", "Early testers"],
        "can_help_with": ["HR", "Career direction", "Interviews", "Confidence", "Marketing"],
        "offer_categories": ["Career", "HR", "Confidence", "Marketing"], "offer_experience": "Professional experience",
        "tags": ["HR", "Startups", "Business", "Golf"], "visibility": "public",
        "availability": "Available for 30 minutes", "intent_strength": "Actively looking now",
    },
    "james@intro.demo": {
        "intent": "Founder / Networking", "professional_identity": "Founder", "industry": "Fintech",
        "experience_level": "5-10 years", "context": "Fintech founder open to meeting operators and marketers.",
        "background": "Startup founder in fintech",
        "looking_for": ["Tech contacts", "Investors", "Marketing advice"],
        "can_help_with": ["Finance", "Startups", "Product strategy"],
        "tags": ["Startups", "Finance", "Tech"], "visibility": "public",
        "availability": "Available now", "intent_strength": "Open if the vibe is right",
    },
    "sarah@intro.demo": {
        "intent": "Need Career Advice", "advice_role": "Need Advice", "advice_category": "Career advice",
        "context": "Been in HR for 3 years and not feeling it anymore.",
        "looking_for": ["Someone in HR", "Someone who changed careers"],
        "urgency": "Would like advice today", "comfort_level": "Coffee chat",
        "tags": ["HR", "Career", "Burnout", "Next Steps"], "visibility": "public",
        "availability": "Available now", "intent_strength": "Actively looking now",
    },
    "olivia@intro.demo": {
        "intent": "Recruiter / Hiring", "professional_identity": "Recruiter", "recruiter_mode": True,
        "industry": "Tech", "company": "TalentLab Melbourne",
        "hiring_roles": ["Frontend Developer", "Product Designer"],
        "hiring_experience": "3-5 years", "work_type": "Full-time", "location_type": "Hybrid",
        "context": "Hiring for tech roles in Melbourne.",
        "looking_for": ["Tech talent open to a quick chat"],
        "tags": ["Tech", "Hiring", "Recruitment"], "visibility": "public",
        "availability": "Available for 60 minutes", "intent_strength": "Actively looking now",
    },
    "jake@intro.demo": {
        "intent": "Coffee", "context": "Up for a quick coffee and a relaxed conversation.",
        "looking_for": ["Friendly conversation", "A relaxed conversation"],
        "setting": "Cafe", "time": "Now",
        "tags": ["Coffee", "Music", "Travel"], "visibility": "public",
        "availability": "Available for 15 minutes", "intent_strength": "Open if the vibe is right",
    },
    "mia@intro.demo": {
        "intent": "Long-term relationship", "relationship_intention": "Long-term relationship",
        "context": "Looking to meet someone genuine in real life.",
        "looking_for": ["Good conversation", "Someone emotionally mature", "Shared values"],
        "values": ["Communication", "Humour", "Fitness", "Travel"],
        "tags": ["Fitness", "Travel", "Food"], "visibility": "public",
    },
    "liam@intro.demo": {
        "intent": "Weights partner", "training_type": ["Weights"], "experience_level": "Intermediate",
        "context": "Looking for a weights partner after work.",
        "looking_for": ["Training partner", "Accountability"], "preferred_time": ["Evening"],
        "tags": ["Gym", "Strength", "Health"], "visibility": "public",
    },
    "sophie@intro.demo": {
        "intent": "New to the area", "context": "New to Melbourne and open to random conversations.",
        "looking_for": ["Friendly people", "Coffee", "Walks"],
        "can_offer": ["Local tips", "Friendly energy"],
        "tags": ["Coffee", "Music", "Walks"], "visibility": "public",
    },
    "ryan@intro.demo": {
        "intent": "Business owner / Networking", "professional_identity": "Business owner",
        "industry": "Business", "experience_level": "10+ years",
        "context": "Business owner who enjoys meeting other driven people.",
        "looking_for": ["Operators", "Leaders", "Investors"],
        "can_help_with": ["Leadership", "Business strategy", "Growth"],
        "tags": ["Business", "Leadership", "Investing"], "visibility": "public",
    },
    "emily@intro.demo": {
        "intent": "Coffee", "context": "Happy to meet someone for coffee and good conversation.",
        "looking_for": ["Coffee nearby", "Friendly chat"], "setting": "Cafe", "time": "Later today",
        "tags": ["Coffee", "Food", "Travel"], "visibility": "public",
    },
}


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


@api_router.delete("/users/me")
async def delete_account(user: dict = Depends(get_current_user)):
    """Permanently delete the account and personal data (App Store / Play Store requirement)."""
    if user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Demo accounts cannot be deleted")
    uid = user["id"]
    await db.users.delete_one({"id": uid})
    await db.pings.delete_many({"$or": [{"from_user_id": uid}, {"to_user_id": uid}]})
    await db.matches.delete_many({"$or": [{"user_a": uid}, {"user_b": uid}]})
    await db.meetups.delete_many({"$or": [{"user_a": uid}, {"user_b": uid}]})
    await db.saved.delete_many({"$or": [{"owner_id": uid}, {"user_id": uid}]})
    await db.blocks.delete_many({"$or": [{"blocker_id": uid}, {"blocked_id": uid}]})
    await db.hides.delete_many({"$or": [{"hider_id": uid}, {"hidden_id": uid}]})
    # Reports are retained (anonymously) as safety/moderation records.
    return {"ok": True, "message": "Your account and personal data have been deleted"}


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
    return [v for v in VIBES if not v.get("hidden")]


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


BANNED_OPPORTUNITY_TERMS = [
    "weapon", "gun", "firearm", "ammunition", "drugs", "cocaine", "heroin", "meth", "mdma",
    "escort", "adult service", "sexual service", "gambling", "casino", "betting ring",
    "investment scheme", "guaranteed returns", "pyramid scheme", "cure for", "miracle cure",
]


@api_router.put("/users/me/vibe-details")
async def update_vibe_details(body: VibeDetailsIn, user: dict = Depends(get_current_user)):
    details = {k: v for k, v in body.details.items() if v not in (None, "", [])}
    text = " ".join(str(details.get(k, "")) for k in ("public_summary", "private_details", "intent", "context")).lower()
    if any(t in text for t in BANNED_OPPORTUNITY_TERMS):
        raise HTTPException(
            status_code=400,
            detail="This opportunity isn't allowed on Intro. Weapons, drugs, adult services, gambling, investment schemes and medical claims are prohibited.",
        )
    await db.users.update_one({"id": user["id"]}, {"$set": {"vibe_details": details}})
    user = await db.users.find_one({"id": user["id"]})
    return public_user(user)


# ----------------------------- Saved for later -----------------------------
@api_router.post("/saved")
async def save_profile(body: SaveProfileIn, user: dict = Depends(get_current_user)):
    existing = await db.saved.find_one({"owner_id": user["id"], "user_id": body.user_id})
    if not existing:
        await db.saved.insert_one({
            "id": str(uuid.uuid4()), "owner_id": user["id"], "user_id": body.user_id,
            "distance_at_save": body.distance, "saved_at": now_iso(),
        })
    return {"ok": True}


@api_router.get("/saved")
async def list_saved(user: dict = Depends(get_current_user)):
    saved = await db.saved.find({"owner_id": user["id"]}).to_list(200)
    saved.sort(key=lambda s: s["saved_at"], reverse=True)
    blocked = await get_blocked_ids(user["id"])
    ids = [s["user_id"] for s in saved if s["user_id"] not in blocked]
    users_by_id = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"hashed_password": 0, "_id": 0})}
    out = []
    for s in saved:
        if s["user_id"] in blocked:
            continue
        u = users_by_id.get(s["user_id"])
        if not u:
            continue
        vd = u.get("vibe_details") or {}
        available = bool(u.get("visible", True)) and u.get("admin_status") not in ("hidden_pending_review", "banned")
        out.append({
            "id": u["id"], "name": u.get("name"), "age": u.get("age"),
            "photo_url": u.get("photo_url"), "vibe": u.get("vibe"),
            "intent": vd.get("intent"), "verified": u.get("verified", False),
            "available": available,
            "distance_at_save": s.get("distance_at_save"), "saved_at": s["saved_at"],
        })
    return out


@api_router.delete("/saved/{user_id}")
async def unsave_profile(user_id: str, user: dict = Depends(get_current_user)):
    await db.saved.delete_one({"owner_id": user["id"], "user_id": user_id})
    return {"ok": True}


@api_router.put("/users/me/state")
async def update_state(body: StateUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.dict().items() if v is not None}
    if "plan" in fields:
        if fields["plan"] not in PLAN_LIMITS:
            raise HTTPException(status_code=400, detail="Unknown plan")
        # switching plans applies the plan's default radius (Free 50, Plus 100, Pro 250)
        fields["radius"] = PLAN_DEFAULT_RADIUS.get(fields["plan"], 50)
    if "radius" in fields:
        plan = fields.get("plan", user.get("plan", "free"))
        cap = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["max_radius"]
        fields["radius"] = max(10, min(int(fields["radius"]), cap, 500))
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
def _vd(u: dict) -> dict:
    return u.get("vibe_details") or {}


def _lset(items) -> set:
    return {str(x).lower() for x in (items or [])}


def detail_score(me: dict, o: dict) -> int:
    """Compatibility boost based on Vibe Details. Higher = more relevant."""
    mv, ov = _vd(me), _vd(o)
    score = 0
    my_tags = _lset(mv.get("tags")) | _lset(me.get("interests"))
    o_tags = _lset(ov.get("tags")) | _lset(o.get("interests"))
    score += 2 * len(my_tags & o_tags)
    my_helps = _lset(mv.get("can_help_with")) | _lset(mv.get("offer_categories"))
    o_helps = _lset(ov.get("can_help_with")) | _lset(ov.get("offer_categories"))
    # advice fit: their need matches what I can help with (and vice versa)
    for cat, helps in ((ov.get("advice_category"), my_helps), (mv.get("advice_category"), o_helps)):
        if cat:
            key = cat.lower().replace(" advice", "")
            if any(key in h or h in key for h in helps):
                score += 8
    # recruiter <-> job seeker fit
    o_recruiter = ov.get("recruiter_mode") or ov.get("professional_identity") == "Recruiter"
    m_recruiter = mv.get("recruiter_mode") or mv.get("professional_identity") == "Recruiter"
    o_seeker = ov.get("job_seeker_mode") or ov.get("professional_identity") == "Job seeker"
    m_seeker = mv.get("job_seeker_mode") or mv.get("professional_identity") == "Job seeker"
    if (o_recruiter and m_seeker) or (m_recruiter and o_seeker):
        score += 8
    # relationship intention alignment
    if mv.get("relationship_intention") and mv.get("relationship_intention") == ov.get("relationship_intention"):
        score += 6
    # training type overlap
    score += 4 * len(_lset(mv.get("training_type")) & _lset(ov.get("training_type")))
    # same industry for networking
    if me.get("vibe") == "networking" == o.get("vibe") and mv.get("industry") and mv.get("industry") == ov.get("industry"):
        score += 4
    # what they look for matches what I offer
    score += 3 * len(_lset(ov.get("looking_for")) & my_helps)
    # connection intent strength: actively looking > open > just browsing
    strength = ov.get("intent_strength")
    if strength == "Actively looking now":
        score += 6
    elif strength == "Open if the vibe is right":
        score += 3
    elif strength == "Just browsing":
        score -= 5
    if ov.get("availability") == "Just browsing":
        score -= 3
    # same live event = high relevance
    if me.get("event_code") and me.get("event_code") == o.get("event_code"):
        score += 5
    return score


def mutual_reason(me: dict, o: dict) -> Optional[str]:
    """Short human explanation of why this person is shown."""
    mv, ov = _vd(me), _vd(o)
    name = o.get("name") or "They"
    if me.get("event_code") and me.get("event_code") == o.get("event_code"):
        return f"You are both at {o.get('event_name') or 'the same event'}"
    if ov.get("recruiter_mode") or ov.get("professional_identity") == "Recruiter":
        roles = ", ".join(ov.get("hiring_roles") or [])
        return f"{name} is hiring: {roles}" if roles else f"{name} is hiring nearby"
    if o.get("vibe") == "need_advice" and ov.get("advice_category"):
        cat = ov["advice_category"].lower().replace(" advice", "")
        my_helps = _lset(mv.get("can_help_with")) | _lset(mv.get("offer_categories"))
        if any(cat in h or h in cat for h in my_helps):
            return f"{name} needs {cat} advice and you can help with {cat}"
        return f"{name} is looking for {cat} advice"
    if o.get("vibe") == "coffee_drinks":
        return f"{name} is nearby and open to coffee"
    if me.get("vibe") and me.get("vibe") == o.get("vibe"):
        label = next((v["label"] for v in VIBES if v["key"] == me["vibe"]), me["vibe"])
        return f"You both selected {label}"
    shared = _lset(_vd(me).get("tags")) & _lset(ov.get("tags"))
    if shared:
        return f"You both like {sorted(shared)[0].title()}"
    return None


async def get_blocked_ids(user_id: str) -> set:
    blocks = await db.blocks.find({"$or": [{"blocker_id": user_id}, {"blocked_id": user_id}]}).to_list(500)
    ids = set()
    for b in blocks:
        ids.add(b["blocker_id"])
        ids.add(b["blocked_id"])
    # "Hide from this person" removes both users from each other permanently
    hides = await db.hides.find({"$or": [{"hider_id": user_id}, {"hidden_id": user_id}]}).to_list(500)
    for h in hides:
        ids.add(h["hider_id"])
        ids.add(h["hidden_id"])
    ids.discard(user_id)
    return ids


HD_NAMES = [
    "Aria", "Ben", "Chloe", "Dev", "Elena", "Finn", "Grace", "Hugo", "Isla", "Jack",
    "Kira", "Leo", "Maya", "Nico", "Ora", "Priya", "Quinn", "Rosa", "Sam", "Tara",
    "Uma", "Vik", "Willa", "Xavi", "Yara", "Zane",
]


def synthetic_nearby(user: dict, radius: float, count: int) -> list:
    """High Density Demo: deterministic synthetic profiles within the radius.
    Approximate positions only — never real people, never exact pins."""
    my_vibe = user.get("vibe")
    compat = COMPAT.get(my_vibe, []) if my_vibe else []
    vibe_keys = [v["key"] for v in VIBES if v["key"] != "busy"]
    out = []
    for i in range(count):
        vibe = vibe_keys[i % len(vibe_keys)]
        dist = 8 + ((i * 37) % max(int(radius) - 8, 8))
        brg = (i * 53) % 360
        out.append({
            "id": f"hd-{i}",
            "name": HD_NAMES[i % len(HD_NAMES)],
            "age": 21 + (i % 17),
            "bio": "High-density demo profile.",
            "photo_url": f"https://i.pravatar.cc/150?img={(i % 70) + 1}",
            "interests": [],
            "vibe": vibe,
            "distance": round(dist),
            "bearing": brg,
            "compatible": bool(my_vibe and my_vibe != "busy" and vibe in compat),
            "verified": i % 4 == 0,
            "active_now": i % 3 != 0,
            "is_demo": True,
            "intent": None,
            "context": None,
            "tags": [],
            "vibe_details": {},
            "availability": None,
            "intent_strength": None,
            "event_name": None,
            "mutual_reason": None,
            "score": i % 7,
        })
    return out


async def compute_nearby(user: dict, lat: float, lng: float) -> list:
    cap = plan_max_radius(user)  # Free 50m, Plus 100m, Pro 500m — never beyond 500m
    radius = min(user.get("radius", 50) or 50, cap)
    my_vibe = user.get("vibe")
    compat = COMPAT.get(my_vibe, []) if my_vibe else []
    blocked = await get_blocked_ids(user["id"])
    results = []
    others = await db.users.find({"id": {"$ne": user["id"]}}, {"hashed_password": 0, "_id": 0}).to_list(500)
    for o in others:
        if o["id"] in blocked:
            continue
        # worldwide app, local radar: only people in the same city ever appear
        if o.get("city", "Melbourne") != user.get("city", "Melbourne"):
            continue
        if not o.get("visible", True) or o.get("ghost_mode") or o.get("paused"):
            continue
        # users hidden or banned by moderation never appear
        if o.get("admin_status") in ("hidden_pending_review", "banned"):
            continue
        if o.get("is_demo") and o.get("demo_dist") is not None:
            dist = o["demo_dist"]
            brg = o.get("demo_bearing", 0)
        elif o.get("lat") is not None:
            dist = haversine(lat, lng, o["lat"], o["lng"])
            brg = bearing_between(lat, lng, o["lat"], o["lng"])
        else:
            continue
        if dist > radius or dist > cap or dist > 500:
            continue
        o_vibe = o.get("vibe")
        if user.get("only_same_vibe") and o_vibe != my_vibe:
            continue
        if user.get("verified_only") and not o.get("verified"):
            continue
        ovd = _vd(o)
        o_recruiter = ovd.get("recruiter_mode") or ovd.get("professional_identity") == "Recruiter"
        # privacy: users can hide recruiter profiles
        if o_recruiter and user.get("show_recruiters", True) is False:
            continue
        # Busy users are invisible unless they explicitly chose to stay visible
        if o_vibe == "busy" and ovd.get("busy_setting") != "Visible but not available":
            continue
        # Mutual Only Mode: they only appear to people matching their preferences
        if o.get("mutual_only"):
            o_compat = COMPAT.get(o_vibe, []) if o_vibe else []
            if my_vibe != o_vibe and my_vibe not in o_compat:
                continue
            if o.get("verified_only") and not user.get("verified"):
                continue
            if o.get("only_same_vibe") and my_vibe != o_vibe:
                continue
            mvd = _vd(user)
            if o.get("show_recruiters", True) is False and (mvd.get("recruiter_mode") or mvd.get("professional_identity") == "Recruiter"):
                continue
        vis = ovd.get("visibility", "public")
        shown_details = ovd if vis == "public" else ({"intent": ovd.get("intent")} if vis in ("after_view", "after_accept") else {})
        # opportunity private details unlock only after a mutual connection — never in discovery
        shown_details = {k: v for k, v in shown_details.items() if k != "private_details"}
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
            "compatible": bool(my_vibe and my_vibe != "busy" and o_vibe in compat),
            "verified": o.get("verified", False),
            "active_now": o.get("active_now", True),
            "is_demo": o.get("is_demo", False),
            "intent": shown_details.get("intent"),
            "context": shown_details.get("context"),
            "tags": shown_details.get("tags", []),
            "vibe_details": shown_details,
            "availability": ovd.get("availability"),
            "intent_strength": ovd.get("intent_strength"),
            "event_name": o.get("event_name"),
            "mutual_reason": mutual_reason(user, o),
            "score": detail_score(user, o),
        })
    # High Density Demo: simulate a packed venue (142 people within radius)
    if user.get("high_density_demo"):
        need = 142 - len(results)
        if need > 0:
            results.extend(synthetic_nearby(user, radius, need))
    # most relevant first (vibe-detail fit), then closest — capped at 100 discovery profiles
    results.sort(key=lambda r: (-r["score"], r["distance"]))
    return results[:MAX_DISCOVERY]


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
    title = (vibe_def or {}).get("ping_title") or "Someone nearby wants to connect 👋"
    if p.get("kind") == "request":
        title = (
            f"{u_info.get('name')} would like to help 🤝"
            if p.get("about") == "help_offer"
            else f"{u_info.get('name')} wants to discuss your Opportunity ✨"
            if p.get("about") == "opportunity"
            else f"{u_info.get('name')} wants to connect 🤝"
        )
    return {
        "id": p["id"],
        "status": p["status"],
        "vibe": p["vibe"],
        "kind": p.get("kind", "ping"),
        "about": p.get("about"),
        "title": title,
        "distance": p.get("distance_meters"),
        "created_at": p["created_at"],
        "reason": u_info.get("mutual_reason"),
        "context": u_info.get("context"),
        "intent": u_info.get("intent"),
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
    # just-browsing users don't get urgent pings
    uvd = _vd(user)
    if uvd.get("availability") == "Just browsing" or uvd.get("intent_strength") == "Just browsing":
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
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
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
            "intent": _vd(u).get("intent"), "context": _vd(u).get("context"),
            "mutual_reason": mutual_reason(user, u),
        }
        out.append(ping_payload(p, info))
    return out


@api_router.post("/pings/{ping_id}/dismiss")
async def dismiss_ping(ping_id: str, user: dict = Depends(get_current_user)):
    await db.pings.update_one({"id": ping_id, "to_user_id": user["id"]}, {"$set": {"status": "dismissed"}})
    return {"ok": True}


@api_router.post("/pings/{ping_id}/decline")
async def decline_ping(ping_id: str, user: dict = Depends(get_current_user)):
    """Recipient explicitly declines a connection request. No connection is created."""
    ping = await db.pings.find_one({"id": ping_id, "to_user_id": user["id"]})
    if not ping:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.pings.update_one({"id": ping_id}, {"$set": {"status": "declined"}})
    return {"ok": True}


@api_router.post("/pings/{ping_id}/accept")
async def accept_ping(ping_id: str, user: dict = Depends(get_current_user)):
    ping = await db.pings.find_one({"id": ping_id, "to_user_id": user["id"]})
    if not ping:
        raise HTTPException(status_code=404, detail="Ping not found")
    blocked = await get_blocked_ids(user["id"])
    if ping["from_user_id"] in blocked:
        raise HTTPException(status_code=403, detail="You can't connect with this user")
    new_status = "accepted" if ping.get("kind") == "request" else "recent"
    await db.pings.update_one({"id": ping_id}, {"$set": {"status": new_status}})
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
async def create_match_endpoint(body: MatchIn, user: dict = Depends(get_current_user)):
    """DEPRECATED instant-match path — now consent-based. Behaves exactly like /connect/request."""
    return await request_connection(body, user)


async def _validate_connect_target(me: dict, target_id: str) -> dict:
    if target_id == me["id"]:
        raise HTTPException(status_code=400, detail="You can't connect with yourself")
    target = await db.users.find_one({"id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("admin_status") in ("hidden_pending_review", "banned"):
        raise HTTPException(status_code=403, detail="This user is not available")
    if not target.get("visible", True) or target.get("ghost_mode") or target.get("paused"):
        raise HTTPException(status_code=403, detail="This user is not available right now")
    blocked = await get_blocked_ids(me["id"])
    if target_id in blocked:
        raise HTTPException(status_code=403, detail="You can't connect with this user")
    return target


@api_router.post("/connect/request")
async def request_connection(body: MatchIn, user: dict = Depends(get_current_user)):
    """Consent flow step 1: create a PENDING connection request. The other user
    must explicitly accept before any connection (or Opportunity private details) unlocks."""
    target = await _validate_connect_target(user, body.user_id)
    if body.help_request_id:
        ok, vcats = await _active_pro(user["id"])
        if not ok:
            raise HTTPException(status_code=403, detail="Professional verification is required before offering services")
        hr = await db.help_requests.find_one({"id": body.help_request_id})
        if hr and hr.get("category") not in vcats:
            raise HTTPException(status_code=403, detail="You can only offer help inside your verified categories")
    existing_match = await db.matches.find_one({
        "active": True,
        "$or": [{"user_a": user["id"], "user_b": body.user_id}, {"user_a": body.user_id, "user_b": user["id"]}],
    })
    if existing_match:
        existing_match.pop("_id", None)
        return {"status": "connected", "match": existing_match}
    # the other user already asked ME — sending a request back counts as explicit mutual consent
    reverse = await db.pings.find_one({"kind": "request", "from_user_id": body.user_id, "to_user_id": user["id"], "status": "new"})
    if reverse:
        await db.pings.update_one({"id": reverse["id"]}, {"$set": {"status": "accepted"}})
        match = await create_match_docs(user["id"], body.user_id)
        return {"status": "connected", "match": match}
    # no duplicate pending requests
    mine = await db.pings.find_one({"kind": "request", "from_user_id": user["id"], "to_user_id": body.user_id, "status": "new"})
    if mine:
        return {"status": "pending", "request_id": mine["id"]}
    ping = {
        "id": str(uuid.uuid4()),
        "kind": "request",
        "about": "help_offer" if body.help_request_id else ("opportunity" if target.get("vibe") == "opportunity" else "connect"),
        "help_request_id": body.help_request_id,
        "from_user_id": user["id"],
        "to_user_id": body.user_id,
        "vibe": user.get("vibe") or "open_to_chat",
        "status": "new",
        "distance_meters": target.get("demo_dist"),
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    }
    await db.pings.insert_one(dict(ping))
    return {"status": "pending", "request_id": ping["id"]}


@api_router.get("/connect/requests")
async def list_connection_requests(user: dict = Depends(get_current_user)):
    """Incoming pending requests (to accept/decline) + my outgoing requests with their
    status — the in-app notification surface for accepted/declined requests."""
    blocked = await get_blocked_ids(user["id"])
    incoming_raw = await db.pings.find({"kind": "request", "to_user_id": user["id"], "status": "new"}).to_list(100)
    outgoing_raw = await db.pings.find({"kind": "request", "from_user_id": user["id"]}).to_list(100)
    ids = list({p["from_user_id"] for p in incoming_raw} | {p["to_user_id"] for p in outgoing_raw})
    users_by_id = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"hashed_password": 0, "_id": 0})}

    def info(uid: str) -> dict:
        u = users_by_id.get(uid) or {}
        return {"id": uid, "name": u.get("name"), "age": u.get("age"), "photo_url": u.get("photo_url"), "vibe": u.get("vibe")}

    def row(p: dict, uid: str) -> dict:
        return {"id": p["id"], "status": p["status"], "about": p.get("about", "connect"), "created_at": p["created_at"], "user": info(uid)}

    incoming = [row(p, p["from_user_id"]) for p in sorted(incoming_raw, key=lambda x: x["created_at"], reverse=True) if p["from_user_id"] not in blocked]
    outgoing = [row(p, p["to_user_id"]) for p in sorted(outgoing_raw, key=lambda x: x["created_at"], reverse=True) if p["to_user_id"] not in blocked]
    return {"incoming": incoming, "outgoing": outgoing}


@api_router.get("/opportunity/{user_id}")
async def get_opportunity(user_id: str, user: dict = Depends(get_current_user)):
    """Public opportunity info for a nearby user. Private details unlock ONLY after a mutual connection."""
    other = await db.users.find_one({"id": user_id}, {"hashed_password": 0, "_id": 0})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    vd = other.get("vibe_details") or {}
    match = await db.matches.find_one({
        "active": True,
        "$or": [{"user_a": user["id"], "user_b": user_id}, {"user_a": user_id, "user_b": user["id"]}],
    })
    connected = bool(match)
    request_status = "connected" if connected else "none"
    if not connected:
        mine = await db.pings.find({"kind": "request", "from_user_id": user["id"], "to_user_id": user_id}).to_list(20)
        if mine:
            latest = sorted(mine, key=lambda p: p["created_at"], reverse=True)[0]
            if latest["status"] == "new":
                request_status = "pending"
            elif latest["status"] == "declined":
                request_status = "declined"
    return {
        "user": {
            "id": other["id"], "name": other.get("name"), "age": other.get("age"),
            "photo_url": other.get("photo_url"), "verified": other.get("verified", False),
            "active_now": other.get("active_now", True), "bio": other.get("bio", ""),
            "city": other.get("city", "Melbourne"),
        },
        "opportunity": {
            "opportunity_type": vd.get("opportunity_type"),
            "category": vd.get("category"),
            "public_summary": vd.get("public_summary") or vd.get("intent"),
            "payment": vd.get("payment"),
        },
        "connected": connected,
        "request_status": request_status,
        "private_details": (vd.get("private_details") or None) if connected else None,
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
        "meetup_point": body.meetup_point,
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


@api_router.post("/meetups/{meetup_id}/cancel")
async def cancel_meetup(meetup_id: str, body: CancelMeetupIn, user: dict = Depends(get_current_user)):
    m = await db.meetups.find_one({"id": meetup_id, "$or": [{"user_a": user["id"]}, {"user_b": user["id"]}]})
    if not m:
        raise HTTPException(status_code=404, detail="Meetup not found")
    await db.meetups.update_one({"id": meetup_id}, {"$set": {"active": False, "ended_at": now_iso(), "cancelled": True, "cancel_reason": body.reason}})
    other_id = m["user_b"] if m["user_a"] == user["id"] else m["user_a"]
    await db.cancellations.insert_one({
        "id": str(uuid.uuid4()), "meetup_id": meetup_id, "user_id": user["id"],
        "other_id": other_id, "reason": body.reason, "created_at": now_iso(),
    })
    if body.reason == "They did not show":
        await db.no_shows.insert_one({
            "id": str(uuid.uuid4()), "meetup_id": meetup_id, "reported_by": user["id"],
            "no_show_user_id": other_id, "created_at": now_iso(),
        })
        await db.users.update_one({"id": other_id}, {"$inc": {"no_show_count": 1}})
    return {"ok": True, "message": "Meetup ended. Location sharing stopped."}


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


HIGH_RISK_WORDS = ["unsafe", "threat", "sexual", "stalk", "danger", "illegal", "weapon"]
MEDIUM_RISK_WORDS = ["harass", "fake", "repeated", "recruiter spam", "mislead", "uncomfortable", "inappropriate", "scam", "payment dispute", "spam"]


def classify_risk(reason: str) -> str:
    r = (reason or "").lower()
    if any(w in r for w in HIGH_RISK_WORDS):
        return "high"
    if any(w in r for w in MEDIUM_RISK_WORDS):
        return "medium"
    return "low"


@api_router.post("/reports")
async def report_user(body: ReportIn, user: dict = Depends(get_current_user)):
    risk = classify_risk(body.reason)
    status_label = "New"
    reported = await db.users.find_one({"id": body.user_id})
    if risk == "high":
        # 1 high-risk report pauses visibility pending review
        await db.users.update_one({"id": body.user_id}, {"$set": {"visible": False, "admin_status": "hidden_pending_review"}})
        status_label = "User Hidden"
    elif risk == "medium":
        prev = await db.reports.count_documents({"reported_id": body.user_id, "risk": "medium"})
        if prev + 1 >= 3:
            await db.users.update_one({"id": body.user_id}, {"$set": {"visible": False, "admin_status": "hidden_pending_review"}})
            status_label = "User Hidden"
        else:
            await db.users.update_one({"id": body.user_id}, {"$set": {"admin_status": "flagged"}})
    await db.reports.insert_one({
        "id": str(uuid.uuid4()), "reporter_id": user["id"], "reported_id": body.user_id,
        "reporter_name": user.get("name"), "reported_name": (reported or {}).get("name"),
        "reason": body.reason, "details": body.details or "", "risk": risk,
        "status": status_label, "created_at": now_iso(),
    })
    # reporter never sees this person again
    if not await db.hides.find_one({"hider_id": user["id"], "hidden_id": body.user_id}):
        await db.hides.insert_one({"id": str(uuid.uuid4()), "hider_id": user["id"], "hidden_id": body.user_id, "created_at": now_iso()})
    return {"ok": True, "risk": risk, "message": "Thanks. We'll review this report. You will no longer see this person."}


@api_router.post("/hide")
async def hide_from_person(body: BlockIn, user: dict = Depends(get_current_user)):
    if not await db.hides.find_one({"hider_id": user["id"], "hidden_id": body.user_id}):
        await db.hides.insert_one({"id": str(uuid.uuid4()), "hider_id": user["id"], "hidden_id": body.user_id, "created_at": now_iso()})
    # remove from saved lists both ways
    await db.saved.delete_many({"$or": [
        {"owner_id": user["id"], "user_id": body.user_id},
        {"owner_id": body.user_id, "user_id": user["id"]},
    ]})
    return {"ok": True, "message": "You will no longer see each other."}


@api_router.post("/dismissal-feedback")
async def dismissal_feedback(body: DismissFeedbackIn, user: dict = Depends(get_current_user)):
    await db.dismissal_feedback.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "dismissed_id": body.user_id,
        "reason": body.reason, "created_at": now_iso(),
    })
    return {"ok": True}


# ----------------------------- Event codes -----------------------------
EVENT_CODES = {
    "INTRO100": "Intro 100m Social",
    "FOUNDERNIGHT": "Founder Night",
    "CAMPUSCHAT": "Campus Chat",
    "MELBOURNEBETA": "Melbourne Beta",
    "NETWORK100": "Network 100",
    "COFFEECHAT": "Coffee Chat",
}


@api_router.post("/events/join-code")
async def join_event_code(body: EventCodeIn, user: dict = Depends(get_current_user)):
    code = body.code.strip().upper()
    if code not in EVENT_CODES:
        raise HTTPException(status_code=404, detail="Event code not found.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"event_code": code, "event_name": EVENT_CODES[code]}})
    await db.analyticsEvents.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "event": "event_join", "code": code, "created_at": now_iso()})
    user = await db.users.find_one({"id": user["id"]})
    return {"ok": True, "event_name": EVENT_CODES[code], "user": public_user(user)}


@api_router.post("/events/leave")
async def leave_event(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"event_code": None, "event_name": None}})
    user = await db.users.find_one({"id": user["id"]})
    return {"ok": True, "user": public_user(user)}


# ----------------------------- Profile completion -----------------------------
@api_router.get("/users/me/completion")
async def profile_completion(user: dict = Depends(get_current_user)):
    vd = user.get("vibe_details") or {}
    items = [
        ("Profile photos", bool(user.get("photos")) or bool(user.get("photo_url")), "Add profile photos"),
        ("First name", bool(user.get("name")), "Add your first name"),
        ("Age", bool(user.get("age")), "Add your age"),
        ("Bio", bool(user.get("bio")), "Add a short bio"),
        ("Vibe selected", bool(user.get("vibe")), "Choose a vibe"),
        ("Vibe details", bool(vd.get("intent") or vd.get("context") or vd.get("looking_for")), "Add vibe details"),
        ("Interests", bool(user.get("interests")), "Add your interests"),
        ("Availability window", bool(vd.get("availability")), "Select an availability window"),
        ("Verification", bool(user.get("verified")), "Verify your profile"),
        ("Privacy reviewed", any(k in user for k in ("quiet_mode", "mutual_only", "only_same_vibe", "verified_only")), "Review your privacy settings"),
    ]
    done = [label for label, ok, _ in items if ok]
    suggestions = [tip for _, ok, tip in items if not ok][:4]
    return {
        "score": round(len(done) / len(items) * 100),
        "done": done,
        "suggestions": suggestions,
        "message": "More detail helps the right people know when to approach.",
    }


# ----------------------------- Admin / moderation dashboard -----------------------------
@api_router.get("/admin/dashboard")
async def admin_dashboard(user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"hashed_password": 0, "_id": 0}).to_list(2000)
    active = [u for u in users if u.get("visible", True) and u.get("active_now", True)]
    by_city: Dict[str, int] = {}
    for u in active:
        by_city[u.get("city", "Melbourne")] = by_city.get(u.get("city", "Melbourne"), 0) + 1
    recruiters = [u for u in users if _vd(u).get("recruiter_mode") or _vd(u).get("professional_identity") == "Recruiter"]
    reports = await db.reports.find({}).to_list(200)
    reports.sort(key=lambda r: r["created_at"], reverse=True)
    blocks = await db.blocks.find({}).to_list(200)
    recent_blocks = blocks[-50:]
    block_ids = {b["blocker_id"] for b in recent_blocks} | {b["blocked_id"] for b in recent_blocks}
    names_by_id = {u["id"]: u.get("name") async for u in db.users.find({"id": {"$in": list(block_ids)}}, {"id": 1, "name": 1})}
    block_rows = []
    for b in recent_blocks:
        block_rows.append({
            "blocker": names_by_id.get(b["blocker_id"]) or "Unknown",
            "blocked": names_by_id.get(b["blocked_id"]) or "Unknown",
            "created_at": b.get("created_at"),
        })
    incidents = {"high": 0, "medium": 0, "low": 0}
    for r in reports:
        incidents[r.get("risk", "low")] = incidents.get(r.get("risk", "low"), 0) + 1
    fb = await db.feedback.find({}).to_list(1000)
    return {
        "overview": {
            "total_users": len(users),
            "active_today": len(active),
            "active_by_city": by_city,
            "active_by_event": {name: sum(1 for u in active if u.get("event_code") == code) for code, name in EVENT_CODES.items() if any(u.get("event_code") == code for u in active)},
            "pings_sent": await db.pings.count_documents({}),
            "profiles_viewed": await db.analyticsEvents.count_documents({"event": "profile_view"}),
            "mutual_accepts": await db.pings.count_documents({"status": "accepted"}),
            "meetups_started": await db.meetups.count_documents({}),
            "meetups_completed": await db.meetups.count_documents({"active": False}),
            "conversations_confirmed": sum(1 for f in fb if f.get("spoke") in ("Yes, we spoke", "We exchanged details", "We made plans")),
            "reports_submitted": len(reports),
            "blocks_created": len(blocks),
            "users_hidden_for_review": sum(1 for u in users if u.get("admin_status") in ("hidden_pending_review", "banned")),
            "no_shows": await db.no_shows.count_documents({}),
            "cancellations": await db.cancellations.count_documents({}),
        },
        "reports_queue": [{
            "id": r["id"], "reported_name": r.get("reported_name") or "Unknown",
            "reporter_name": r.get("reporter_name") or "Unknown", "reason": r.get("reason"),
            "details": r.get("details", ""), "risk": r.get("risk", "low"),
            "status": r.get("status", "New"), "created_at": r.get("created_at"),
        } for r in reports[:50]],
        "blocked_users": block_rows,
        "safety_incidents": incidents,
        "trial_metrics": {
            "event": TRIAL_EVENT["name"], "city": "Melbourne",
            "active_users": len(active),
            "pings": await db.pings.count_documents({}),
            "mutual_accepts": await db.pings.count_documents({"status": "accepted"}),
            "conversations_confirmed": sum(1 for f in fb if f.get("spoke") in ("Yes, we spoke", "We exchanged details", "We made plans")),
            "reports": len(reports),
            "feedback_count": len(fb),
        },
        "recruiter_activity": {
            "recruiter_profiles": len(recruiters),
            "hiring_posts": sum(1 for u in recruiters if _vd(u).get("hiring_roles")),
            "recruiter_spam_reports": sum(1 for r in reports if "recruiter" in (r.get("reason") or "").lower()),
            "users_hiding_recruiters": sum(1 for u in users if u.get("show_recruiters") is False),
        },
    }


@api_router.post("/admin/reports/{report_id}/action")
async def admin_report_action(report_id: str, body: AdminActionIn, user: dict = Depends(get_current_user)):
    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    action = body.action
    updates: Dict[str, Any] = {}
    if action == "hide":
        await db.users.update_one({"id": report["reported_id"]}, {"$set": {"visible": False, "admin_status": "hidden_pending_review"}})
        updates["status"] = "User Hidden"
    elif action == "warn":
        await db.users.update_one({"id": report["reported_id"]}, {"$set": {"admin_status": "warned"}})
        updates["status"] = "Under Review"
    elif action == "ban":
        await db.users.update_one({"id": report["reported_id"]}, {"$set": {"visible": False, "admin_status": "banned"}})
        updates["status"] = "Resolved"
    elif action == "dismiss":
        await db.users.update_one({"id": report["reported_id"]}, {"$set": {"admin_status": None}})
        updates["status"] = "Dismissed"
    elif action == "review":
        updates["status"] = "Under Review"
    else:
        raise HTTPException(status_code=400, detail="Unknown action")
    await db.reports.update_one({"id": report_id}, {"$set": updates})
    await db.moderationActions.insert_one({
        "id": str(uuid.uuid4()), "report_id": report_id, "action": action,
        "admin_id": user["id"], "created_at": now_iso(),
    })
    return {"ok": True, "status": updates["status"]}


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



# ============================ PROFESSIONAL MODE ============================
PROFESSIONAL_MODE_ENABLED = os.environ.get("PROFESSIONAL_MODE_ENABLED", "true").lower() == "true"

PRO_CATEGORIES = [
    "HR", "Legal", "Accounting", "Finance", "Marketing", "Technology", "Business Consulting",
    "Engineering", "Trades", "Plumbing", "Electrical", "Automotive", "Property", "Education",
    "Photography", "Fitness", "Health and Wellbeing", "Other",
]
PRO_PAYMENTS = ["Open to paying", "Free advice", "Fixed fee", "Hourly", "Discuss after connecting", "Not sure"]
PRO_EXPIRY_HOURS = {"1 hour": 1, "4 hours": 4, "Today": 12, "24 hours": 24}
REGULATED_CATEGORIES = {"Legal", "Accounting", "Finance", "Health and Wellbeing", "Electrical", "Plumbing", "Trades"}
VERIFICATION_STATUSES = ["Not Submitted", "Pending Review", "Approved", "Rejected", "More Information Required", "Expired"]

# --- Verification V2: profession-specific credentials ---
PROFESSIONS: dict[str, list[str]] = {
    "HR": ["Recruitment", "Performance", "Employee Relations", "Fair Work", "Policies", "Investigations", "Training"],
    "Accounting": ["Bookkeeping", "Tax", "BAS", "Payroll", "Auditing", "Advisory"],
    "Law": ["Employment Law", "Family Law", "Commercial Law", "Property Law", "Wills and Estates", "Litigation"],
    "Marketing": ["Digital Marketing", "SEO", "Social Media", "Branding", "Content", "Advertising"],
    "Finance": ["Financial Planning", "Lending", "Insurance", "Superannuation", "Budgeting"],
    "IT": ["Web Development", "Mobile Apps", "IT Support", "Cyber Security", "Cloud", "Data"],
    "Fitness": ["Personal Training", "Group Fitness", "Strength", "Running", "Nutrition Coaching"],
    "Electrician": ["Residential Electrical", "Commercial Electrical", "Solar", "Appliance Repair", "Safety Inspections"],
    "Plumber": ["General Plumbing", "Gas Fitting", "Drainage", "Hot Water", "Roofing and Gutters"],
    "Builder": ["Renovations", "New Builds", "Carpentry", "Decks and Pergolas", "Project Management"],
    "Mechanic": ["Servicing", "Diagnostics", "Brakes", "Transmission", "Auto Electrical"],
    "Photographer": ["Portraits", "Events", "Weddings", "Product", "Real Estate Photography"],
    "Graphic Designer": ["Logos", "Branding", "Print", "UI Design", "Illustration"],
    "Business Consultant": ["Strategy", "Operations", "Small Business", "Startups", "Process Improvement"],
    "Real Estate": ["Sales", "Property Management", "Leasing", "Appraisals"],
    "Mortgage Broker": ["Home Loans", "Refinancing", "Investment Loans", "First Home Buyers"],
    "Other": ["General"],
}
# Broad help-request category each profession may serve (category restriction gate)
PROFESSION_BROAD: dict[str, str] = {
    "HR": "HR", "Accounting": "Accounting", "Law": "Legal", "Marketing": "Marketing",
    "Finance": "Finance", "IT": "Technology", "Fitness": "Fitness", "Electrician": "Electrical",
    "Plumber": "Plumbing", "Builder": "Trades", "Mechanic": "Automotive", "Photographer": "Photography",
    "Graphic Designer": "Other", "Business Consultant": "Business Consulting", "Real Estate": "Property",
    "Mortgage Broker": "Finance", "Other": "Other",
}
DOC_TYPES_ALLOWED = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}


async def notify(user_id: str, ntype: str, title: str, body_text: str):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": ntype,
        "title": title, "body": body_text, "read": False, "created_at": now_iso(),
    })


def _min_expiry(sub: dict) -> Optional[str]:
    dates = [d.get("expiry_date") for d in sub.get("documents", []) if d.get("expiry_date")]
    return min(dates) if dates else None


async def _apply_expiry(sub: dict) -> dict:
    """Automatic expiry management: reminders at 90/60/30 days, auto-expire on the date."""
    if sub.get("status") != "Approved":
        return sub
    exp = _min_expiry(sub)
    if not exp:
        sub["credential_status"] = "Verified"
        return sub
    try:
        exp_d = datetime.fromisoformat(exp).date()
    except ValueError:
        sub["credential_status"] = "Verified"
        return sub
    days = (exp_d - datetime.now(timezone.utc).date()).days
    sub["valid_until"] = exp
    if days < 0:
        await db.verification_submissions.update_one(
            {"id": sub["id"]},
            {"$set": {"status": "Expired"},
             "$push": {"history": {"action": "auto-expired", "by": "system", "at": now_iso()}}},
        )
        await notify(sub["user_id"], "verification_expired", "Verification expired",
                     "A credential has expired. Upload updated credentials to keep offering services. Existing conversations stay active.")
        sub["status"] = "Expired"
        sub["credential_status"] = "Expired"
        return sub
    sent = list(sub.get("reminders_sent", []))
    for t, prefix in ((90, ""), (60, "Reminder: "), (30, "Urgent: ")):
        if days <= t and t not in sent:
            await notify(sub["user_id"], f"verification_expiring_{t}", f"{prefix}Credentials expiring soon",
                         f"A credential expires on {exp}. Renew before then to stay verified.")
            sent.append(t)
    if sent != sub.get("reminders_sent", []):
        await db.verification_submissions.update_one({"id": sub["id"]}, {"$set": {"reminders_sent": sent}})
        sub["reminders_sent"] = sent
    sub["credential_status"] = "Expiring Soon" if days <= 90 else "Verified"
    return sub


async def _active_pro(user_id: str) -> tuple[bool, list[str]]:
    """Hard gate: only actively verified (Approved, not expired) professionals may offer services,
    and only inside the broad category of their verified profession."""
    ver = await _verification_status(user_id)
    if ver.get("status") != "Approved":
        return False, []
    broad = PROFESSION_BROAD.get(ver.get("profession") or "", "Other")
    return True, [broad]


class VerificationDocIn(BaseModel):
    doc_name: str
    issuer: Optional[str] = ""
    issue_date: Optional[str] = ""
    expiry_date: Optional[str] = None
    doc_number: Optional[str] = ""
    notes: Optional[str] = ""
    file_b64: Optional[str] = None
    file_type: Optional[str] = ""
    file_name: Optional[str] = ""


class VerificationV2In(BaseModel):
    profession: str
    categories: list[str]
    full_name: str
    id_type: str
    documents: list[VerificationDocIn]


class ModeIn(BaseModel):
    app_mode: Optional[str] = None            # "people" | "professional"
    professional_role: Optional[str] = None   # "need_help" | "can_help"


class HelpRequestIn(BaseModel):
    category: str
    public_summary: str
    private_details: Optional[str] = ""
    payment: str = "Not sure"
    expiry: str = "24 hours"
    availability: Optional[str] = ""


class HelpRequestUpdate(BaseModel):
    category: Optional[str] = None
    public_summary: Optional[str] = None
    private_details: Optional[str] = None
    payment: Optional[str] = None
    expiry: Optional[str] = None
    availability: Optional[str] = None
    status: Optional[str] = None  # active | paused


class ProProfileIn(BaseModel):
    profession: str
    primary_category: str
    additional_categories: list[str] = []
    about: Optional[str] = ""
    years_experience: Optional[int] = 0
    qualifications: Optional[str] = ""
    memberships: Optional[str] = ""
    licences: Optional[str] = ""
    certifications: Optional[str] = ""
    specialties: list[str] = []
    availability: Optional[str] = ""
    response_time: Optional[str] = ""
    rate: Optional[str] = ""
    rate_type: Optional[str] = ""


class VerificationDecisionIn(BaseModel):
    action: str                               # approve | reject | more_info | suspend | renew | mark_expired | revoke
    note: Optional[str] = ""


def _check_banned(*texts: str):
    joined = " ".join(t or "" for t in texts).lower()
    if any(t in joined for t in BANNED_OPPORTUNITY_TERMS):
        raise HTTPException(status_code=400, detail="This content isn't allowed on Intro. Weapons, drugs, adult services, gambling, investment schemes and medical claims are prohibited.")


def _hr_expires_at(expiry: str) -> str:
    hours = PRO_EXPIRY_HOURS.get(expiry, 24)
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def _hr_public(r: dict, dist: float | None = None, brg: float | None = None) -> dict:
    out = {
        "id": r["id"], "user_id": r["user_id"], "category": r["category"],
        "public_summary": r["public_summary"], "payment": r["payment"],
        "expiry": r["expiry"], "expires_at": r["expires_at"], "availability": r.get("availability", ""),
        "status": r["status"], "created_at": r["created_at"],
    }
    if dist is not None:
        out["distance"] = round(dist)
        out["bearing"] = round(brg or 0)
    return out


async def _active_request(r: dict) -> bool:
    if r["status"] != "active":
        return False
    if r["expires_at"] < now_iso():
        await db.help_requests.update_one({"id": r["id"]}, {"$set": {"status": "expired"}})
        return False
    return True


@api_router.get("/config")
async def get_config():
    return {"professional_mode_enabled": PROFESSIONAL_MODE_ENABLED, "pro_categories": PRO_CATEGORIES, "pro_payments": PRO_PAYMENTS, "pro_expiry_options": list(PRO_EXPIRY_HOURS.keys()), "professions": PROFESSIONS, "profession_broad": PROFESSION_BROAD}


@api_router.put("/users/me/mode")
async def set_mode(body: ModeIn, user: dict = Depends(get_current_user)):
    upd = {}
    if body.app_mode in ("people", "professional"):
        upd["app_mode"] = body.app_mode
    if body.professional_role in ("need_help", "can_help"):
        upd["professional_role"] = body.professional_role
    if upd:
        await db.users.update_one({"id": user["id"]}, {"$set": upd})
    return {"ok": True, **upd}


# --------------------- Help Requests (I Need Help) ---------------------
@api_router.post("/help-requests")
async def create_help_request(body: HelpRequestIn, user: dict = Depends(get_current_user)):
    if body.category not in PRO_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    if not body.public_summary.strip():
        raise HTTPException(status_code=400, detail="Public summary is required")
    _check_banned(body.public_summary, body.private_details or "")
    existing = await db.help_requests.find_one({"user_id": user["id"], "status": {"$in": ["active", "paused"]}})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an open request. Edit, pause or delete it first.")
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "category": body.category,
        "public_summary": body.public_summary.strip()[:80],
        "private_details": (body.private_details or "").strip()[:300],
        "payment": body.payment if body.payment in PRO_PAYMENTS else "Not sure",
        "expiry": body.expiry, "expires_at": _hr_expires_at(body.expiry),
        "availability": (body.availability or "")[:80],
        "status": "active", "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.help_requests.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/help-requests/mine")
async def my_help_requests(user: dict = Depends(get_current_user)):
    rows = await db.help_requests.find({"user_id": user["id"], "status": {"$ne": "deleted"}}).to_list(20)
    for r in rows:
        await _active_request(r)  # lazily expire
        r.pop("_id", None)
        if r["status"] == "active" and r["expires_at"] < now_iso():
            r["status"] = "expired"
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return rows


@api_router.get("/help-requests/{req_id}")
async def get_help_request(req_id: str, user: dict = Depends(get_current_user)):
    r = await db.help_requests.find_one({"id": req_id})
    if not r or r["status"] == "deleted":
        raise HTTPException(status_code=404, detail="Request not found")
    owner = await db.users.find_one({"id": r["user_id"]}, {"hashed_password": 0, "_id": 0})
    is_owner = r["user_id"] == user["id"]
    match = None if is_owner else await db.matches.find_one({
        "active": True,
        "$or": [{"user_a": user["id"], "user_b": r["user_id"]}, {"user_a": r["user_id"], "user_b": user["id"]}],
    })
    connected = bool(match)
    mine = None
    if not is_owner:
        mine = await db.pings.find_one({"kind": "request", "from_user_id": user["id"], "to_user_id": r["user_id"]}, sort=[("created_at", -1)])
    request_status = "connected" if connected else ("pending" if mine and mine["status"] == "new" else "declined" if mine and mine["status"] == "declined" else "none")
    out = _hr_public(r)
    dist = owner.get("demo_dist") if owner else None
    if dist is not None:
        out["distance"] = round(dist)
    out.update({
        "is_owner": is_owner,
        "connected": connected,
        "request_status": request_status,
        "private_details": r.get("private_details") if (is_owner or connected) else None,
        "user": {"id": owner["id"], "name": owner.get("name"), "photo_url": owner.get("photo_url"), "verified": owner.get("verified", False), "active_now": owner.get("active_now", True)} if owner else None,
    })
    return out


@api_router.put("/help-requests/{req_id}")
async def update_help_request(req_id: str, body: HelpRequestUpdate, user: dict = Depends(get_current_user)):
    r = await db.help_requests.find_one({"id": req_id, "user_id": user["id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    upd: dict = {"updated_at": now_iso()}
    if body.category is not None:
        if body.category not in PRO_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        upd["category"] = body.category
    if body.public_summary is not None:
        _check_banned(body.public_summary)
        upd["public_summary"] = body.public_summary.strip()[:80]
    if body.private_details is not None:
        _check_banned(body.private_details)
        upd["private_details"] = body.private_details.strip()[:300]
    if body.payment is not None:
        upd["payment"] = body.payment
    if body.availability is not None:
        upd["availability"] = body.availability[:80]
    if body.expiry is not None:
        upd["expiry"] = body.expiry
        upd["expires_at"] = _hr_expires_at(body.expiry)
    if body.status in ("active", "paused"):
        upd["status"] = body.status
        if body.status == "active" and r["expires_at"] < now_iso():
            upd["expires_at"] = _hr_expires_at(r.get("expiry", "24 hours"))  # reactivate resets expiry
    await db.help_requests.update_one({"id": req_id}, {"$set": upd})
    r.update(upd)
    r.pop("_id", None)
    return r


@api_router.delete("/help-requests/{req_id}")
async def delete_help_request(req_id: str, user: dict = Depends(get_current_user)):
    res = await db.help_requests.update_one({"id": req_id, "user_id": user["id"]}, {"$set": {"status": "deleted", "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"ok": True}


@api_router.get("/help-requests/{req_id}/offers")
async def request_offers(req_id: str, user: dict = Depends(get_current_user)):
    r = await db.help_requests.find_one({"id": req_id, "user_id": user["id"]})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    blocked = await get_blocked_ids(user["id"])
    pings = await db.pings.find({"kind": "request", "about": "help_offer", "help_request_id": req_id}).to_list(100)
    out = []
    for p in sorted(pings, key=lambda x: x["created_at"], reverse=True):
        if p["from_user_id"] in blocked:
            continue
        prof = await _pro_public(p["from_user_id"], user)
        if not prof:
            continue
        out.append({"id": p["id"], "status": p["status"], "created_at": p["created_at"], "professional": prof})
    return out


# --------------------- Professional Profiles (I Can Help) ---------------------
async def _verification_status(user_id: str) -> dict:
    sub = await db.verification_submissions.find_one({"user_id": user_id}, sort=[("submitted_at", -1)])
    if not sub:
        return {"status": "Not Submitted"}
    sub = await _apply_expiry(sub)
    return {
        "status": sub["status"],
        "profession": sub.get("profession") or sub.get("category"),
        "categories": sub.get("categories", []),
        "reviewed_at": sub.get("reviewed_at"),
        "verified_since": sub.get("reviewed_at") if sub["status"] == "Approved" else None,
        "valid_until": _min_expiry(sub),
        "credential_status": sub.get("credential_status", "Verified" if sub["status"] == "Approved" else None),
        "note": sub.get("public_note", ""),
        "submitted_at": sub.get("submitted_at"),
        "documents": [
            {k: d.get(k) for k in ("doc_name", "issuer", "issue_date", "expiry_date", "doc_number", "notes", "file_name")}
            for d in sub.get("documents", [])
        ],
    }


async def _pro_public(user_id: str, viewer: dict) -> dict | None:
    u = await db.users.find_one({"id": user_id}, {"hashed_password": 0, "_id": 0})
    prof = await db.professional_profiles.find_one({"user_id": user_id})
    if not u or not prof:
        return None
    ver = await _verification_status(user_id)
    verified = ver["status"] == "Approved"
    return {
        "user_id": user_id, "name": u.get("name"), "age": u.get("age"), "photo_url": u.get("photo_url"),
        "active_now": u.get("active_now", True),
        "profession": prof.get("profession"), "primary_category": prof.get("primary_category"),
        "additional_categories": prof.get("additional_categories", []),
        "about": prof.get("about", ""), "years_experience": prof.get("years_experience", 0),
        "qualifications": prof.get("qualifications", "") if verified else (prof.get("qualifications", "") and "Under review"),
        "memberships": prof.get("memberships", "") if verified else "",
        "specialties": prof.get("specialties", []),
        "availability": prof.get("availability", ""), "response_time": prof.get("response_time", ""),
        "rate": prof.get("rate", ""), "rate_type": prof.get("rate_type", ""),
        "verified_by_intro": verified,
        "professionally_verified": verified,
        "verified_profession": ver.get("profession") if verified else None,
        "verified_categories": ver.get("categories", []) if verified else [],
        "verified_since": ver.get("verified_since"),
        "valid_until": ver.get("valid_until") if verified else None,
        "credential_status": ver.get("credential_status") if verified else None,
        "verification": {"status": ver["status"], "verified_at": ver.get("reviewed_at")} if verified else {"status": ver["status"]},
        "distance": u.get("demo_dist"),
        "regulated": prof.get("primary_category") in REGULATED_CATEGORIES,
    }


@api_router.post("/professional/profile")
async def upsert_pro_profile(body: ProProfileIn, user: dict = Depends(get_current_user)):
    if body.primary_category not in PRO_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    _check_banned(body.about or "", body.profession, body.qualifications or "")
    ok, vcats = await _active_pro(user["id"])
    if ok:
        chosen = {body.primary_category, *body.additional_categories}
        if not chosen <= set(vcats):
            raise HTTPException(status_code=400, detail="You can only offer services inside your verified categories")
    existing = await db.professional_profiles.find_one({"user_id": user["id"]})
    doc = body.model_dump()
    doc.update({"user_id": user["id"], "is_draft": not ok, "updated_at": now_iso()})
    ver = await _verification_status(user["id"])
    if existing and ver["status"] == "Approved":
        cred_fields = ("qualifications", "memberships", "licences", "certifications", "primary_category")
        if any((existing.get(f) or "") != (doc.get(f) or "") for f in cred_fields):
            # credential edits after approval trigger re-review
            await db.verification_submissions.update_one(
                {"user_id": user["id"], "status": "Approved"},
                {"$set": {"status": "Pending Review", "reviewed_at": None},
                 "$push": {"history": {"action": "re-review (credentials edited)", "by": user["id"], "at": now_iso()}}},
            )
    if existing:
        await db.professional_profiles.update_one({"user_id": user["id"]}, {"$set": doc})
    else:
        doc["created_at"] = now_iso()
        await db.professional_profiles.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/professional/profile/me")
async def my_pro_profile(user: dict = Depends(get_current_user)):
    prof = await db.professional_profiles.find_one({"user_id": user["id"]})
    ver = await _verification_status(user["id"])
    if prof:
        prof.pop("_id", None)
    return {"profile": prof, "verification": ver}


@api_router.get("/professional/profile/{user_id}")
async def pro_profile(user_id: str, user: dict = Depends(get_current_user)):
    out = await _pro_public(user_id, user)
    if not out:
        raise HTTPException(status_code=404, detail="Professional profile not found")
    return out


@api_router.get("/professional/requests")
async def matching_requests(
    lat: float = Query(...), lng: float = Query(...),
    category: Optional[str] = None, payment: Optional[str] = None,
    max_age_hours: Optional[int] = None,
    user: dict = Depends(get_current_user),
):
    """Nearby active help requests matching the professional's categories only."""
    ok, vcats = await _active_pro(user["id"])
    if not ok:
        return {"requests": [], "verification_required": True}
    my_cats = set(vcats)
    if category:
        my_cats &= {category}
    if not my_cats:
        return {"requests": []}
    blocked = await get_blocked_ids(user["id"])
    radius = float(user.get("radius", 50))
    rows = await db.help_requests.find({"status": "active", "category": {"$in": list(my_cats)}}).to_list(200)
    out = []
    for r in rows:
        if r["user_id"] == user["id"] or r["user_id"] in blocked:
            continue
        if not await _active_request(r):
            continue
        if payment and r["payment"] != payment:
            continue
        if max_age_hours:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=max_age_hours)).isoformat()
            if r["created_at"] < cutoff:
                continue
        owner = await db.users.find_one({"id": r["user_id"]})
        if not owner or owner.get("admin_status") in ("hidden_pending_review", "banned"):
            continue
        if owner.get("demo_dist") is not None:
            dist, brg = owner["demo_dist"], owner.get("demo_bearing", 0)
        elif owner.get("lat") is not None:
            dist = haversine(lat, lng, owner["lat"], owner["lng"])
            brg = bearing_between(lat, lng, owner["lat"], owner["lng"])
        else:
            continue
        if dist > radius:
            continue
        out.append(_hr_public(r, dist, brg))
    out.sort(key=lambda x: x["distance"])
    return {"requests": out[:50]}


@api_router.get("/professionals")
async def nearby_professionals(
    lat: float = Query(...), lng: float = Query(...),
    category: Optional[str] = None, verified_only: bool = False, available_now: bool = False,
    user: dict = Depends(get_current_user),
):
    blocked = await get_blocked_ids(user["id"])
    profs = await db.professional_profiles.find({"is_draft": {"$ne": True}}).to_list(200)
    out = []
    for p in profs:
        if p["user_id"] == user["id"] or p["user_id"] in blocked:
            continue
        if category and category != p.get("primary_category") and category not in p.get("additional_categories", []):
            continue
        pub = await _pro_public(p["user_id"], user)
        if not pub:
            continue
        # V2: professionals must be actively verified to be publicly listed
        if not pub["verified_by_intro"]:
            continue
        if available_now and not pub["active_now"]:
            continue
        out.append(pub)
    out.sort(key=lambda x: (not x["verified_by_intro"], x.get("distance") if x.get("distance") is not None else 9999))
    return {"professionals": out[:50]}


# --------------------- Verification (V2: credential system) ---------------------
@api_router.post("/verification/submit")
async def submit_verification(body: VerificationV2In, user: dict = Depends(get_current_user)):
    if body.profession not in PROFESSIONS:
        raise HTTPException(status_code=400, detail="Invalid profession")
    valid_cats = set(PROFESSIONS[body.profession])
    cats = [c for c in body.categories if c in valid_cats]
    if not cats:
        raise HTTPException(status_code=400, detail="Pick at least one category for your profession")
    if not body.full_name.strip() or not body.id_type.strip():
        raise HTTPException(status_code=400, detail="Identity details are required")
    if not body.documents:
        raise HTTPException(status_code=400, detail="Upload at least one credential document")
    if len(body.documents) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 documents")
    sub_id = str(uuid.uuid4())
    docs_meta = []
    doc_files = []
    for d in body.documents:
        if not d.doc_name.strip():
            raise HTTPException(status_code=400, detail="Each document needs a name")
        if d.file_b64 and d.file_type and d.file_type not in DOC_TYPES_ALLOWED:
            raise HTTPException(status_code=400, detail="Only PDF, JPG and PNG files are accepted")
        doc_id = str(uuid.uuid4())
        docs_meta.append({
            "id": doc_id, "doc_name": d.doc_name.strip()[:80], "issuer": (d.issuer or "")[:80],
            "issue_date": d.issue_date or "", "expiry_date": d.expiry_date or None,
            "doc_number": (d.doc_number or "")[:60], "notes": (d.notes or "")[:200],
            "file_name": (d.file_name or "")[:120], "file_type": d.file_type or "",
            "has_file": bool(d.file_b64),
        })
        if d.file_b64:
            doc_files.append({
                "id": doc_id, "submission_id": sub_id, "user_id": user["id"],
                "file_b64": d.file_b64, "file_type": d.file_type or "", "file_name": d.file_name or "",
                "created_at": now_iso(),
            })
    doc = {
        "id": sub_id, "user_id": user["id"],
        "profession": body.profession, "categories": cats,
        "category": PROFESSION_BROAD.get(body.profession, "Other"),  # broad category (legacy field)
        "identity": {"full_name": body.full_name.strip(), "id_type": body.id_type.strip()},
        "documents": docs_meta,
        "status": "Pending Review", "submitted_at": now_iso(), "reviewed_at": None, "reviewer": None,
        "notes": [], "public_note": "", "reminders_sent": [],
        "history": [{"action": "submitted", "by": user["id"], "at": now_iso()}],
    }
    # one live submission at a time — supersede previous non-approved
    old = await db.verification_submissions.find({"user_id": user["id"], "status": {"$in": ["Pending Review", "More Information Required", "Rejected", "Expired", "Suspended"]}}).to_list(20)
    if old:
        await db.verification_documents.delete_many({"submission_id": {"$in": [o["id"] for o in old]}})
        await db.verification_submissions.delete_many({"id": {"$in": [o["id"] for o in old]}})
    await db.verification_submissions.insert_one(dict(doc))
    if doc_files:
        await db.verification_documents.insert_many([dict(f) for f in doc_files])
    await notify(user["id"], "verification_submitted", "Verification submitted",
                 f"Your {body.profession} verification is with the review team.")
    return {"ok": True, "status": "Pending Review", "submission_id": sub_id}


@api_router.get("/verification/status")
async def verification_status(user: dict = Depends(get_current_user)):
    return await _verification_status(user["id"])


@api_router.get("/notifications")
async def my_notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return rows


def _require_admin(user: dict):
    if not user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Admin access required")


@api_router.get("/admin/verifications")
async def admin_verifications(status_filter: Optional[str] = None, user: dict = Depends(get_current_user)):
    _require_admin(user)
    q: dict = {}
    if status_filter:
        q["status"] = status_filter
    subs = await db.verification_submissions.find(q).to_list(200)
    ids = list({s["user_id"] for s in subs})
    users_by_id = {u["id"]: u async for u in db.users.find({"id": {"$in": ids}}, {"id": 1, "name": 1, "email": 1, "photo_url": 1})}
    out = []
    for s in sorted(subs, key=lambda x: x["submitted_at"], reverse=True):
        s = await _apply_expiry(s)
        s.pop("_id", None)
        u = users_by_id.get(s["user_id"], {})
        s["user"] = {"id": s["user_id"], "name": u.get("name"), "email": u.get("email"), "photo_url": u.get("photo_url")}
        s["valid_until"] = _min_expiry(s)
        out.append(s)
    return out


@api_router.get("/admin/verifications/{sub_id}/documents/{doc_id}")
async def admin_document(sub_id: str, doc_id: str, user: dict = Depends(get_current_user)):
    """Credential files are NEVER public — admin preview only."""
    _require_admin(user)
    f = await db.verification_documents.find_one({"submission_id": sub_id, "id": doc_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Document not found")
    return f


_DECISION_MAP = {
    "approve": ("Approved", "Verification approved", "You're now Professionally Verified. Your badge and verified categories are live."),
    "reject": ("Rejected", "Verification rejected", "Your verification was not approved. See the reviewer note and resubmit."),
    "more_info": ("More Information Required", "More information requested", "The review team needs more information. Check the note and resubmit."),
    "suspend": ("Suspended", "Verification suspended", "Your verification is suspended. Contact support or resubmit updated credentials."),
    "renew": ("Approved", "Verification renewed", "Your verification has been renewed. Your badge stays live."),
    "mark_expired": ("Expired", "Verification expired", "Your verification was marked expired. Upload updated credentials to continue."),
    "revoke": ("Rejected", "Verification removed", "Your verification badge was removed by the review team."),
}


@api_router.post("/admin/verifications/{sub_id}/decision")
async def admin_verification_decision(sub_id: str, body: VerificationDecisionIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    sub = await db.verification_submissions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if body.action not in _DECISION_MAP:
        raise HTTPException(status_code=400, detail="Invalid action")
    new_status, n_title, n_body = _DECISION_MAP[body.action]
    upd = {
        "status": new_status, "reviewed_at": now_iso(), "reviewer": user["id"],
        "public_note": (body.note or "") if body.action in ("reject", "more_info", "suspend") else "",
    }
    if body.action == "renew":
        upd["reminders_sent"] = []
    await db.verification_submissions.update_one(
        {"id": sub_id},
        {"$set": upd, "$push": {"history": {"action": body.action, "by": user["id"], "note": body.note or "", "at": now_iso()}}},
    )
    await notify(sub["user_id"], f"verification_{body.action}", n_title, (body.note or n_body))
    return {"ok": True, "status": new_status}


# --------------------- Migration + Professional demo seed ---------------------
_LEGACY_CAT_MAP = {"Business": "Business Consulting", "HR": "HR", "Tech": "Technology", "Home": "Trades", "Car": "Automotive", "Fitness": "Fitness", "Other": "Other"}


async def migrate_opportunity_records():
    """One-time, reversible migration of legacy Opportunity vibes → Professional Mode.
    Original vibe_details are preserved untouched (plus migration markers)."""
    if await db.config.find_one({"key": "opportunity_migrated"}):
        return
    users = await db.users.find({"vibe": "opportunity"}).to_list(500)
    for u in users:
        vd = u.get("vibe_details") or {}
        otype = vd.get("opportunity_type")
        cat = _LEGACY_CAT_MAP.get(vd.get("category", "Other"), "Other")
        if otype in ("Need help", "Paid task"):
            if not await db.help_requests.find_one({"user_id": u["id"], "migrated_from": "opportunity"}):
                await db.help_requests.insert_one({
                    "id": str(uuid.uuid4()), "user_id": u["id"], "category": cat,
                    "public_summary": (vd.get("public_summary") or "")[:80],
                    "private_details": (vd.get("private_details") or "")[:300],
                    "payment": vd.get("payment") if vd.get("payment") in PRO_PAYMENTS else "Not sure",
                    "expiry": "24 hours", "expires_at": _hr_expires_at("24 hours"),
                    "availability": "", "status": "active", "migrated_from": "opportunity",
                    "created_at": now_iso(), "updated_at": now_iso(),
                })
        elif otype == "Can help":
            if not await db.professional_profiles.find_one({"user_id": u["id"]}):
                await db.professional_profiles.insert_one({
                    "user_id": u["id"], "profession": vd.get("public_summary", "")[:60] or cat,
                    "primary_category": cat, "additional_categories": [],
                    "about": vd.get("private_details", ""), "years_experience": 0,
                    "qualifications": "", "memberships": "", "licences": "", "certifications": "",
                    "specialties": [], "availability": "", "response_time": "", "rate": "", "rate_type": "",
                    "is_draft": True, "migrated_from": "opportunity", "created_at": now_iso(), "updated_at": now_iso(),
                })
        else:  # Selling something / Collaboration → archive, unsupported
            await db.users.update_one({"id": u["id"]}, {"$set": {"vibe_details.archived_unsupported": True}})
        await db.users.update_one({"id": u["id"]}, {"$set": {"vibe": "open_to_chat", "vibe_details.migrated_to_professional": True}})
    await db.config.insert_one({"key": "opportunity_migrated", "at": now_iso(), "migrated_users": len(users)})
    logger.info("Migrated %d legacy opportunity users to Professional Mode", len(users))


async def seed_professional_demo():
    """Idempotent Professional Mode demo data (test accounts)."""
    async def uid(email):
        u = await db.users.find_one({"email": email})
        return u["id"] if u else None
    priya, sana, dev, jade = [await uid(e) for e in ("priya@radar.intro.demo", "sana@radar.intro.demo", "dev@radar.intro.demo", "jade@radar.intro.demo")]
    if priya and not await db.help_requests.find_one({"user_id": priya, "status": {"$in": ["active", "paused"]}}):
        await db.help_requests.insert_one({
            "id": str(uuid.uuid4()), "user_id": priya, "category": "HR",
            "public_summary": "Need help with a staff performance issue",
            "private_details": "I run a small business and need practical HR help with a staff matter. Happy to discuss and pay for the right support.",
            "payment": "Open to paying", "expiry": "24 hours", "expires_at": _hr_expires_at("24 hours"),
            "availability": "Available today", "status": "active", "demo": True,
            "created_at": now_iso(), "updated_at": now_iso(),
        })
    await db.verification_submissions.delete_many({"demo": True, "profession": {"$exists": False}})
    pro_seed = [
        (sana, "HR Consultant", "HR", [], "12+ years in HR advisory for small businesses.", 12, "MBA (HR), CIPD Level 7", "AHRI member", ["Performance management", "Workplace disputes"], ("HR", ["Employee Relations", "Recruitment", "Performance"])),
        (dev, "Software Engineer", "Technology", [], "Full-stack developer helping local businesses with web and apps.", 8, "BSc Computer Science", "", ["Web apps", "Mobile apps"], ("IT", ["Web Development", "Mobile Apps"])),
        (jade, "Personal Trainer", "Fitness", [], "Run-club organiser and PT.", 4, "Cert IV Fitness", "", ["Running", "Strength"], None),
    ]
    for uid_, profession, cat, extra, about, yrs, quals, mems, specs, ver in pro_seed:
        if not uid_:
            continue
        if not await db.professional_profiles.find_one({"user_id": uid_}):
            await db.professional_profiles.insert_one({
                "user_id": uid_, "profession": profession, "primary_category": cat, "additional_categories": extra,
                "about": about, "years_experience": yrs, "qualifications": quals, "memberships": mems,
                "licences": "", "certifications": "", "specialties": specs, "availability": "Available now",
                "response_time": "Usually replies within 1 hour", "rate": "", "rate_type": "",
                "is_draft": ver is None, "demo": True, "created_at": now_iso(), "updated_at": now_iso(),
            })
        if ver and not await db.verification_submissions.find_one({"user_id": uid_, "status": "Approved"}):
            v_prof, v_cats = ver
            await db.verification_submissions.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid_,
                "profession": v_prof, "categories": v_cats, "category": PROFESSION_BROAD[v_prof],
                "identity": {"full_name": profession, "id_type": "Driver licence"},
                "documents": [{
                    "id": str(uuid.uuid4()), "doc_name": quals.split(",")[0].strip(), "issuer": "Issuing body",
                    "issue_date": "2019-03-01", "expiry_date": "2028-07-12", "doc_number": "DEMO-1234",
                    "notes": "", "file_name": "credential.pdf", "file_type": "application/pdf", "has_file": False,
                }],
                "status": "Approved", "submitted_at": now_iso(), "reviewed_at": now_iso(),
                "reviewer": "intro-admin", "notes": [], "public_note": "", "reminders_sent": [],
                "history": [{"action": "submitted", "by": uid_, "at": now_iso()}, {"action": "approve", "by": "intro-admin", "at": now_iso()}],
                "demo": True,
            })
    await db.users.update_one({"email": "priya@radar.intro.demo"}, {"$set": {"app_mode": "professional", "professional_role": "need_help"}})
    for e in ("sana@radar.intro.demo", "dev@radar.intro.demo", "jade@radar.intro.demo"):
        await db.users.update_one({"email": e}, {"$set": {"app_mode": "professional", "professional_role": "can_help"}})
    logger.info("Seeded professional demo data")
# ========================== END PROFESSIONAL MODE ==========================


# ===================== Full Demo Environment (demo_env) =====================
DEMO_ENV_VERSION = 3
DEMO_PERSONA_EMAIL = "demo@intro.demo"

# (radar_email_name, profession_title, profession_key, categories, state, docs)
# states: verified | expiring | pending | rejected | expired | draft
DEMO_ENV_PROS = [
    ("tom", "Accountant", "Accounting", ["Tax", "Bookkeeping", "BAS"], "verified", 1),
    ("grace", "Lawyer", "Law", ["Employment Law", "Commercial Law"], "verified", 3),
    ("oscar", "Marketing Consultant", "Marketing", ["Digital Marketing", "SEO", "Branding"], "verified", 1),
    ("lucas", "Business Consultant", "Business Consultant", ["Strategy", "Small Business"], "verified", 2),
    ("hugo", "Electrician", "Electrician", ["Residential Electrical", "Solar"], "expiring", 2),
    ("callum", "Plumber", "Plumber", ["General Plumbing", "Hot Water"], "expiring", 1),
    ("angus", "Mechanic", "Mechanic", ["Servicing", "Diagnostics"], "verified", 1),
    ("iris", "Photographer", "Photographer", ["Portraits", "Events"], "verified", 1),
    ("matilda", "Mortgage Broker", "Mortgage Broker", ["Home Loans", "Refinancing"], "verified", 1),
    ("pearl", "Property Manager", "Real Estate", ["Property Management", "Leasing"], "verified", 1),
    ("rory", "IT Consultant", "IT", ["IT Support", "Web Development"], "verified", 1),
    ("aria", "Graphic Designer", "Graphic Designer", ["Logos", "Branding"], "pending", 1),
    ("ezra", "Personal Trainer", "Fitness", ["Personal Training", "Strength"], "pending", 2),
    ("reuben", "Plumber", "Plumber", ["Drainage", "Gas Fitting"], "pending", 1),
    ("jasper", "Builder", "Builder", ["Renovations", "Carpentry"], "rejected", 1),
    ("sadie", "Marketing Consultant", "Marketing", ["Social Media", "Content"], "rejected", 1),
    ("felix", "Electrician", "Electrician", ["Commercial Electrical"], "expired", 1),
    ("bonnie", "Accountant", "Accounting", ["Payroll", "Tax"], "expired", 1),
    ("theo", "Business Consultant", "Business Consultant", ["Startups"], "draft", 0),
    ("luna", "Photographer", "Photographer", ["Weddings"], "draft", 0),
]

DEMO_ENV_REQUESTS = [
    ("maya", "Marketing", "Need a marketing strategy for my small retail brand", "Open to paying", "24 hours"),
    ("finn", "Business Consulting", "Need advice on pivoting my career into consulting", "Free advice", "24 hours"),
    ("ava", "Technology", "Need IT support — laptop keeps dropping WiFi", "Open to paying", "24 hours"),
    ("ruby", "Photography", "Need a photographer for a small product shoot", "Open to paying", "Today"),
    ("willow", "Plumbing", "Need a plumber — kitchen tap leaking badly", "Open to paying", "24 hours"),
    ("elsie", "Accounting", "Need tax advice before EOFY as a sole trader", "Open to paying", "24 hours"),
    ("poppy", "HR", "Need HR advice on managing a difficult resignation", "Free advice", "24 hours"),
    ("milo", "Automotive", "Need a mechanic — car making a rattling noise", "Open to paying", "24 hours"),
    ("daisy", "Fitness", "Need help building a beginner gym program", "Skill swap", "Today"),
    ("nora", "Legal", "Need quick legal advice on a rental bond dispute", "Not sure", "24 hours"),
    ("toby", "Electrical", "Need an electrician to install two ceiling fans", "Open to paying", "24 hours"),
    ("freya", "Finance", "Need help understanding my first home loan options", "Free advice", "Today"),
]


async def _demo_user_id(name: str) -> Optional[str]:
    u = await db.users.find_one({"email": f"{name}@radar.intro.demo"}) or await db.users.find_one({"email": f"{name}@intro.demo"})
    return u["id"] if u else None


def _demo_docs(profession: str, n: int, expiry: Optional[str]):
    templates = [
        ("Professional Licence", "State Licensing Board"),
        ("University Degree", "University of Melbourne"),
        ("Insurance Certificate", "AAMI Business Insurance"),
        ("Membership Certificate", "Industry Association"),
    ]
    docs = []
    for i in range(max(n, 1)):
        t, issuer = templates[i % len(templates)]
        docs.append({
            "id": str(uuid.uuid4()), "doc_name": f"{profession} — {t}", "issuer": issuer,
            "issue_date": "2021-05-10", "expiry_date": expiry if i == 0 else None,
            "doc_number": f"DEMO-{1000 + i}", "notes": "", "file_name": "credential.pdf",
            "file_type": "application/pdf", "has_file": False,
        })
    return docs


async def seed_demo_environment(force: bool = False):
    # verified pros keep a wide radius so they can see demo help requests around the city
    # (applied every startup because seed_demo_accounts resets radius)
    pro_emails = [f"{n}@radar.intro.demo" for n, *_ in DEMO_ENV_PROS] + ["sana@radar.intro.demo", "dev@radar.intro.demo", "jade@radar.intro.demo"]
    await db.users.update_many({"email": {"$in": pro_emails}}, {"$set": {"radius": 500}})
    meta = await db.meta.find_one({"key": "demo_env_version"})
    if not force and meta and meta.get("value") == DEMO_ENV_VERSION:
        return {"skipped": True}
    # ---- wipe previous demo-env + persona interaction data ----
    demo_ids = [u["id"] async for u in db.users.find({"is_demo": True}, {"id": 1})]
    persona = await db.users.find_one({"email": DEMO_PERSONA_EMAIL})
    pid = persona["id"] if persona else None
    await db.professional_profiles.delete_many({"demo_env": True})
    await db.verification_submissions.delete_many({"demo_env": True})
    await db.help_requests.delete_many({"demo_env": True})
    await db.notifications.delete_many({"demo_env": True})
    if pid:
        # restore persona-related dynamic records fully (demo-to-demo only)
        await db.pings.delete_many({"$or": [{"from_user_id": pid}, {"to_user_id": pid}]})
        await db.matches.delete_many({"$or": [{"user_a": pid}, {"user_b": pid}]})
        await db.blocks.delete_many({"$or": [{"blocker_id": pid}, {"blocked_id": pid}]})
        await db.hides.delete_many({"$or": [{"hider_id": pid}, {"hidden_id": pid}]})
        await db.notifications.delete_many({"user_id": pid})
        await db.help_requests.delete_many({"user_id": pid})

    # ---- 1. demo persona ----
    persona_doc = {
        "email": DEMO_PERSONA_EMAIL, "name": "Alex (Demo)", "age": 29, "vibe": "networking",
        "bio": "Demo explorer account — look around, everything here is seeded sample data.",
        "interests": ["Business", "Coffee", "Fitness", "Tech"],
        "photo_url": "https://randomuser.me/api/portraits/lego/1.jpg",
        "photos": ["https://randomuser.me/api/portraits/lego/1.jpg"],
        "demo_dist": 0, "demo_bearing": 0, "demo_minutes_ago": 1,
        "visible": True, "radius": 500, "ghost_mode": False, "paused": False, "quiet_mode": False,
        "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
        "visible_for": 60, "verified": True, "active_now": True, "is_demo": True, "demo_env": True,
        "trial_mode_active": False, "plan": "pro", "app_mode": "people", "professional_role": "need_help",
        "vibe_details": {"looking_for": ["Networking", "New friends"], "tags": ["Business", "Startups"], "visibility": "public"},
        "lat": None, "lng": None, "last_active": now_iso(),
    }
    if persona:
        await db.users.update_one({"id": pid}, {"$set": persona_doc})
    else:
        persona_doc.update({"id": str(uuid.uuid4()), "hashed_password": pwd_context.hash(DEMO_PASSWORD), "created_at": now_iso()})
        await db.users.insert_one(dict(persona_doc))
        pid = persona_doc["id"]

    # ---- 2. professionals in every verification state ----
    now = datetime.now(timezone.utc)
    for name, title, prof_key, cats, state, ndocs in DEMO_ENV_PROS:
        uid = await _demo_user_id(name)
        if not uid:
            continue
        await db.professional_profiles.update_one(
            {"user_id": uid},
            {"$set": {
                "user_id": uid, "profession": title, "primary_category": PROFESSION_BROAD.get(prof_key, "Other"),
                "additional_categories": [], "about": f"{title} helping locals with {', '.join(cats[:2]).lower()}.",
                "years_experience": 3 + (len(name) % 14), "qualifications": f"{title} qualification",
                "memberships": "Industry association" if state in ("verified", "expiring") else "",
                "licences": "", "certifications": "", "specialties": cats,
                "availability": "Available now" if len(name) % 2 == 0 else "Evenings and weekends",
                "response_time": "Usually replies within 1 hour" if len(name) % 2 == 0 else "Usually replies within a day",
                "rate": "$90/hr" if state in ("verified", "expiring") and len(name) % 2 == 0 else "",
                "rate_type": "Hourly" if state in ("verified", "expiring") and len(name) % 2 == 0 else "",
                "is_draft": state not in ("verified", "expiring"),
                "demo": True, "demo_env": True, "created_at": now_iso(), "updated_at": now_iso(),
            }}, upsert=True)
        if state == "draft":
            continue
        status = {"verified": "Approved", "expiring": "Approved", "pending": "Pending Review",
                  "rejected": "Rejected", "expired": "Expired"}[state]
        expiry = None
        if state == "verified":
            expiry = "2028-07-12"
        elif state == "expiring":
            expiry = (now + timedelta(days=45 if name == "hugo" else 25)).date().isoformat()
        elif state == "expired":
            expiry = (now - timedelta(days=10)).date().isoformat()
        history = [{"action": "submitted", "by": uid, "at": now_iso()}]
        if status == "Approved":
            history.append({"action": "approve", "by": "intro-admin", "at": now_iso()})
        elif status == "Rejected":
            history.append({"action": "reject", "by": "intro-admin", "note": "Document unreadable — please re-upload.", "at": now_iso()})
        elif status == "Expired":
            history += [{"action": "approve", "by": "intro-admin", "at": now_iso()}, {"action": "auto-expired", "by": "system", "at": now_iso()}]
        await db.verification_submissions.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "profession": prof_key, "categories": cats,
            "category": PROFESSION_BROAD.get(prof_key, "Other"),
            "identity": {"full_name": name.capitalize(), "id_type": "Driver licence"},
            "documents": _demo_docs(title, ndocs, expiry),
            "status": status, "submitted_at": now_iso(),
            "reviewed_at": now_iso() if status in ("Approved", "Rejected", "Expired") else None,
            "reviewer": "intro-admin" if status != "Pending Review" else None,
            "public_note": "Document unreadable — please re-upload." if status == "Rejected" else "",
            "notes": [], "reminders_sent": [90] if state == "expiring" and name == "hugo" else [],
            "history": history, "demo": True, "demo_env": True,
        })

    # ---- 3. help requests ----
    for name, cat, summary, payment, expiry in DEMO_ENV_REQUESTS:
        uid = await _demo_user_id(name)
        if not uid or await db.help_requests.find_one({"user_id": uid, "status": {"$in": ["active", "paused"]}}):
            continue
        await db.help_requests.insert_one({
            "id": str(uuid.uuid4()), "user_id": uid, "category": cat, "public_summary": summary,
            "private_details": f"More context: {summary.lower()}. Happy to share specifics once connected.",
            "payment": payment, "expiry": expiry,
            "expires_at": _hr_expires_at(expiry),
            "availability": "Available today", "status": "active",
            "demo": True, "demo_env": True, "created_at": now_iso(), "updated_at": now_iso(),
        })
    # one expired + one paused example
    for name, cat, summary, status_x, delta in [
        ("arlo", "HR", "Need help drafting a workplace policy", "paused", timedelta(hours=20)),
        ("pearl", "Marketing", "Needed flyers designed for open homes", "expired", timedelta(hours=-2)),
    ]:
        uid = await _demo_user_id(name)
        if uid and not await db.help_requests.find_one({"user_id": uid}):
            await db.help_requests.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "category": cat, "public_summary": summary,
                "private_details": "Sample private details.", "payment": "Not sure", "expiry": "24 hours",
                "expires_at": (now + delta).isoformat(), "availability": "", "status": status_x,
                "demo": True, "demo_env": True, "created_at": now_iso(), "updated_at": now_iso(),
            })

    # ---- 4. persona connections / pings ----
    async def mk_ping(from_name, to_id, status, about="connect", hr_id=None, hours=24, minutes_old=30):
        fid = await _demo_user_id(from_name)
        if not fid:
            return None
        ping = {
            "id": str(uuid.uuid4()), "kind": "request", "about": about, "help_request_id": hr_id,
            "from_user_id": fid, "to_user_id": to_id, "vibe": "open_to_chat", "status": status,
            "distance_meters": 40 + (len(from_name) * 17) % 400,
            "created_at": (now - timedelta(minutes=minutes_old)).isoformat(),
            "expires_at": (now + timedelta(hours=hours)).isoformat(),
        }
        await db.pings.insert_one(dict(ping))
        return ping

    connections = ["maya", "tom", "grace", "ava", "ruby", "sophie", "jake", "mia", "olivia", "james", "willow", "hugo"]
    for i, name in enumerate(connections):
        uid = await _demo_user_id(name)
        if not uid:
            continue
        await db.matches.insert_one({
            "id": str(uuid.uuid4()), "user_a": pid, "user_b": uid,
            "accepted_a": True, "accepted_b": True, "active": True,
            "created_at": (now - timedelta(days=i, hours=3)).isoformat(),
        })
        if i < 6:
            await mk_ping(name, pid, "accepted", minutes_old=60 * 24 * i + 90)
    for name in ["finn", "aria", "lucas", "daisy", "felix"]:            # 5 pending incoming
        await mk_ping(name, pid, "new", minutes_old=15)
    for name in ["poppy", "arlo"]:                                       # declined
        await mk_ping(name, pid, "declined", minutes_old=60 * 30)
    await mk_ping("nora", pid, "new", hours=-2, minutes_old=60 * 30)     # expired pending
    theo_id = await _demo_user_id("theo")                                 # persona's outgoing declined
    if theo_id:
        await db.pings.insert_one({
            "id": str(uuid.uuid4()), "kind": "request", "about": "connect", "help_request_id": None,
            "from_user_id": pid, "to_user_id": theo_id, "vibe": "networking", "status": "declined",
            "distance_meters": 260, "created_at": (now - timedelta(days=2)).isoformat(),
            "expires_at": (now - timedelta(days=1)).isoformat(),
        })
    marco_id = await _demo_user_id("marco")                               # blocked user example
    if marco_id:
        await db.blocks.insert_one({"id": str(uuid.uuid4()), "blocker_id": pid, "blocked_id": marco_id, "created_at": now_iso()})

    # ---- 5. persona professional flow: own Need Help request with offers ----
    hr_id = str(uuid.uuid4())
    await db.help_requests.insert_one({
        "id": hr_id, "user_id": pid, "category": "Technology",
        "public_summary": "Need IT support with my laptop and email setup",
        "private_details": "Laptop is slow and Outlook won't sync on my new phone. Can meet at a cafe nearby.",
        "payment": "Open to paying", "expiry": "24 hours",
        "expires_at": (now + timedelta(hours=72)).isoformat(), "availability": "Available today",
        "status": "active", "demo": True, "demo_env": True, "created_at": now_iso(), "updated_at": now_iso(),
    })
    dev_id = await _demo_user_id("dev")
    if dev_id:                                                            # accepted offer -> private unlocked
        await mk_ping("dev", pid, "accepted", about="help_offer", hr_id=hr_id, minutes_old=120)
        await db.matches.insert_one({
            "id": str(uuid.uuid4()), "user_a": pid, "user_b": dev_id,
            "accepted_a": True, "accepted_b": True, "active": True, "created_at": now_iso(),
        })
    await mk_ping("rory", pid, "new", about="help_offer", hr_id=hr_id, minutes_old=25)   # pending offer
    await mk_ping("felix", pid, "declined", about="help_offer", hr_id=hr_id, minutes_old=300)  # declined offer

    # ---- 6. notifications for persona ----
    for i, (ntype, title, body_text) in enumerate([
        ("connection_request", "New connection request", "Finn nearby wants to connect with you."),
        ("offer_accepted", "Offer accepted", "You and Dev are now connected about your IT request."),
        ("offer_declined", "Offer declined", "An offer on your request was declined."),
        ("verification_approve", "Verification approved", "Sample: a professional you follow was verified."),
        ("verification_expiring_90", "Credentials expiring soon", "Sample: a credential expires in 90 days."),
        ("need_help_nearby", "Need Help nearby", "Someone 300m away needs IT support."),
    ]):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": pid, "type": ntype, "title": title, "body": body_text,
            "read": i > 2, "created_at": (now - timedelta(hours=i * 5)).isoformat(), "demo_env": True,
        })

    await db.meta.update_one({"key": "demo_env_version"}, {"$set": {"value": DEMO_ENV_VERSION, "seeded_at": now_iso()}}, upsert=True)
    counts = {
        "people": len(demo_ids),
        "professionals": await db.professional_profiles.count_documents({"demo": True}),
        "help_requests": await db.help_requests.count_documents({"demo": True, "status": "active"}),
        "connections": await db.matches.count_documents({"$or": [{"user_a": pid}, {"user_b": pid}]}),
        "pending_requests": await db.pings.count_documents({"to_user_id": pid, "status": "new"}),
        "verifications": await db.verification_submissions.count_documents({"demo": True}),
        "notifications": await db.notifications.count_documents({"user_id": pid}),
    }
    logger.info("Seeded demo environment v%s: %s", DEMO_ENV_VERSION, counts)
    return counts


@api_router.post("/demo/reset")
async def reset_demo(user: dict = Depends(get_current_user)):
    """Restore all demo accounts and data to the original seeded state. Demo accounts only."""
    if not user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Demo mode only")
    await db.verification_submissions.delete_many({"demo": True})
    await db.help_requests.delete_many({"demo": True})
    await seed_demo_accounts()
    counts = await seed_demo_environment(force=True)
    return {"ok": True, "counts": counts}




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
            "visible": True,
            "radius": {"kauri@intro.demo": 500}.get(acc["email"], 50),
            "ghost_mode": False, "paused": False, "quiet_mode": False,
            "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
            "visible_for": 30, "verified": acc["verified"], "active_now": True, "is_demo": True,
            "trial_mode_active": False,
            "vibe_details": DEMO_VIBE_DETAILS.get(acc["email"], {}),
            "plan": {"kauri@intro.demo": "pro", "james@intro.demo": "plus", "olivia@intro.demo": "pro", "mia@intro.demo": "plus", "ryan@intro.demo": "pro", "emily@intro.demo": "plus"}.get(acc["email"], "free"),
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
    # extra Melbourne radar demo people (Pro 500m demo state)
    for i, (name, age, vibe, dist, brg, portrait, bio) in enumerate(RADAR_DEMO_USERS):
        email = f"{name.lower()}@radar.intro.demo"
        doc = {
            "email": email, "name": name, "age": age, "vibe": vibe,
            "bio": bio, "interests": ["Coffee", "Melbourne"],
            "photo_url": f"https://randomuser.me/api/portraits/{portrait}.jpg",
            "photos": [
                f"https://randomuser.me/api/portraits/{portrait}.jpg",
                f"https://picsum.photos/seed/{email}-a/400/400",
                f"https://picsum.photos/seed/{email}-b/400/400",
            ],
            "demo_dist": dist, "demo_bearing": brg, "demo_minutes_ago": 5 + i * 3,
            "visible": True, "radius": 100, "ghost_mode": False, "paused": False, "quiet_mode": False,
            "only_same_vibe": False, "verified_only": False, "who_can_see": "everyone",
            "visible_for": 60, "verified": i % 3 == 0, "active_now": i % 4 != 3, "is_demo": True,
            "trial_mode_active": False, "plan": "free",
            "vibe_details": RADAR_DEMO_DETAILS.get(email, {}),
            "lat": None, "lng": None, "last_active": now_iso(),
        }
        existing = await db.users.find_one({"email": email})
        if existing:
            await db.users.update_one({"email": email}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["hashed_password"] = pwd_context.hash(DEMO_PASSWORD)
            doc["created_at"] = now_iso()
            await db.users.insert_one(doc)
    # remove stale radar demo users from older seeds
    valid_emails = [f"{u[0].lower()}@radar.intro.demo" for u in RADAR_DEMO_USERS]
    await db.users.delete_many({"email": {"$regex": "@radar\\.intro\\.demo$", "$nin": valid_emails}})
    logger.info("Seeded %d radar demo users", len(RADAR_DEMO_USERS))
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
    await migrate_opportunity_records()
    await seed_professional_demo()
    await seed_demo_environment()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

"""Orrbbit Events — People Mode location-based events + radar hotspots.

Same bind pattern as professional_flow.py. Privacy: exact event coordinates are
NEVER returned to clients — only quantized approximate distance/bearing and the
host-chosen display label. Discovery is geographically bounded to the viewer's
area (events are radius-scoped, hard-capped at 1 km, matching radar rules).
"""
import uuid
import os
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from email_service import fire as _email_fire

events_router = APIRouter(prefix="/api/events")

# timezone used for event dates/times in emails (app audience default; override via env)
EVENT_TZ = ZoneInfo(os.environ.get("EVENT_EMAIL_TZ", "Australia/Melbourne"))

EVENT_CATEGORIES = ["Coffee / Drinks", "Fitness", "Walking / Running", "Sport", "Social",
                    "Networking", "Study", "Food", "Games", "Outdoor", "Community",
                    "Music", "Wellness", "Gaming", "Entertainment", "Other"]
EVENT_RADII = [250, 500, 750, 1000]
EVENT_REPORT_REASONS = ["Unsafe activity", "Harassment", "Spam", "Misleading event",
                        "Inappropriate content", "Illegal activity", "Other"]


class EventIn(BaseModel):
    title: str
    description: str = ""
    category: str
    lat: float
    lng: float
    location_display: str = ""          # e.g. "Fed Square" or "Carlton area"
    location_privacy_type: str = "area"  # area | venue
    visibility_radius: int = 500
    start_datetime: str                  # ISO
    end_datetime: str                    # ISO
    capacity: Optional[int] = None       # None = unlimited
    join_type: str = "everyone"          # everyone | approval
    cover_image: Optional[str] = None


class EventReportIn(BaseModel):
    reason: str
    details: Optional[str] = ""


def bind(server):
    db = server.db
    get_current_user = server.get_current_user
    notify = server.notify
    get_blocked_ids = server.get_blocked_ids
    haversine = server.haversine
    bearing_between = server.bearing_between
    now_iso = server.now_iso

    def _now():
        return datetime.now(timezone.utc).isoformat()

    async def _lazy_complete(ev: dict) -> dict:
        """Events auto-stop appearing after they end; history kept (never deleted)."""
        if ev.get("status") == "active" and (ev.get("end_datetime") or "") < _now():
            await db.events.update_one({"id": ev["id"]}, {"$set": {"status": "completed", "updated_at": now_iso()}})
            ev["status"] = "completed"
        return ev

    async def _going(event_id: str) -> int:
        return await db.event_attendees.count_documents({"event_id": event_id, "join_status": "accepted"})

    async def _payload(ev: dict, viewer: dict, going: Optional[int] = None) -> dict:
        """Client-safe event payload — NEVER includes lat/lng."""
        going = going if going is not None else await _going(ev["id"])
        host = await db.users.find_one({"id": ev["creator_user_id"]}, {"_id": 0, "name": 1, "photo_url": 1, "verified": 1, "id": 1})
        vlat = viewer.get("lat") if viewer.get("lat") is not None else -37.8136
        vlng = viewer.get("lng") if viewer.get("lng") is not None else 144.9631
        dist = max(round(haversine(vlat, vlng, ev["lat"], ev["lng"]) / 10) * 10, 10)
        brg = (round(bearing_between(vlat, vlng, ev["lat"], ev["lng"]) / 10) * 10) % 360
        me = await db.event_attendees.find_one({"event_id": ev["id"], "user_id": viewer["id"]})
        cap = ev.get("capacity")
        return {
            "id": ev["id"], "title": ev["title"], "description": ev.get("description", ""),
            "category": ev["category"], "cover_image": ev.get("cover_image"),
            "location_display": ev.get("location_display") or "Approximate area shown on radar",
            "location_privacy_type": ev.get("location_privacy_type", "area"),
            "visibility_radius": ev.get("visibility_radius", 500),
            "start_datetime": ev["start_datetime"], "end_datetime": ev["end_datetime"],
            "timezone": ev.get("timezone", "local"),
            "capacity": cap, "join_type": ev.get("join_type", "everyone"),
            "status": ev.get("status", "active"),
            "going": going,
            "spots_left": (max(cap - going, 0) if cap else None),
            "distance": round(dist), "bearing": round(brg),
            "host": {"id": (host or {}).get("id"), "name": (host or {}).get("name") or "Orrbbit member",
                     "photo_url": (host or {}).get("photo_url"), "verified": bool((host or {}).get("verified"))},
            "is_host": ev["creator_user_id"] == viewer["id"],
            "my_status": (me or {}).get("join_status"),
        }

    @events_router.get("/nearby")
    async def nearby_events(lat: float = Query(...), lng: float = Query(...),
                            category: Optional[str] = None,
                            user: dict = Depends(get_current_user)):
        """Radar hotspots — geographically bounded, active-only, privacy-safe."""
        blocked = await get_blocked_ids(user["id"])
        q = {"status": {"$in": ["active", "full"]}}
        if category and category != "All Events":
            q["category"] = category
        rows = await db.events.find(q, {"_id": 0}).to_list(300)
        out = []
        for ev in rows:
            ev = await _lazy_complete(ev)
            if ev["status"] not in ("active", "full"):
                continue
            if ev["creator_user_id"] in blocked:
                continue
            dist = haversine(lat, lng, ev["lat"], ev["lng"])
            # event visible only inside ITS visibility radius, hard-capped at 1 km
            if dist > min(ev.get("visibility_radius", 500), 1000):
                continue
            going = await _going(ev["id"])
            cap = ev.get("capacity")
            if cap and going >= cap and ev["status"] == "active":
                await db.events.update_one({"id": ev["id"]}, {"$set": {"status": "full"}})
                ev["status"] = "full"
            out.append(await _payload(ev, user, going))
        out.sort(key=lambda e: (-e["going"], e["distance"]))
        return {"events": out[:30], "categories": EVENT_CATEGORIES}

    @events_router.post("")
    async def create_event(body: EventIn, user: dict = Depends(get_current_user)):
        if not body.title.strip():
            raise HTTPException(status_code=400, detail="Event name is required")
        if body.category not in EVENT_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        if body.join_type not in ("everyone", "approval"):
            raise HTTPException(status_code=400, detail="Invalid join type")
        if body.end_datetime <= body.start_datetime:
            raise HTTPException(status_code=400, detail="End time must be after start time")
        radius = body.visibility_radius if body.visibility_radius in EVENT_RADII else 500
        ev = {
            "id": str(uuid.uuid4()), "creator_user_id": user["id"],
            "title": body.title.strip()[:60], "description": (body.description or "").strip()[:400],
            "category": body.category, "cover_image": body.cover_image,
            "lat": body.lat, "lng": body.lng,
            "location_display": (body.location_display or "").strip()[:60],
            "location_privacy_type": body.location_privacy_type if body.location_privacy_type in ("area", "venue") else "area",
            "visibility_radius": radius, "timezone": "local",
            "start_datetime": body.start_datetime, "end_datetime": body.end_datetime,
            "capacity": (max(1, min(int(body.capacity), 500)) if body.capacity else None),
            "join_type": body.join_type, "status": "active",
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.events.insert_one(dict(ev))
        return await _payload(ev, user, 0)

    @events_router.get("/mine")
    async def my_events(user: dict = Depends(get_current_user)):
        hosting = await db.events.find({"creator_user_id": user["id"]}, {"_id": 0}).to_list(100)
        joins = await db.event_attendees.find({"user_id": user["id"], "join_status": {"$in": ["accepted", "pending"]}}).to_list(200)
        joined_ids = [j["event_id"] for j in joins]
        joined = await db.events.find({"id": {"$in": joined_ids}}, {"_id": 0}).to_list(200)
        out = {"hosting": [], "joined": [], "past": []}
        for ev in hosting + joined:
            ev = await _lazy_complete(ev)
            p = await _payload(ev, user)
            if ev["status"] in ("completed", "cancelled"):
                out["past"].append(p)
            elif ev["creator_user_id"] == user["id"]:
                out["hosting"].append(p)
            else:
                out["joined"].append(p)
        for k in out:
            out[k].sort(key=lambda e: e["start_datetime"])
        return out

    @events_router.get("/{event_id}")
    async def event_detail(event_id: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id}, {"_id": 0})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        return await _payload(await _lazy_complete(ev), user)

    @events_router.put("/{event_id}")
    async def edit_event(event_id: str, body: EventIn, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev or ev["creator_user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the host can edit this event")
        if ev["status"] in ("cancelled", "completed"):
            raise HTTPException(status_code=400, detail="This event can no longer be edited")
        upd = {"title": body.title.strip()[:60], "description": (body.description or "").strip()[:400],
               "category": body.category if body.category in EVENT_CATEGORIES else ev["category"],
               "location_display": (body.location_display or "").strip()[:60],
               "visibility_radius": body.visibility_radius if body.visibility_radius in EVENT_RADII else ev["visibility_radius"],
               "start_datetime": body.start_datetime, "end_datetime": body.end_datetime,
               "capacity": (max(1, min(int(body.capacity), 500)) if body.capacity else None),
               "join_type": body.join_type if body.join_type in ("everyone", "approval") else ev["join_type"],
               "cover_image": body.cover_image,
               "updated_at": now_iso()}
        await db.events.update_one({"id": event_id}, {"$set": upd})
        # notify accepted attendees about the update
        atts = await db.event_attendees.find({"event_id": event_id, "join_status": "accepted"}).to_list(500)
        for a in atts:
            await notify(a["user_id"], "event_updated", "Event updated",
                         f"The host updated \"{upd['title']}\". Check the latest details.", meta={"event_id": event_id})
        return await _payload({**ev, **upd}, user)

    @events_router.post("/{event_id}/cancel")
    async def cancel_event(event_id: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev or ev["creator_user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the host can cancel this event")
        # idempotent: atomic status flip — a second trigger never re-notifies or re-emails
        r = await db.events.update_one(
            {"id": event_id, "status": {"$ne": "cancelled"}},
            {"$set": {"status": "cancelled", "cancelled_at": now_iso(),
                      "cancelled_by": user["id"], "updated_at": now_iso()}})
        if r.modified_count == 0:
            return {"ok": True, "status": "cancelled"}
        # never silently delete — notify + email every confirmed attendee
        atts = await db.event_attendees.find({"event_id": event_id, "join_status": "accepted"}).to_list(500)
        svc = getattr(server, "email_service", None)
        try:
            st = datetime.fromisoformat(ev["start_datetime"].replace("Z", "+00:00")).astimezone(EVENT_TZ)
            en = datetime.fromisoformat(ev["end_datetime"].replace("Z", "+00:00")).astimezone(EVENT_TZ)
            ev_date = st.strftime("%A, %d %B %Y")
            ev_time = f"{st.strftime('%-I:%M %p')} → {en.strftime('%-I:%M %p')}"
        except (ValueError, KeyError):
            ev_date, ev_time = ev.get("start_datetime", ""), ""
        loc = (ev.get("location_display") or "").strip()
        for a in atts:
            await notify(a["user_id"], "event_cancelled", "Event cancelled",
                         f"\"{ev['title']}\" has been cancelled by the host.", meta={"event_id": event_id})
            if svc:
                u = await db.users.find_one({"id": a["user_id"]})
                if u:
                    # fire-and-forget: email failures are logged in email_events and never re-activate the event
                    _email_fire(svc.send("event_cancelled", user=u, entity_id=event_id,
                                         ctx={"event_title": ev["title"], "event_date": ev_date,
                                              "event_time": ev_time,
                                              "location_part": f"<br><b>Location:</b> {loc}" if loc else ""}))
        # record in the existing admin audit system (host-initiated action)
        await db.admin_audit_logs.insert_one({
            "id": str(uuid.uuid4()), "admin_id": None, "admin_email": f"host:{user['id']}",
            "action": "event_cancelled", "target_type": "event", "target_id": event_id,
            "old_value": {"status": ev["status"]},
            "new_value": {"cancelled_by": user["id"], "cancelled_at": now_iso(),
                          "attendees_affected": len(atts), "notifications_sent": len(atts),
                          "emails_queued": len(atts) if svc else 0},
            "ip": None, "mode": "demo" if user.get("is_demo") else "live", "at": now_iso(),
        })
        return {"ok": True, "status": "cancelled"}

    @events_router.post("/{event_id}/join")
    async def join_event(event_id: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        ev = await _lazy_complete(ev)
        if ev["status"] in ("cancelled", "completed"):
            raise HTTPException(status_code=400, detail="This event is no longer open")
        if ev["creator_user_id"] == user["id"]:
            raise HTTPException(status_code=400, detail="You're hosting this event")
        blocked = await get_blocked_ids(user["id"])
        if ev["creator_user_id"] in blocked:
            raise HTTPException(status_code=403, detail="This event isn't available")
        existing = await db.event_attendees.find_one({"event_id": event_id, "user_id": user["id"]})
        if existing and existing["join_status"] in ("accepted", "pending"):
            return {"ok": True, "join_status": existing["join_status"]}  # idempotent double-tap
        going = await _going(event_id)
        if ev.get("capacity") and going >= ev["capacity"]:
            raise HTTPException(status_code=409, detail="This event is full")
        status = "pending" if ev.get("join_type") == "approval" else "accepted"
        rec = {"id": str(uuid.uuid4()), "event_id": event_id, "user_id": user["id"],
               "join_status": status, "joined_at": now_iso()}
        if existing:
            await db.event_attendees.update_one({"id": existing["id"]}, {"$set": {"join_status": status, "joined_at": now_iso()}})
        else:
            await db.event_attendees.insert_one(dict(rec))
        if status == "pending":
            await notify(ev["creator_user_id"], "event_join_request", "Join request",
                         f"{user.get('name') or 'Someone'} wants to join \"{ev['title']}\".", meta={"event_id": event_id})
        else:
            await notify(ev["creator_user_id"], "event_joined", "New attendee",
                         f"{user.get('name') or 'Someone'} joined \"{ev['title']}\".", meta={"event_id": event_id})
            cap = ev.get("capacity")
            if cap and going + 1 >= cap:
                await db.events.update_one({"id": event_id}, {"$set": {"status": "full"}})
                await notify(ev["creator_user_id"], "event_full", "Your event is now full", f"\"{ev['title']}\" has reached capacity.", meta={"event_id": event_id})
            elif cap and going + 1 >= cap - 1:
                await notify(ev["creator_user_id"], "event_almost_full", "Your event is almost full",
                             f"\"{ev['title']}\" — {going + 1} of {cap} spots filled.", meta={"event_id": event_id})
        return {"ok": True, "join_status": status}

    @events_router.post("/{event_id}/leave")
    async def leave_event(event_id: str, user: dict = Depends(get_current_user)):
        r = await db.event_attendees.update_many(
            {"event_id": event_id, "user_id": user["id"], "join_status": {"$in": ["accepted", "pending"]}},
            {"$set": {"join_status": "cancelled"}})
        ev = await db.events.find_one({"id": event_id})
        if ev and r.modified_count:
            await notify(ev["creator_user_id"], "event_left", "Attendance cancelled",
                         f"{user.get('name') or 'Someone'} cancelled their attendance to \"{ev['title']}\".", meta={"event_id": event_id})
        if ev and ev.get("status") == "full":
            await db.events.update_one({"id": event_id}, {"$set": {"status": "active"}})
        return {"ok": True}

    @events_router.get("/{event_id}/attendees")
    async def attendees(event_id: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        is_host = ev["creator_user_id"] == user["id"]
        statuses = ["accepted", "pending"] if is_host else ["accepted"]
        rows = await db.event_attendees.find({"event_id": event_id, "join_status": {"$in": statuses}}).to_list(500)
        out = []
        for a in rows:
            u = await db.users.find_one({"id": a["user_id"]}, {"_id": 0, "id": 1, "name": 1, "photo_url": 1, "vibe": 1, "date_of_birth": 1})
            if not u:
                continue  # deleted user — skip safely
            out.append({"id": u["id"], "name": u.get("name"), "photo_url": u.get("photo_url"),
                        "vibe": u.get("vibe"), "age": server.user_age(u),
                        "join_status": a["join_status"]})
        return {"attendees": out, "is_host": is_host}

    @events_router.post("/{event_id}/requests/{attendee_id}/{action}")
    async def manage_request(event_id: str, attendee_id: str, action: str, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev or ev["creator_user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Only the host can manage attendees")
        if action not in ("accept", "decline", "remove"):
            raise HTTPException(status_code=400, detail="Invalid action")
        new_status = {"accept": "accepted", "decline": "declined", "remove": "removed"}[action]
        r = await db.event_attendees.update_one(
            {"event_id": event_id, "user_id": attendee_id, "join_status": {"$in": ["pending", "accepted"]}},
            {"$set": {"join_status": new_status}})
        if r.modified_count and action == "accept":
            await notify(attendee_id, "event_accepted", "You're in 🎉", f"Your request to join \"{ev['title']}\" was accepted.", meta={"event_id": event_id})
        elif r.modified_count and action == "decline":
            await notify(attendee_id, "event_declined", "Request update",
                         f"Your request to join \"{ev['title']}\" wasn't accepted this time.", meta={"event_id": event_id})
        return {"ok": True, "join_status": new_status}

    @events_router.post("/{event_id}/report")
    async def report_event(event_id: str, body: EventReportIn, user: dict = Depends(get_current_user)):
        ev = await db.events.find_one({"id": event_id})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        # reuse existing moderation infrastructure — event reports land in db.reports
        await db.reports.insert_one({
            "id": str(uuid.uuid4()), "reporter_id": user["id"], "reported_id": ev["creator_user_id"],
            "kind": "event", "event_id": event_id, "event_title": ev["title"],
            "reason": body.reason if body.reason in EVENT_REPORT_REASONS else "Other",
            "details": (body.details or "")[:500], "risk": "medium", "status": "New",
            "created_at": now_iso(),
        })
        return {"ok": True}

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="MamieSafe API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Contact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    relation: str = ""
    primary: bool = False


class Config(BaseModel):
    id: str = "household"
    mamie_name: str = "Mamie"
    emergency_number: str = "112"
    contacts: List[Contact] = Field(default_factory=list)
    fall_sensitivity: Literal["basse", "moyenne", "haute"] = "moyenne"
    checkin_interval_hours: int = 4
    dashboard_pin: str = "1234"
    updated_at: str = Field(default_factory=now_iso)


class ConfigUpdate(BaseModel):
    mamie_name: Optional[str] = None
    emergency_number: Optional[str] = None
    contacts: Optional[List[Contact]] = None
    fall_sensitivity: Optional[Literal["basse", "moyenne", "haute"]] = None
    checkin_interval_hours: Optional[int] = None
    dashboard_pin: Optional[str] = None


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["bedtime", "wakeup", "checkin", "sos", "fall", "voice"]
    note: str = ""
    created_at: str = Field(default_factory=now_iso)


class EventCreate(BaseModel):
    type: Literal["bedtime", "wakeup", "checkin", "sos", "fall", "voice"]
    note: str = ""


class Alert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: Literal["fall", "sos", "noise", "missed_checkin", "voice"]
    severity: Literal["leger", "moyen", "dangereux"]
    message: str = ""
    status: Literal["pending", "validated", "dismissed"] = "pending"
    created_at: str = Field(default_factory=now_iso)
    resolved_at: Optional[str] = None


class AlertCreate(BaseModel):
    kind: Literal["fall", "sos", "noise", "missed_checkin", "voice"]
    severity: Literal["leger", "moyen", "dangereux"]
    message: str = ""


class AlertUpdate(BaseModel):
    status: Literal["validated", "dismissed"]


class LocationPoint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lat: float
    lng: float
    accuracy: Optional[float] = None
    created_at: str = Field(default_factory=now_iso)


class LocationCreate(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None


class Heartbeat(BaseModel):
    id: str = "device"
    online: bool = True
    battery: Optional[float] = None
    fall_active: bool = False
    listening: bool = False
    updated_at: str = Field(default_factory=now_iso)


class HeartbeatCreate(BaseModel):
    battery: Optional[float] = None
    fall_active: bool = False
    listening: bool = False


class PushToken(BaseModel):
    token: str
    role: Literal["mamie", "dashboard"] = "dashboard"


# ---------------------------------------------------------------------------
# Push (Expo push service, driven from Python — works in production builds)
# ---------------------------------------------------------------------------
def _send_expo_push(tokens: List[str], title: str, body: str, data: dict):
    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "data": data,
        }
        for t in tokens
        if isinstance(t, str) and t.startswith("ExponentPushToken")
    ]
    if not messages:
        return
    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"push failed: {e}")


async def notify_dashboard(title: str, body: str, data: dict):
    docs = await db.push_tokens.find({"role": "dashboard"}).to_list(50)
    tokens = [d["token"] for d in docs]
    await asyncio.to_thread(_send_expo_push, tokens, title, body, data)


async def get_config_doc() -> dict:
    doc = await db.config.find_one({"id": "household"})
    if not doc:
        cfg = Config()
        await db.config.insert_one(cfg.dict())
        return cfg.dict()
    return doc


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "MamieSafe API", "status": "ok"}


@api_router.get("/config", response_model=Config)
async def get_config():
    doc = await get_config_doc()
    return Config(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.put("/config", response_model=Config)
async def update_config(payload: ConfigUpdate):
    await get_config_doc()
    updates = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if "contacts" in updates:
        updates["contacts"] = [
            c if isinstance(c, dict) else c.dict() for c in updates["contacts"]
        ]
    updates["updated_at"] = now_iso()
    await db.config.update_one({"id": "household"}, {"$set": updates})
    doc = await get_config_doc()
    return Config(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.post("/events", response_model=Event)
async def create_event(payload: EventCreate):
    ev = Event(**payload.dict())
    await db.events.insert_one(ev.dict())
    labels = {
        "bedtime": "🌙 Mamie s'est couchée",
        "wakeup": "☀️ Mamie est réveillée",
        "checkin": "✅ Mamie va bien",
        "sos": "🆘 SOS déclenché par Mamie",
        "fall": "⚠️ Chute possible détectée",
        "voice": "🎤 Commande vocale",
    }
    title = labels.get(ev.type, "Événement")
    await notify_dashboard(title, ev.note or "Nouvel événement", {"type": ev.type})
    return ev


@api_router.get("/events", response_model=List[Event])
async def get_events(limit: int = 50):
    docs = await db.events.find().sort("created_at", -1).to_list(limit)
    return [Event(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.post("/alerts", response_model=Alert)
async def create_alert(payload: AlertCreate):
    al = Alert(**payload.dict())
    await db.alerts.insert_one(al.dict())
    title = {
        "fall": "⚠️ Chute possible",
        "sos": "🆘 SOS !",
        "noise": "🔊 Bruit suspect",
        "missed_checkin": "⏰ Check-in manqué",
        "voice": "🎤 Appel à l'aide vocal",
    }.get(al.kind, "Alerte")
    await notify_dashboard(title, al.message or "Vérifiez Mamie", {"alertId": al.id, "severity": al.severity})
    return al


@api_router.get("/alerts", response_model=List[Alert])
async def get_alerts(limit: int = 100, status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    docs = await db.alerts.find(q).sort("created_at", -1).to_list(limit)
    return [Alert(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.patch("/alerts/{alert_id}", response_model=Alert)
async def update_alert(alert_id: str, payload: AlertUpdate):
    doc = await db.alerts.find_one({"id": alert_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Alerte introuvable")
    await db.alerts.update_one(
        {"id": alert_id},
        {"$set": {"status": payload.status, "resolved_at": now_iso()}},
    )
    doc = await db.alerts.find_one({"id": alert_id})
    return Alert(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.post("/location", response_model=LocationPoint)
async def post_location(payload: LocationCreate):
    lp = LocationPoint(**payload.dict())
    await db.locations.insert_one(lp.dict())
    return lp


@api_router.get("/location/latest")
async def latest_location():
    doc = await db.locations.find().sort("created_at", -1).to_list(1)
    if not doc:
        return {"lat": None, "lng": None, "accuracy": None, "created_at": None}
    d = doc[0]
    return LocationPoint(**{k: v for k, v in d.items() if k != "_id"})


@api_router.post("/heartbeat", response_model=Heartbeat)
async def post_heartbeat(payload: HeartbeatCreate):
    hb = Heartbeat(**payload.dict())
    hb.updated_at = now_iso()
    await db.heartbeats.update_one({"id": "device"}, {"$set": hb.dict()}, upsert=True)
    return hb


@api_router.get("/status")
async def get_status():
    doc = await db.heartbeats.find_one({"id": "device"})
    if not doc:
        return Heartbeat(online=False).dict()
    return Heartbeat(**{k: v for k, v in doc.items() if k != "_id"}).dict()


@api_router.post("/push/register")
async def register_push(payload: PushToken):
    await db.push_tokens.update_one(
        {"token": payload.token},
        {"$set": {"token": payload.token, "role": payload.role, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/dashboard/summary")
async def dashboard_summary():
    cfg = await get_config_doc()

    async def last_event(t):
        d = await db.events.find({"type": t}).sort("created_at", -1).to_list(1)
        return d[0]["created_at"] if d else None

    last_checkin = await last_event("checkin")
    last_bedtime = await last_event("bedtime")
    pending = await db.alerts.count_documents({"status": "pending"})
    loc_docs = await db.locations.find().sort("created_at", -1).to_list(1)
    hb = await db.heartbeats.find_one({"id": "device"})
    return {
        "mamie_name": cfg.get("mamie_name", "Mamie"),
        "last_checkin": last_checkin,
        "last_bedtime": last_bedtime,
        "pending_alerts": pending,
        "last_location": (
            {k: v for k, v in loc_docs[0].items() if k != "_id"} if loc_docs else None
        ),
        "status": (
            {k: v for k, v in hb.items() if k != "_id"} if hb else {"online": False}
        ),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

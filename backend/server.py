from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Response
from fastapi.concurrency import run_in_threadpool
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
    mamie_phone: str = ""
    contacts: List[Contact] = Field(default_factory=list)
    fall_sensitivity: Literal["basse", "moyenne", "haute"] = "moyenne"
    checkin_interval_hours: int = 4
    dashboard_pin: str = "1234"
    sound_detection: bool = False
    updated_at: str = Field(default_factory=now_iso)


class ConfigUpdate(BaseModel):
    mamie_name: Optional[str] = None
    emergency_number: Optional[str] = None
    mamie_phone: Optional[str] = None
    contacts: Optional[List[Contact]] = None
    fall_sensitivity: Optional[Literal["basse", "moyenne", "haute"]] = None
    checkin_interval_hours: Optional[int] = None
    dashboard_pin: Optional[str] = None
    sound_detection: Optional[bool] = None


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


ActivityStatus = Literal["scheduled", "awaiting_confirmation", "confirmed", "escalated", "cancelled"]


class Activity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    kind: Literal["activity", "shower"] = "activity"
    start_at: str
    end_at: str
    grace_minutes: int = 10
    status: ActivityStatus = "scheduled"
    awaiting_since: Optional[str] = None
    confirmed_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ActivityCreate(BaseModel):
    title: str
    kind: Literal["activity", "shower"] = "activity"
    start_at: str
    end_at: str
    grace_minutes: int = 10


class ActivityUpdate(BaseModel):
    status: Literal["confirmed", "cancelled"]


def parse_iso(s: Optional[str]) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class PhotoRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["pending", "accepted", "refused", "fulfilled", "cancelled"] = "pending"
    photo_path: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    fulfilled_at: Optional[str] = None


class PhotoRequestUpdate(BaseModel):
    status: Literal["accepted", "refused", "cancelled"]


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


async def notify_mamie(title: str, body: str, data: dict):
    docs = await db.push_tokens.find({"role": "mamie"}).to_list(50)
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
# Object storage (Emergent managed) — photos captured by the app
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "mamiesafe"
_storage_key: Optional[str] = None


def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "image/jpeg")


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


# ---- Photo requests (dashboard asks Mamie for a photo) --------------------
@api_router.post("/photo-requests", response_model=PhotoRequest)
async def create_photo_request():
    pr = PhotoRequest()
    await db.photo_requests.insert_one(pr.dict())
    await notify_mamie(
        "📷 Demande de photo",
        "Votre famille souhaite voir que tout va bien. Appuyez pour prendre une photo.",
        {"kind": "photo", "requestId": pr.id},
    )
    return pr


@api_router.get("/photo-requests", response_model=List[PhotoRequest])
async def list_photo_requests(status: Optional[str] = None, limit: int = 20):
    q = {}
    if status:
        q["status"] = status
    docs = await db.photo_requests.find(q).sort("created_at", -1).to_list(limit)
    return [PhotoRequest(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.patch("/photo-requests/{req_id}", response_model=PhotoRequest)
async def update_photo_request(req_id: str, payload: PhotoRequestUpdate):
    doc = await db.photo_requests.find_one({"id": req_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    await db.photo_requests.update_one({"id": req_id}, {"$set": {"status": payload.status}})
    if payload.status == "refused":
        await notify_dashboard("Photo refusée", "Mamie n'a pas souhaité envoyer de photo.", {"requestId": req_id})
    doc = await db.photo_requests.find_one({"id": req_id})
    return PhotoRequest(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.post("/photo-requests/{req_id}/photo", response_model=PhotoRequest)
async def upload_photo(req_id: str, file: UploadFile = File(...)):
    doc = await db.photo_requests.find_one({"id": req_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    data = await file.read()
    ct = file.content_type or "image/jpeg"
    path = f"{APP_NAME}/uploads/mamie/{uuid.uuid4()}.jpg"
    await run_in_threadpool(put_object, path, data, ct)
    await db.photo_requests.update_one(
        {"id": req_id},
        {"$set": {"status": "fulfilled", "photo_path": path, "fulfilled_at": now_iso()}},
    )
    await notify_dashboard("📸 Photo reçue de Mamie", "Mamie a envoyé une photo.", {"requestId": req_id})
    doc = await db.photo_requests.find_one({"id": req_id})
    return PhotoRequest(**{k: v for k, v in doc.items() if k != "_id"})


@api_router.get("/photos/{req_id}")
async def get_photo(req_id: str):
    doc = await db.photo_requests.find_one({"id": req_id})
    if not doc or not doc.get("photo_path"):
        raise HTTPException(status_code=404, detail="Photo introuvable")
    data, ct = await run_in_threadpool(get_object, doc["photo_path"])
    return Response(content=data, media_type=ct)


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


@api_router.post("/activities", response_model=Activity)
async def create_activity(payload: ActivityCreate):
    act = Activity(**payload.dict())
    await db.activities.insert_one(act.dict())
    label = "🚿 Mamie prend sa douche" if act.kind == "shower" else f"📅 Activité : {act.title}"
    await notify_dashboard(label, f"{act.title}", {"activityId": act.id, "kind": act.kind})
    return act


@api_router.get("/activities", response_model=List[Activity])
async def get_activities(status: Optional[str] = None, limit: int = 100):
    q = {}
    if status:
        q["status"] = status
    docs = await db.activities.find(q).sort("start_at", -1).to_list(limit)
    return [Activity(**{k: v for k, v in d.items() if k != "_id"}) for d in docs]


@api_router.patch("/activities/{activity_id}", response_model=Activity)
async def update_activity(activity_id: str, payload: ActivityUpdate):
    doc = await db.activities.find_one({"id": activity_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Activité introuvable")
    updates: dict = {"status": payload.status}
    if payload.status == "confirmed":
        updates["confirmed_at"] = now_iso()
        await notify_dashboard(
            "✅ Mamie a confirmé",
            f"{doc.get('title', 'Activité')} terminé.",
            {"activityId": activity_id},
        )
    await db.activities.update_one({"id": activity_id}, {"$set": updates})
    doc = await db.activities.find_one({"id": activity_id})
    return Activity(**{k: v for k, v in doc.items() if k != "_id"})


async def activity_monitor():
    """Every 30s: move finished activities to awaiting confirmation, then escalate
    if Mamie does not confirm within the grace period."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            async for a in db.activities.find({"status": "scheduled"}):
                if parse_iso(a.get("end_at")) <= now:
                    await db.activities.update_one(
                        {"id": a["id"]},
                        {"$set": {"status": "awaiting_confirmation", "awaiting_since": now.isoformat()}},
                    )
                    await notify_mamie(
                        "Avez-vous fini ? ✅",
                        f"Avez-vous terminé : {a.get('title')} ? Appuyez pour confirmer.",
                        {"kind": "activity", "activityId": a["id"]},
                    )
                    await notify_dashboard(
                        "⏳ En attente de Mamie",
                        f"{a.get('title')} devrait être terminé.",
                        {"activityId": a["id"]},
                    )
            async for a in db.activities.find({"status": "awaiting_confirmation"}):
                since = parse_iso(a.get("awaiting_since") or a.get("end_at"))
                if (now - since).total_seconds() >= int(a.get("grace_minutes", 10)) * 60:
                    await db.activities.update_one({"id": a["id"]}, {"$set": {"status": "escalated"}})
                    al = Alert(
                        kind="missed_checkin",
                        severity="dangereux",
                        message=f"{a.get('title')} : aucune confirmation de Mamie.",
                    )
                    await db.alerts.insert_one(al.dict())
                    await notify_dashboard(
                        "🚨 Pas de réponse de Mamie",
                        f"{a.get('title')} non confirmé.",
                        {"alertId": al.id, "severity": "dangereux"},
                    )
                    await notify_mamie(
                        "⚠️ Répondez s'il vous plaît",
                        "Merci de confirmer que tout va bien.",
                        {"kind": "escalate"},
                    )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"activity_monitor error: {e}")
        await asyncio.sleep(30)


@app.on_event("startup")
async def _start_monitor():
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"init_storage failed: {e}")
    asyncio.create_task(activity_monitor())


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

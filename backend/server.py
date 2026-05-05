from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, date

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")


# --- Models ---
class BagType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#D4A373"
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BagTypeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#D4A373"


class BagTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


class CountPhotoRequest(BaseModel):
    image_base64: str
    bag_types: List[Dict[str, str]]  # [{"id":..., "name":..., "description":...}]


class CountPhotoResult(BaseModel):
    counts: Dict[str, int]  # bag_type_id -> count
    notes: str = ""


class DailyCount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    counts: Dict[str, int]  # bag_type_id -> count
    note: Optional[str] = ""
    image_base64: Optional[str] = None  # thumbnail for record (optional)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyCountCreate(BaseModel):
    date: str
    counts: Dict[str, int]
    note: Optional[str] = ""
    image_base64: Optional[str] = None


# --- Helpers ---
DEFAULT_BAG_TYPES = [
    {"name": "Liten påse", "description": "Liten kraftpåse", "color": "#E0C9A6", "order": 0},
    {"name": "Mellan påse", "description": "Mellanstor kraftpåse", "color": "#D4A373", "order": 1},
    {"name": "Stor påse", "description": "Stor kraftpåse med handtag", "color": "#A88358", "order": 2},
]


async def ensure_seed_bag_types():
    count = await db.bag_types.count_documents({})
    if count == 0:
        for t in DEFAULT_BAG_TYPES:
            bt = BagType(**t)
            doc = bt.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.bag_types.insert_one(doc)


def _serialize_bag_type(d: dict) -> dict:
    if isinstance(d.get("created_at"), str):
        try:
            d["created_at"] = datetime.fromisoformat(d["created_at"])
        except Exception:
            pass
    return d


def _serialize_daily(d: dict) -> dict:
    if isinstance(d.get("created_at"), str):
        try:
            d["created_at"] = datetime.fromisoformat(d["created_at"])
        except Exception:
            pass
    return d


# --- Endpoints ---
@api_router.get("/")
async def root():
    return {"message": "Påsräknaren API", "status": "ok"}


# Bag Types CRUD
@api_router.get("/bag-types", response_model=List[BagType])
async def list_bag_types():
    await ensure_seed_bag_types()
    items = await db.bag_types.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return [BagType(**_serialize_bag_type(i)) for i in items]


@api_router.post("/bag-types", response_model=BagType)
async def create_bag_type(payload: BagTypeCreate):
    # determine order = max+1
    last = await db.bag_types.find({}, {"_id": 0, "order": 1}).sort("order", -1).limit(1).to_list(1)
    next_order = (last[0]["order"] + 1) if last else 0
    bt = BagType(**payload.model_dump(), order=next_order)
    doc = bt.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.bag_types.insert_one(doc)
    return bt


@api_router.put("/bag-types/{type_id}", response_model=BagType)
async def update_bag_type(type_id: str, payload: BagTypeUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.bag_types.update_one({"id": type_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bag type not found")
    item = await db.bag_types.find_one({"id": type_id}, {"_id": 0})
    return BagType(**_serialize_bag_type(item))


@api_router.delete("/bag-types/{type_id}")
async def delete_bag_type(type_id: str):
    res = await db.bag_types.delete_one({"id": type_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bag type not found")
    return {"deleted": True}


# AI counting
def _extract_json(text: str) -> dict:
    # Try to find a JSON object in the LLM response
    text = text.strip()
    # Strip code fences
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # Find first { ... } block
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


@api_router.post("/count-photo", response_model=CountPhotoResult)
async def count_photo(req: CountPhotoRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 required")
    if not req.bag_types:
        raise HTTPException(status_code=400, detail="bag_types required")

    # Strip data URL prefix if present
    img_b64 = req.image_base64
    if img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1] if "," in img_b64 else img_b64

    # Build a clear instruction
    types_desc = "\n".join(
        f"- ID: {t['id']} | NAMN: {t.get('name','')} | BESKRIVNING: {t.get('description','')}"
        for t in req.bag_types
    )

    system_msg = (
        "Du är en specialist på att räkna pappersbärkassar/påsar i lager- och butiksbilder. "
        "Du tittar på bilder av staplar med kraftpapperspåsar i fack och uppskattar antalet. "
        "Räkna varje stapel/fack noggrant. Om bilden inte tydligt visar någon stapel av en viss typ, "
        "returnera 0 för den typen. Svara ALLTID med ENDAST giltig JSON, inget annat."
    )

    user_text = (
        "Räkna påsarna på bilden. Kategorisera dem enligt följande typer:\n\n"
        f"{types_desc}\n\n"
        "Räkna det totala antalet påsar PER TYP-ID baserat på beskrivningarna. "
        "Om en bild verkar visa flera fack/staplar, summera dem per typ. "
        "Returnera ENDAST en JSON med exakt detta format (inga kommentarer, inga code fences):\n"
        '{ "counts": { "<TYPE_ID>": <heltal>, ... }, "notes": "<kort kommentar på svenska>" }\n\n'
        "Inkludera ALLA typ-ID från listan ovan i counts (även om värdet är 0)."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"bag-count-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("gemini", "gemini-2.5-pro")

    image_content = ImageContent(image_base64=img_b64)
    user_message = UserMessage(text=user_text, file_contents=[image_content])

    try:
        response = await chat.send_message(user_message)
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"AI-fel: {str(e)}")

    parsed = _extract_json(response if isinstance(response, str) else str(response))
    raw_counts = parsed.get("counts", {})
    notes = parsed.get("notes", "")

    # Normalize counts: ensure all bag type IDs present, integer values
    counts: Dict[str, int] = {}
    valid_ids = {t["id"] for t in req.bag_types}
    for tid in valid_ids:
        v = raw_counts.get(tid, 0)
        try:
            counts[tid] = max(0, int(v))
        except (TypeError, ValueError):
            counts[tid] = 0

    return CountPhotoResult(counts=counts, notes=str(notes)[:500])


# Daily counts
@api_router.post("/daily-counts", response_model=DailyCount)
async def create_daily_count(payload: DailyCountCreate):
    dc = DailyCount(**payload.model_dump())
    doc = dc.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.daily_counts.insert_one(doc)
    return dc


@api_router.get("/daily-counts", response_model=List[DailyCount])
async def list_daily_counts(limit: int = 100):
    items = (
        await db.daily_counts.find({}, {"_id": 0, "image_base64": 0})
        .sort("date", -1)
        .to_list(limit)
    )
    return [DailyCount(**_serialize_daily(i)) for i in items]


@api_router.get("/daily-counts/{count_id}", response_model=DailyCount)
async def get_daily_count(count_id: str):
    item = await db.daily_counts.find_one({"id": count_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    return DailyCount(**_serialize_daily(item))


@api_router.delete("/daily-counts/{count_id}")
async def delete_daily_count(count_id: str):
    res = await db.daily_counts.delete_one({"id": count_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


# include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    await ensure_seed_bag_types()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

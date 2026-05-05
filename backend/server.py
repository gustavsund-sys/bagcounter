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
class Register(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#2A3B32"
    order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegisterCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#2A3B32"


class RegisterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


class CountPhotoRequest(BaseModel):
    image_base64: str


class CountPhotoResult(BaseModel):
    count: int
    notes: str = ""


class DailyCount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    register_id: str
    register_name: str  # snapshot for history readability
    count: int
    note: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DailyCountCreate(BaseModel):
    date: str
    register_id: str
    count: int
    note: Optional[str] = ""


# --- Helpers ---
DEFAULT_REGISTERS = [
    {"name": "Kassa 1", "description": "", "color": "#2A3B32", "order": 0},
    {"name": "Kassa 2", "description": "", "color": "#5A7A6E", "order": 1},
    {"name": "Kassa 3", "description": "", "color": "#A88358", "order": 2},
]


async def ensure_seed_registers():
    count = await db.registers.count_documents({})
    if count == 0:
        for r in DEFAULT_REGISTERS:
            reg = Register(**r)
            doc = reg.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.registers.insert_one(doc)


def _serialize_register(d: dict) -> dict:
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


# Registers (Kassor) CRUD
@api_router.get("/registers", response_model=List[Register])
async def list_registers():
    await ensure_seed_registers()
    items = await db.registers.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return [Register(**_serialize_register(i)) for i in items]


@api_router.post("/registers", response_model=Register)
async def create_register(payload: RegisterCreate):
    last = await db.registers.find({}, {"_id": 0, "order": 1}).sort("order", -1).limit(1).to_list(1)
    next_order = (last[0]["order"] + 1) if last else 0
    reg = Register(**payload.model_dump(), order=next_order)
    doc = reg.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.registers.insert_one(doc)
    return reg


@api_router.put("/registers/{register_id}", response_model=Register)
async def update_register(register_id: str, payload: RegisterUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.registers.update_one({"id": register_id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Register not found")
    item = await db.registers.find_one({"id": register_id}, {"_id": 0})
    return Register(**_serialize_register(item))


@api_router.delete("/registers/{register_id}")
async def delete_register(register_id: str):
    res = await db.registers.delete_one({"id": register_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Register not found")
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

    # Strip data URL prefix if present
    img_b64 = req.image_base64
    if img_b64.startswith("data:"):
        img_b64 = img_b64.split(",", 1)[1] if "," in img_b64 else img_b64

    system_msg = (
        "Du är en specialist på att räkna pappersbärkassar/påsar i butiksbilder. "
        "Du tittar på bilder av staplar med kraftpapperspåsar i fack vid en kassa och uppskattar "
        "TOTALA antalet påsar i bilden. Räkna varje stapel/fack noggrant och summera. "
        "Svara ALLTID med ENDAST giltig JSON, inget annat."
    )

    user_text = (
        "Räkna det TOTALA antalet påsar/kassar på bilden. Summera alla staplar och fack du ser. "
        "Returnera ENDAST en JSON med exakt detta format (inga kommentarer, inga code fences):\n"
        '{ "count": <heltal>, "notes": "<kort kommentar på svenska om hur du räknade>" }'
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"bag-count-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("gemini", "gemini-2.5-flash")

    image_content = ImageContent(image_base64=img_b64)
    user_message = UserMessage(text=user_text, file_contents=[image_content])

    try:
        response = await chat.send_message(user_message)
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"AI-fel: {str(e)}")

    parsed = _extract_json(response if isinstance(response, str) else str(response))
    raw_count = parsed.get("count", 0)
    notes = parsed.get("notes", "")

    try:
        count = max(0, int(raw_count))
    except (TypeError, ValueError):
        count = 0

    return CountPhotoResult(count=count, notes=str(notes)[:500])


# Daily counts
@api_router.post("/daily-counts", response_model=DailyCount)
async def create_daily_count(payload: DailyCountCreate):
    register = await db.registers.find_one({"id": payload.register_id}, {"_id": 0})
    if not register:
        raise HTTPException(status_code=404, detail="Register not found")
    dc = DailyCount(
        date=payload.date,
        register_id=payload.register_id,
        register_name=register["name"],
        count=max(0, int(payload.count)),
        note=payload.note or "",
    )
    doc = dc.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.daily_counts.insert_one(doc)
    return dc


@api_router.get("/daily-counts", response_model=List[DailyCount])
async def list_daily_counts(limit: int = 200, register_id: Optional[str] = None):
    query = {"register_id": register_id} if register_id else {}
    items = (
        await db.daily_counts.find(query, {"_id": 0})
        .sort([("date", -1), ("created_at", -1)])
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
    await ensure_seed_registers()
    # one-time migration: drop old daily_counts entries that use the old schema
    await db.daily_counts.delete_many({"register_id": {"$exists": False}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

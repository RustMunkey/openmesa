import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.db import get_pool

router = APIRouter()


class PinRequest(BaseModel):
    content: str
    source: str = "pinned"


class NotesRequest(BaseModel):
    content: str


@router.get("/memory")
async def get_memory():
    async with get_pool().acquire() as conn:
        pins = await conn.fetch(
            "SELECT id, content, source, pinned_at FROM memory_items "
            "WHERE user_id = 'default' ORDER BY pinned_at DESC"
        )
        notes_row = await conn.fetchrow(
            "SELECT content FROM notes WHERE user_id = 'default'"
        )
    return {
        "pins": [dict(r) for r in pins],
        "notes": notes_row["content"] if notes_row else "",
    }


@router.post("/memory/pin")
async def pin_item(req: PinRequest):
    item_id = str(uuid.uuid4())
    pinned_at = int(time.time() * 1000)
    async with get_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO memory_items (id, user_id, content, source, pinned_at) "
            "VALUES ($1, 'default', $2, $3, $4)",
            item_id, req.content, req.source, pinned_at,
        )
    return {"id": item_id, "content": req.content, "source": req.source, "pinned_at": pinned_at}


@router.delete("/memory/pin/{item_id}")
async def unpin_item(item_id: str):
    async with get_pool().acquire() as conn:
        result = await conn.execute(
            "DELETE FROM memory_items WHERE id = $1 AND user_id = 'default'",
            item_id,
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


@router.put("/memory/notes")
async def update_notes(req: NotesRequest):
    async with get_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO notes (user_id, content) VALUES ('default', $1) "
            "ON CONFLICT (user_id) DO UPDATE SET content = EXCLUDED.content",
            req.content,
        )
    return {"ok": True}

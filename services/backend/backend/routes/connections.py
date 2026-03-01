import json
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.db import get_pool
from backend.connections import manager

router = APIRouter()


class ConnectionCreate(BaseModel):
    name: str
    type: str  # telegram | discord
    config: dict
    enabled: bool = True


class ConnectionUpdate(BaseModel):
    name: str | None = None
    config: dict | None = None
    enabled: bool | None = None


@router.get("/connections")
async def list_connections():
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM connections WHERE user_id = 'default' ORDER BY created_at DESC"
        )
    result = []
    for row in rows:
        r = dict(row)
        r["running"] = manager.is_running(r["id"])
        result.append(r)
    return result


@router.post("/connections")
async def create_connection(body: ConnectionCreate):
    cid = str(uuid.uuid4())
    async with get_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO connections (id, user_id, name, type, config, enabled) "
            "VALUES ($1, 'default', $2, $3, $4, $5)",
            cid, body.name, body.type, json.dumps(body.config), body.enabled,
        )

    if body.enabled:
        row = {"id": cid, "type": body.type, "config": json.dumps(body.config), "enabled": True}
        await manager.start(row)

    return {"id": cid}


@router.patch("/connections/{connection_id}")
async def update_connection(connection_id: str, body: ConnectionUpdate):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM connections WHERE id = $1 AND user_id = 'default'",
            connection_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        if body.name is not None:
            await conn.execute(
                "UPDATE connections SET name = $1 WHERE id = $2", body.name, connection_id
            )
        if body.config is not None:
            await conn.execute(
                "UPDATE connections SET config = $1 WHERE id = $2",
                json.dumps(body.config), connection_id,
            )
        if body.enabled is not None:
            await conn.execute(
                "UPDATE connections SET enabled = $1 WHERE id = $2", body.enabled, connection_id
            )

    was_running = manager.is_running(connection_id)
    await manager.stop(connection_id)

    if body.enabled is True or (body.enabled is None and was_running):
        async with get_pool().acquire() as conn:
            updated = dict(await conn.fetchrow(
                "SELECT * FROM connections WHERE id = $1", connection_id
            ))
        updated["config"] = json.dumps(updated["config"])
        await manager.start(updated)

    return {"ok": True}


@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str):
    await manager.stop(connection_id)
    async with get_pool().acquire() as conn:
        await conn.execute(
            "DELETE FROM connections WHERE id = $1 AND user_id = 'default'", connection_id
        )
    return {"ok": True}


@router.post("/connections/{connection_id}/toggle")
async def toggle_connection(connection_id: str):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM connections WHERE id = $1 AND user_id = 'default'", connection_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        new_enabled = not row["enabled"]
        await conn.execute(
            "UPDATE connections SET enabled = $1 WHERE id = $2", new_enabled, connection_id
        )

    if new_enabled:
        async with get_pool().acquire() as conn:
            updated = dict(await conn.fetchrow(
                "SELECT * FROM connections WHERE id = $1", connection_id
            ))
        updated["config"] = json.dumps(updated["config"])
        await manager.start(updated)
    else:
        await manager.stop(connection_id)

    return {"enabled": new_enabled, "running": manager.is_running(connection_id)}

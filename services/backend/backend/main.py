from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db import init_db, get_pool
from backend.routes import chat, memory, providers, confirmations, connections


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from backend.connections import manager
    from backend.agent.scheduler import start as start_scheduler
    # Start scheduler
    await start_scheduler()
    # Start any enabled connections
    async with get_pool().acquire() as conn:
        rows = [dict(r) for r in await conn.fetch(
            "SELECT * FROM connections WHERE enabled = true"
        )]
    await manager.start_all(rows)
    yield


app = FastAPI(title="Deimos", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(memory.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(confirmations.router, prefix="/api")
app.include_router(connections.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}

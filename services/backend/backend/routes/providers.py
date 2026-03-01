from fastapi import APIRouter
from pydantic import BaseModel
from backend.db import get_pool

router = APIRouter()


class ProviderModel(BaseModel):
    id: str
    name: str
    models: list[str]
    requires_key: bool
    base_url: str | None = None


PROVIDERS: list[ProviderModel] = [
    ProviderModel(
        id="anthropic",
        name="Anthropic",
        models=["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
        requires_key=True,
    ),
    ProviderModel(
        id="openai",
        name="OpenAI",
        models=["gpt-4o", "gpt-4o-mini", "o3-mini"],
        requires_key=True,
    ),
    ProviderModel(
        id="ollama",
        name="Ollama (Local)",
        models=["llama3.2", "llama3.1", "mistral", "codellama"],
        requires_key=False,
        base_url="http://localhost:11434",
    ),
    ProviderModel(
        id="openclaw",
        name="OpenClaw",
        models=["claude-sonnet-4-6", "gpt-4o"],
        requires_key=False,
        base_url="http://localhost:18789",
    ),
]


@router.get("/providers")
async def list_providers():
    return {"providers": [p.model_dump() for p in PROVIDERS]}


@router.get("/tokens")
async def token_stats():
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT model, provider, SUM(input_tokens) as input, SUM(output_tokens) as output, COUNT(*) as calls "
            "FROM token_usage WHERE user_id = 'default' GROUP BY model, provider ORDER BY input DESC"
        )
        totals = await conn.fetchrow(
            "SELECT SUM(input_tokens) as total_input, SUM(output_tokens) as total_output "
            "FROM token_usage WHERE user_id = 'default'"
        )
    return {"by_model": [dict(r) for r in rows], "totals": dict(totals)}


@router.get("/ollama/models")
async def ollama_models(base_url: str = "http://localhost:11434"):
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{base_url}/api/tags")
            data = res.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"models": models, "connected": True}
    except Exception:
        return {"models": [], "connected": False}

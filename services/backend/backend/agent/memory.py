"""
Vector memory engine.
Embeds text, stores in SQLite as JSON vectors, retrieves by cosine similarity.
Embedding providers: Ollama (local, no API key) or OpenAI (cloud fallback).
"""
import asyncio
import logging
import time
import uuid

import httpx

from backend.config import settings
from backend.db import get_pool, is_sqlite

logger = logging.getLogger(__name__)


# ── Embedding ─────────────────────────────────────────────────────────────────

async def embed(text: str) -> list[float]:
    """Generate a vector embedding for text. Tries Ollama first, then OpenAI."""
    if settings.embed_provider == "openai":
        return await _embed_openai(text)
    try:
        return await _embed_ollama(text)
    except Exception:
        if settings.openai_api_key:
            return await _embed_openai(text)
        raise RuntimeError(
            "No embedding provider available. "
            "Run `ollama pull nomic-embed-text` or set OPENAI_API_KEY."
        )


async def _embed_ollama(text: str) -> list[float]:
    base_url = settings.ollama_base_url
    async with httpx.AsyncClient(timeout=30) as client:
        # Try new /api/embed endpoint first (Ollama >= 0.3)
        try:
            r = await client.post(
                f"{base_url}/api/embed",
                json={"model": settings.embed_model, "input": text},
            )
            r.raise_for_status()
            data = r.json()
            if "embeddings" in data:
                return data["embeddings"][0]
        except Exception:
            pass
        # Fall back to /api/embeddings (older Ollama)
        r = await client.post(
            f"{base_url}/api/embeddings",
            json={"model": settings.embed_model, "prompt": text},
        )
        r.raise_for_status()
        return r.json()["embedding"]


async def _embed_openai(text: str) -> list[float]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    r = await client.embeddings.create(
        input=text,
        model="text-embedding-3-small",
        dimensions=768,
    )
    return r.data[0].embedding


# ── Storage ───────────────────────────────────────────────────────────────────

def _vec_str(vec: list[float]) -> str:
    """Format a float list as a pgvector literal: [0.1,0.2,...]"""
    return "[" + ",".join(str(x) for x in vec) + "]"


async def store(content: str, source: str = "auto") -> str:
    """Embed and store a memory. Returns the memory ID."""
    mid = str(uuid.uuid4())
    if is_sqlite():
        # SQLite has no vector extension — store content only (no embedding)
        async with get_pool().acquire() as conn:
            await conn.execute(
                "INSERT INTO memory_vectors (id, user_id, content, source) "
                "VALUES ($1, 'default', $2, $3)",
                mid, content, source,
            )
        return mid

    vec = await embed(content)
    async with get_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO memory_vectors (id, user_id, content, embedding, source) "
            "VALUES ($1, 'default', $2, $3::vector, $4)",
            mid, content, _vec_str(vec), source,
        )
    return mid


async def store_session(messages: list[dict], response: str):
    """
    Store a conversation turn as a memory entry. Called after each agent run.
    Runs silently — never raises, never blocks the response.
    """
    try:
        user_text = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )
        if not user_text.strip() or not response.strip():
            return
        # Only store if the exchange is substantive (not just hello/ok)
        if len(user_text) < 10 and len(response) < 30:
            return

        snippet_q = user_text[:300]
        snippet_a = response[:400]
        content = f"Q: {snippet_q}\nA: {snippet_a}"
        await store(content, source="session")
        logger.debug("Stored session memory")
    except Exception as e:
        logger.debug(f"Memory store skipped: {e}")


# ── Retrieval ─────────────────────────────────────────────────────────────────

async def search(query: str, k: int = 5) -> list[dict]:
    """
    Return the k most semantically similar memories.
    Uses pgvector cosine search on Postgres, or a simple recency fetch on SQLite.
    Returns [] silently on any failure.
    """
    if is_sqlite():
        # No vector search on SQLite — return most recent memories as context
        try:
            async with get_pool().acquire() as conn:
                rows = await conn.fetch(
                    "SELECT content, source, created_at, 1.0 as score "
                    "FROM memory_vectors WHERE user_id = 'default' "
                    "ORDER BY created_at DESC LIMIT $1",
                    k,
                )
            return [dict(r) for r in rows]
        except Exception as e:
            logger.debug(f"SQLite memory fetch failed: {e}")
            return []

    try:
        query_vec = await embed(query)
    except Exception as e:
        logger.debug(f"Embed failed for memory search: {e}")
        return []

    try:
        async with get_pool().acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT content, source,
                       EXTRACT(EPOCH FROM created_at)::bigint as created_at,
                       1 - (embedding <=> $1::vector) as score
                FROM memory_vectors
                WHERE user_id = 'default'
                  AND 1 - (embedding <=> $1::vector) > 0.6
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                _vec_str(query_vec), k,
            )
        return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"Memory search failed: {e}")
        return []

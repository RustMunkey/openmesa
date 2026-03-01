"""
Database abstraction layer.
Supports both asyncpg (PostgreSQL) and aiosqlite (SQLite) via a unified interface.
The active driver is selected from settings.database_url at startup.
"""
from __future__ import annotations

import json
import re
from contextlib import asynccontextmanager
from typing import Any

from backend.config import settings

# ── Type aliases ──────────────────────────────────────────────────────────────

Row = dict[str, Any]

# ── Postgres schema (original) ────────────────────────────────────────────────

POSTGRES_SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (id, username, api_key)
VALUES ('default', 'default', 'local')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'pinned',
    pinned_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    content TEXT NOT NULL DEFAULT ''
);

INSERT INTO notes (user_id, content) VALUES ('default', '') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_vectors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    content TEXT NOT NULL,
    embedding vector(768),
    source TEXT NOT NULL DEFAULT 'session',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_vectors_embedding_idx
    ON memory_vectors USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    message TEXT NOT NULL,
    due_at BIGINT NOT NULL,
    connection_id TEXT,
    chat_id TEXT,
    done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

# ── SQLite schema (adapted) ───────────────────────────────────────────────────
# Key differences:
#  - No pgvector extension or vector columns
#  - JSONB → TEXT
#  - TIMESTAMPTZ / NOW() → INTEGER / (strftime('%s','now'))
#  - BIGSERIAL → INTEGER PRIMARY KEY AUTOINCREMENT
#  - BOOLEAN → INTEGER (0/1)
#  - ON CONFLICT DO NOTHING → INSERT OR IGNORE
#  - No IVFFLAT index

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

INSERT OR IGNORE INTO users (id, username, api_key)
VALUES ('default', 'default', 'local');

CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'pinned',
    pinned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    content TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO notes (user_id, content) VALUES ('default', '');

CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS memory_vectors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'session',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    message TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    connection_id TEXT,
    chat_id TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
"""

# ── Helpers ───────────────────────────────────────────────────────────────────

_PG_PARAM_RE = re.compile(r"\$(\d+)")

# Columns whose TEXT values should be auto-parsed as JSON when using SQLite
_JSON_COLUMNS = {"config", "embedding"}


def _pg_to_sqlite(sql: str) -> str:
    """Convert asyncpg-style $1 params and Postgres-isms to SQLite syntax."""
    # Replace $1, $2, ... with ?
    sql = _PG_PARAM_RE.sub("?", sql)
    # done = false / done = true  →  done = 0 / done = 1
    sql = re.sub(r"\bdone\s*=\s*false\b", "done = 0", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bdone\s*=\s*true\b", "done = 1", sql, flags=re.IGNORECASE)
    # SET done = true  (UPDATE … SET)
    sql = re.sub(r"\bSET\s+done\s*=\s*true\b", "SET done = 1", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bSET\s+done\s*=\s*false\b", "SET done = 0", sql, flags=re.IGNORECASE)
    # Strip ::vector, ::text casts (SQLite doesn't support them)
    sql = re.sub(r"::\w+", "", sql)
    # EXTRACT(EPOCH FROM col)::bigint  →  col  (SQLite stores timestamps as epoch)
    sql = re.sub(
        r"EXTRACT\s*\(\s*EPOCH\s+FROM\s+(\w+)\s*\)",
        r"\1",
        sql,
        flags=re.IGNORECASE,
    )
    return sql


def _parse_row(row: Any, description: Any = None) -> Row:
    """Convert an aiosqlite Row to a dict, auto-parsing JSON TEXT columns."""
    if description is not None:
        keys = [col[0] for col in description]
        d = dict(zip(keys, row))
    else:
        d = dict(row)
    for k, v in d.items():
        if k in _JSON_COLUMNS and isinstance(v, str):
            try:
                d[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                pass
    return d


# ── SQLite adapter ────────────────────────────────────────────────────────────


class _SQLiteConn:
    """Duck-types asyncpg's Connection interface over aiosqlite."""

    def __init__(self, conn):
        self._conn = conn

    async def execute(self, sql: str, *args) -> str:
        sql_conv = _pg_to_sqlite(sql)
        cursor = await self._conn.execute(sql_conv, args)
        await self._conn.commit()
        # Return an asyncpg-compatible status string so callers can check e.g. "DELETE 0"
        verb = sql.strip().split()[0].upper()
        rowcount = cursor.rowcount if cursor.rowcount is not None else 0
        if verb in ("INSERT",):
            return f"INSERT 0 {rowcount}"
        return f"{verb} {rowcount}"

    async def fetch(self, sql: str, *args) -> list[Row]:
        sql = _pg_to_sqlite(sql)
        async with self._conn.execute(sql, args) as cursor:
            rows = await cursor.fetchall()
            desc = cursor.description
        return [_parse_row(r, desc) for r in rows]

    async def fetchrow(self, sql: str, *args) -> Row | None:
        sql = _pg_to_sqlite(sql)
        async with self._conn.execute(sql, args) as cursor:
            row = await cursor.fetchone()
            desc = cursor.description
        if row is None:
            return None
        return _parse_row(row, desc)

    async def fetchval(self, sql: str, *args) -> Any:
        row = await self.fetchrow(sql, *args)
        if row is None:
            return None
        return next(iter(row.values()))


class _SQLitePool:
    """Duck-types asyncpg's Pool.acquire() context manager over aiosqlite."""

    def __init__(self, db_path: str):
        self._db_path = db_path
        self._db = None  # shared connection (single-writer SQLite)

    async def _get_db(self):
        if self._db is None:
            import aiosqlite
            self._db = await aiosqlite.connect(self._db_path)
            self._db.row_factory = None  # use raw tuples + description
        return self._db

    @asynccontextmanager
    async def acquire(self):
        db = await self._get_db()
        yield _SQLiteConn(db)

    async def close(self):
        if self._db is not None:
            await self._db.close()
            self._db = None


# ── Global pool ───────────────────────────────────────────────────────────────

_pool: Any = None  # asyncpg.Pool | _SQLitePool
_is_sqlite: bool = False


def is_sqlite() -> bool:
    return _is_sqlite


async def init_db():
    global _pool, _is_sqlite

    url = settings.database_url

    if url.startswith("sqlite"):
        _is_sqlite = True
        # Extract file path: sqlite:///path or sqlite+aiosqlite:///path
        db_path = re.sub(r"^sqlite(?:\+\w+)?:///", "", url)
        if not db_path:
            db_path = "deimos.db"
        _pool = _SQLitePool(db_path)
        async with _pool.acquire() as conn:
            # SQLite doesn't support multi-statement strings in execute()
            for stmt in _split_sql(SQLITE_SCHEMA):
                await conn.execute(stmt)
    else:
        import asyncpg
        _is_sqlite = False
        _pool = await asyncpg.create_pool(
            url,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
        async with _pool.acquire() as conn:
            await conn.execute(POSTGRES_SCHEMA)


def get_pool():
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _pool


# ── Utilities ─────────────────────────────────────────────────────────────────

def _split_sql(sql: str) -> list[str]:
    """Split a multi-statement SQL string into individual statements."""
    stmts = []
    for raw in sql.split(";"):
        s = raw.strip()
        if s:
            stmts.append(s)
    return stmts

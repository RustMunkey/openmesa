"""
Async task scheduler.
Schedules reminder messages, persists them in SQLite,
fires them via the notifier when due.
"""
import asyncio
import logging
import time
import uuid

from backend.db import get_pool

logger = logging.getLogger(__name__)

_loop_task: asyncio.Task | None = None


async def start():
    global _loop_task
    if _loop_task and not _loop_task.done():
        return
    _loop_task = asyncio.create_task(_run_loop(), name="scheduler")
    logger.info("Scheduler started")


async def schedule(
    message: str,
    delay_minutes: int,
    connection_id: str | None = None,
    chat_id: str | None = None,
) -> str:
    """Schedule a reminder. Returns the task ID."""
    task_id = str(uuid.uuid4())
    due_at = int(time.time()) + (delay_minutes * 60)
    async with get_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO scheduled_tasks (id, message, due_at, connection_id, chat_id) "
            "VALUES ($1, $2, $3, $4, $5)",
            task_id, message, due_at, connection_id, chat_id,
        )
    logger.info(f"Scheduled task {task_id} in {delay_minutes}min: {message[:60]}")
    return task_id


async def _run_loop():
    while True:
        try:
            await _check_due()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(30)  # check every 30 seconds


async def _check_due():
    from backend.agent.notifier import notify

    now = int(time.time())
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM scheduled_tasks WHERE due_at <= $1 AND done = false",
            now,
        )
        for row in rows:
            task = dict(row)
            await conn.execute(
                "UPDATE scheduled_tasks SET done = true WHERE id = $1", task["id"]
            )
            await _fire(task, notify)


async def _fire(task: dict, notify_fn):
    msg = f"⏰ Reminder: {task['message']}"
    logger.info(f"Scheduler firing: {task['message']}")
    await notify_fn(task.get("connection_id"), task.get("chat_id"), msg)

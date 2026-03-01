import asyncio
import json
import logging

logger = logging.getLogger(__name__)

# connection_id -> asyncio.Task
_tasks: dict[str, asyncio.Task] = {}


async def start(connection: dict):
    cid = connection["id"]
    if cid in _tasks:
        return

    ctype = connection["type"]
    raw_config = connection["config"]
    config = raw_config if isinstance(raw_config, dict) else json.loads(raw_config)

    try:
        if ctype == "telegram":
            from backend.connections.telegram import TelegramConnection
            conn = TelegramConnection(cid, config)
        elif ctype == "discord":
            from backend.connections.discord_bot import DiscordConnection
            conn = DiscordConnection(cid, config)
        else:
            logger.warning(f"Unknown connection type: {ctype}")
            return

        task = asyncio.create_task(conn.run(), name=f"connection-{cid}")
        _tasks[cid] = task
        logger.info(f"Started {ctype} connection {cid}")
    except Exception as e:
        logger.error(f"Failed to start connection {cid}: {e}")


async def stop(connection_id: str):
    task = _tasks.pop(connection_id, None)
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def start_all(connections: list[dict]):
    for conn in connections:
        if conn.get("enabled"):
            await start(conn)


def is_running(connection_id: str) -> bool:
    task = _tasks.get(connection_id)
    return task is not None and not task.done()

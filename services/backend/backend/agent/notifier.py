"""
Notification routing.
Connections register a send_fn so the scheduler can push messages
back to the right chat without knowing the platform.
"""
import logging
from typing import Callable, Awaitable

logger = logging.getLogger(__name__)

# connection_id -> async send_fn(chat_id, text)
_handlers: dict[str, Callable[[str, str], Awaitable[None]]] = {}


def register(connection_id: str, send_fn: Callable[[str, str], Awaitable[None]]):
    _handlers[connection_id] = send_fn


def unregister(connection_id: str):
    _handlers.pop(connection_id, None)


async def notify(connection_id: str | None, chat_id: str | None, text: str):
    if connection_id and connection_id in _handlers:
        try:
            await _handlers[connection_id](chat_id, text)
        except Exception as e:
            logger.error(f"Notifier error ({connection_id}): {e}")
    elif not connection_id:
        for cid, fn in list(_handlers.items()):
            try:
                await fn(chat_id, text)
            except Exception as e:
                logger.error(f"Notifier broadcast error ({cid}): {e}")

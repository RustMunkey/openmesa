"""
Per-request context vars.
Set by the connection that's handling the current message,
so tools (schedule, notify) know where to send responses back.
"""
from contextvars import ContextVar

connection_id: ContextVar[str | None] = ContextVar("connection_id", default=None)
chat_id: ContextVar[str | None] = ContextVar("chat_id", default=None)

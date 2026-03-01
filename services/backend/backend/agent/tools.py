import asyncio
import json
import os
from typing import Any, Callable, Awaitable


class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        risk: str,
        schema: dict,
        fn: Callable[..., Awaitable[tuple[str, str | None]]],
    ):
        self.name = name
        self.description = description
        self.risk = risk
        self.schema = schema
        self._fn = fn

    async def execute(self, **kwargs: Any) -> tuple[str, str | None]:
        return await self._fn(**kwargs)

    def display(self, args: dict) -> str:
        if self.name == "bash":
            return args.get("command", "")
        if self.name == "read_file":
            return f"Read  {args.get('path', '')}"
        if self.name == "write_file":
            content = args.get("content", "")
            return f"Write {args.get('path', '')}  ({len(content)} chars)"
        if self.name == "list_dir":
            return f"List  {args.get('path', '.')}"
        if self.name == "search_files":
            return f"Search '{args.get('pattern', '')}' in {args.get('path', '.')}"
        if self.name == "fetch_url":
            return f"{args.get('method', 'GET')}  {args.get('url', '')}"
        if self.name == "remember":
            content = args.get("content", "")
            return content[:80]
        if self.name == "schedule":
            return f"In {args.get('delay_minutes', '?')}min: {args.get('message', '')[:60]}"
        return f"{self.name}({json.dumps(args)[:80]})"


# ── Memory & scheduler tools ──────────────────────────────────────────────────

async def _remember(content: str) -> tuple[str, str | None]:
    try:
        from backend.agent.memory import store
        mid = await store(content, source="explicit")
        return f"Remembered (id: {mid[:8]})", None
    except Exception as e:
        return "", str(e)


async def _schedule(message: str, delay_minutes: int) -> tuple[str, str | None]:
    try:
        from backend.agent.scheduler import schedule
        from backend.agent.context import connection_id, chat_id
        task_id = await schedule(
            message=message,
            delay_minutes=delay_minutes,
            connection_id=connection_id.get(),
            chat_id=chat_id.get(),
        )
        return f"Scheduled (id: {task_id[:8]}) — reminder in {delay_minutes} minute(s)", None
    except Exception as e:
        return "", str(e)


# ── Tool implementations ──────────────────────────────────────────────────────

async def _bash(command: str, timeout: int = 30) -> tuple[str, str | None]:
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=os.getcwd(),
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        out = stdout.decode(errors="replace").strip()
        err = stderr.decode(errors="replace").strip() or None
        return out or "(no output)", err
    except asyncio.TimeoutError:
        return "", f"Timed out after {timeout}s"
    except Exception as e:
        return "", str(e)


async def _read_file(path: str) -> tuple[str, str | None]:
    try:
        with open(os.path.expanduser(path), errors="replace") as f:
            return f.read(), None
    except Exception as e:
        return "", str(e)


async def _write_file(path: str, content: str) -> tuple[str, str | None]:
    try:
        expanded = os.path.expanduser(path)
        os.makedirs(os.path.dirname(os.path.abspath(expanded)), exist_ok=True)
        with open(expanded, "w") as f:
            f.write(content)
        return f"Wrote {len(content)} chars to {path}", None
    except Exception as e:
        return "", str(e)


async def _list_dir(path: str = ".") -> tuple[str, str | None]:
    try:
        entries = sorted(os.listdir(os.path.expanduser(path)))
        lines = [("d " if os.path.isdir(os.path.join(path, e)) else "f ") + e for e in entries]
        return "\n".join(lines) or "(empty)", None
    except Exception as e:
        return "", str(e)


async def _search_files(
    pattern: str, path: str = ".", file_glob: str = "*"
) -> tuple[str, str | None]:
    try:
        proc = await asyncio.create_subprocess_shell(
            f"grep -r --include={repr(file_glob)} -n {repr(pattern)} {repr(path)} 2>&1 | head -100",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        return stdout.decode(errors="replace").strip() or "(no matches)", None
    except Exception as e:
        return "", str(e)


async def _fetch_url(
    url: str, method: str = "GET", body: str = ""
) -> tuple[str, str | None]:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.request(
                method.upper(), url, content=body.encode() if body else None
            )
            return f"[{response.status_code}]\n{response.text[:10_000]}", None
    except Exception as e:
        return "", str(e)


# ── Registry ──────────────────────────────────────────────────────────────────

REGISTRY: dict[str, Tool] = {
    "bash": Tool(
        name="bash",
        description="Run a shell command. Returns stdout and stderr.",
        risk="elevated",
        schema={
            "name": "bash",
            "description": "Execute a shell command.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run"},
                    "timeout": {"type": "integer", "description": "Timeout seconds (default 30)"},
                },
                "required": ["command"],
            },
        },
        fn=_bash,
    ),
    "read_file": Tool(
        name="read_file",
        description="Read the full contents of a file.",
        risk="safe",
        schema={
            "name": "read_file",
            "description": "Read a file's contents.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to read"},
                },
                "required": ["path"],
            },
        },
        fn=_read_file,
    ),
    "write_file": Tool(
        name="write_file",
        description="Write or overwrite a file with given content.",
        risk="elevated",
        schema={
            "name": "write_file",
            "description": "Write content to a file (creates or overwrites).",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to write"},
                    "content": {"type": "string", "description": "Content to write"},
                },
                "required": ["path", "content"],
            },
        },
        fn=_write_file,
    ),
    "list_dir": Tool(
        name="list_dir",
        description="List files and directories at a path.",
        risk="safe",
        schema={
            "name": "list_dir",
            "description": "List directory contents.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Path to list (default: .)"},
                },
            },
        },
        fn=_list_dir,
    ),
    "search_files": Tool(
        name="search_files",
        description="Search for a regex pattern across files.",
        risk="safe",
        schema={
            "name": "search_files",
            "description": "Search for a pattern in files.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex pattern"},
                    "path": {"type": "string", "description": "Directory to search (default: .)"},
                    "file_glob": {"type": "string", "description": "File glob filter (default: *)"},
                },
                "required": ["pattern"],
            },
        },
        fn=_search_files,
    ),
    "fetch_url": Tool(
        name="fetch_url",
        description="Make an HTTP request and return the response.",
        risk="standard",
        schema={
            "name": "fetch_url",
            "description": "Make an HTTP request.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to request"},
                    "method": {"type": "string", "description": "HTTP method (default: GET)"},
                    "body": {"type": "string", "description": "Request body (optional)"},
                },
                "required": ["url"],
            },
        },
        fn=_fetch_url,
    ),
    "remember": Tool(
        name="remember",
        description="Save a fact, preference, or note to long-term memory for future sessions.",
        risk="safe",
        schema={
            "name": "remember",
            "description": "Store something in long-term memory to recall in future conversations.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "What to remember"},
                },
                "required": ["content"],
            },
        },
        fn=_remember,
    ),
    "schedule": Tool(
        name="schedule",
        description="Schedule a reminder message to be delivered after a delay.",
        risk="safe",
        schema={
            "name": "schedule",
            "description": "Set a reminder to be sent after a specified number of minutes.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "The reminder message"},
                    "delay_minutes": {"type": "integer", "description": "Minutes until reminder fires"},
                },
                "required": ["message", "delay_minutes"],
            },
        },
        fn=_schedule,
    ),
}

TOOL_SCHEMAS = [t.schema for t in REGISTRY.values()]

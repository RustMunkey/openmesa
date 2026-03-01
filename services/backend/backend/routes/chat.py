import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.config import settings

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str = "claude-sonnet-4-6"
    provider: str = "anthropic"
    api_key: str = ""
    base_url: str = ""


def sse(data: str) -> str:
    return f"data: {data}\n\n"


async def stream_anthropic(req: ChatRequest):
    from backend.agent.runner import run

    api_key = req.api_key or settings.anthropic_api_key
    if not api_key:
        yield sse(json.dumps({"error": "No Anthropic API key configured. Add it in Settings."}))
        return

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    async for event in run(messages, req.model, api_key):
        yield sse(json.dumps(event))


async def stream_openai(req: ChatRequest):
    from backend.agent.runner_openai_compat import run

    api_key = req.api_key or settings.openai_api_key
    if not api_key:
        yield sse(json.dumps({"error": "No OpenAI API key configured. Add it in Settings."}))
        return

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    async for event in run(messages, req.model, api_key, "https://api.openai.com/v1"):
        yield sse(json.dumps(event))


async def stream_ollama(req: ChatRequest):
    from backend.agent.runner_openai_compat import run

    base_url = req.base_url or settings.ollama_base_url
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    async for event in run(messages, req.model, "ollama", f"{base_url}/v1"):
        yield sse(json.dumps(event))


async def stream_openclaw(req: ChatRequest):
    import httpx

    base_url = req.base_url or settings.openclaw_base_url
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{base_url}/v1/chat/completions",
                json={"model": req.model, "messages": messages, "stream": True},
            ) as response:
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        yield sse(json.dumps({"done": True}))
                        return
                    data = json.loads(payload)
                    delta = data["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield sse(json.dumps({"chunk": delta}))
    except Exception as e:
        yield sse(json.dumps({"error": str(e)}))


STREAMERS = {
    "anthropic": stream_anthropic,
    "openai": stream_openai,
    "ollama": stream_ollama,
    "openclaw": stream_openclaw,
}


@router.post("/chat")
async def chat(req: ChatRequest):
    streamer = STREAMERS.get(req.provider)
    if not streamer:
        async def unknown():
            yield sse(json.dumps({"error": f"Unknown provider: {req.provider}"}))
        return StreamingResponse(unknown(), media_type="text/event-stream")

    return StreamingResponse(
        streamer(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

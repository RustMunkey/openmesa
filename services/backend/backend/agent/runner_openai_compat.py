"""
Agent loop for OpenAI-compatible endpoints (OpenAI, Ollama, OpenClaw).
"""
import asyncio
import json
import logging
from typing import AsyncGenerator

from backend.agent import memory, security
from backend.agent.confirmations import wait_for_confirmation
from backend.agent.prompt import system_prompt
from backend.agent.tools import REGISTRY

logger = logging.getLogger(__name__)

NEEDS_CONFIRMATION = {"elevated", "dangerous", "secret"}


def _friendly_error(e: Exception) -> str:
    msg = str(e).lower()
    if "insufficient_quota" in msg or "exceeded" in msg:
        return "No API credits remaining. Add a payment method at platform.openai.com/billing."
    if "invalid_api_key" in msg or "invalid api key" in msg or "401" in msg:
        return "Invalid API key. Check your key in Settings > Integrations."
    if "rate_limit" in msg or "429" in msg:
        return "Rate limited. Wait a moment and try again."
    if "model_not_found" in msg or "does not exist" in msg:
        return "Model not available. Check the model name in Settings."
    if "connection" in msg or "connect" in msg:
        return "Could not connect to the API. Check your network and base URL."
    return str(e)

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": t.schema["name"],
            "description": t.schema["description"],
            "parameters": t.schema["input_schema"],
        },
    }
    for t in REGISTRY.values()
]


async def run(
    messages: list[dict],
    model: str,
    api_key: str,
    base_url: str,
) -> AsyncGenerator[dict, None]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key or "ollama", base_url=base_url)

    # Search memory for relevant context
    user_text = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    memories = await memory.search(user_text, k=5)

    history = [{"role": "system", "content": system_prompt(memories=memories)}, *messages]
    accumulated_response = []

    while True:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=history,
                tools=OPENAI_TOOLS,
                stream=False,
            )
        except Exception as e:
            yield {"error": _friendly_error(e)}
            return

        choice = response.choices[0]
        msg = choice.message

        if msg.content:
            chunk_size = 4
            for i in range(0, len(msg.content), chunk_size):
                chunk = msg.content[i: i + chunk_size]
                accumulated_response.append(chunk)
                yield {"chunk": chunk}

        # Track tokens if available
        if response.usage:
            asyncio.create_task(_track_tokens(
                model=model,
                provider="openai_compat",
                input_tokens=response.usage.prompt_tokens,
                output_tokens=response.usage.completion_tokens,
            ))

        if choice.finish_reason != "tool_calls" or not msg.tool_calls:
            full_response = "".join(accumulated_response)
            asyncio.create_task(memory.store_session(messages, full_response))
            yield {"done": True}
            return

        history.append(msg.model_dump())
        tool_results = []

        for tc in msg.tool_calls:
            tool = REGISTRY.get(tc.function.name)
            try:
                args = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                args = {}

            if not tool:
                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": f"Unknown tool: {tc.function.name}",
                })
                continue

            secrets = security.detect(args)
            effective_risk = "secret" if secrets else tool.risk
            needs_confirmation = effective_risk in NEEDS_CONFIRMATION

            yield {
                "tool_call": {
                    "id": tc.id,
                    "name": tc.function.name,
                    "args": args,
                    "display": tool.display(args),
                    "risk": effective_risk,
                    "requires_confirmation": needs_confirmation,
                    "secrets": secrets,
                }
            }

            if needs_confirmation:
                approved = await wait_for_confirmation(tc.id)
                if not approved:
                    yield {"tool_result": {
                        "id": tc.id, "name": tc.function.name,
                        "output": "", "error": None, "denied": True,
                    }}
                    tool_results.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": "User denied this action.",
                    })
                    continue

            output, error = await tool.execute(**args)

            yield {"tool_result": {
                "id": tc.id, "name": tc.function.name,
                "output": output, "error": error, "denied": False,
            }}

            tool_results.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": output if not error else f"Error: {error}\n{output}",
            })

        history.extend(tool_results)


async def _track_tokens(model: str, provider: str, input_tokens: int, output_tokens: int):
    try:
        from backend.db import get_pool
        async with get_pool().acquire() as conn:
            await conn.execute(
                "INSERT INTO token_usage (model, provider, input_tokens, output_tokens) "
                "VALUES ($1, $2, $3, $4)",
                model, provider, input_tokens, output_tokens,
            )
    except Exception as e:
        logger.debug(f"Token tracking error: {e}")

import asyncio
import logging
import time
from typing import AsyncGenerator

import anthropic

from backend.agent import memory, security
from backend.agent.confirmations import wait_for_confirmation
from backend.agent.prompt import system_prompt
from backend.agent.tools import REGISTRY, TOOL_SCHEMAS

logger = logging.getLogger(__name__)

NEEDS_CONFIRMATION = {"elevated", "dangerous", "secret"}


async def run(
    messages: list[dict],
    model: str,
    api_key: str,
) -> AsyncGenerator[dict, None]:
    client = anthropic.AsyncAnthropic(api_key=api_key)

    # Search memory for relevant context
    user_text = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    memories = await memory.search(user_text, k=5)

    history = list(messages)
    accumulated_response = []

    while True:
        try:
            async with client.messages.stream(
                model=model,
                max_tokens=8096,
                system=system_prompt(memories=memories),
                tools=TOOL_SCHEMAS,
                messages=history,
            ) as stream:
                async for text in stream.text_stream:
                    accumulated_response.append(text)
                    yield {"chunk": text}
                response = await stream.get_final_message()
        except anthropic.AuthenticationError:
            yield {"error": "Invalid Anthropic API key. Check your key in Settings > Integrations."}
            return
        except anthropic.RateLimitError:
            yield {"error": "Rate limited. Wait a moment and try again."}
            return
        except Exception as e:
            msg = str(e).lower()
            if "overloaded" in msg:
                err = "Anthropic API is overloaded. Try again in a moment."
            elif "credit" in msg or "billing" in msg:
                err = "No API credits remaining. Check your Anthropic billing."
            else:
                err = str(e)
            yield {"error": err}
            return

        # Track token usage (fire and forget)
        asyncio.create_task(_track_tokens(
            model=model,
            provider="anthropic",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        ))

        if response.stop_reason != "tool_use":
            # Store session memory in background
            full_response = "".join(accumulated_response)
            asyncio.create_task(memory.store_session(messages, full_response))
            yield {"done": True}
            return

        history.append({
            "role": "assistant",
            "content": [b.model_dump() for b in response.content],
        })

        tool_results = []

        for block in response.content:
            if block.type != "tool_use":
                continue

            tool = REGISTRY.get(block.name)
            if not tool:
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": f"Unknown tool: {block.name}",
                })
                continue

            args = dict(block.input)
            secrets = security.detect(args)
            effective_risk = "secret" if secrets else tool.risk
            needs_confirmation = effective_risk in NEEDS_CONFIRMATION

            yield {
                "tool_call": {
                    "id": block.id,
                    "name": block.name,
                    "args": args,
                    "display": tool.display(args),
                    "risk": effective_risk,
                    "requires_confirmation": needs_confirmation,
                    "secrets": secrets,
                }
            }

            if needs_confirmation:
                approved = await wait_for_confirmation(block.id)
                if not approved:
                    yield {"tool_result": {
                        "id": block.id, "name": block.name,
                        "output": "", "error": None, "denied": True,
                    }}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": "User denied this action.",
                    })
                    continue

            output, error = await tool.execute(**args)

            yield {"tool_result": {
                "id": block.id, "name": block.name,
                "output": output, "error": error, "denied": False,
            }}

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": output if not error else f"Error: {error}\n{output}",
            })

        history.append({"role": "user", "content": tool_results})


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

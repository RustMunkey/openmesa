import asyncio

_pending: dict[str, asyncio.Event] = {}
_results: dict[str, bool] = {}


async def wait_for_confirmation(action_id: str, timeout: int = 120) -> bool:
    event = asyncio.Event()
    _pending[action_id] = event
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return _results.get(action_id, False)
    except asyncio.TimeoutError:
        return False
    finally:
        _pending.pop(action_id, None)
        _results.pop(action_id, None)


def resolve(action_id: str, approved: bool) -> bool:
    if action_id not in _pending:
        return False
    _results[action_id] = approved
    _pending[action_id].set()
    return True

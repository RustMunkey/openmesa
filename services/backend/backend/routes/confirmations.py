from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.agent.confirmations import resolve

router = APIRouter()


class ConfirmRequest(BaseModel):
    approved: bool


@router.post("/confirm/{action_id}")
async def confirm_action(action_id: str, req: ConfirmRequest):
    ok = resolve(action_id, req.approved)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending action with that ID")
    return {"ok": True}

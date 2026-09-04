"""Agent endpoint — the transport adapter over the agent loop."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.agent.loop import answer

router = APIRouter(prefix="/api/agent", tags=["agent"])


class AskRequest(BaseModel):
    question: str
    workspace_id: str = "demo"
    verify: bool = True


@router.post("/ask")
def ask(req: AskRequest) -> dict:
    return answer(req.question, req.workspace_id, run_verify=req.verify)

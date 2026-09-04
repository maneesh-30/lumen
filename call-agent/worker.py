"""Lumen voice worker.

Joins a LiveKit room, transcribes the caller (Deepgram STT), answers from the Lumen
brain (POST /api/agent/ask — the same agent loop the web console uses), and speaks the
answer back (Deepgram TTS). The brain is reached over plain HTTP, so this worker is just
another transport into answer().

The reply is produced in `on_user_turn_completed`: when the caller finishes a turn we
take the transcript, call the brain, speak the answer, and stop the default (LLM) reply.
This needs no LLM in the session — the brain is our reasoning.
"""
import logging
import os
import re

import httpx
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    StopResponse,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, silero

load_dotenv()

BRAIN_API_URL = os.getenv("BRAIN_API_URL", "http://localhost:8000")
logger = logging.getLogger("lumen-agent")

# strip [E1] / [E1, E3] citation markers before speaking
CITE_RE = re.compile(r"\s*\[[^\]]*\]")


def _text_of(msg) -> str:
    txt = getattr(msg, "text_content", None)
    if isinstance(txt, str) and txt:
        return txt
    content = getattr(msg, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(c for c in content if isinstance(c, str))
    return ""


async def _ask_brain(question: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{BRAIN_API_URL}/api/agent/ask", json={"question": question}
        )
        return r.json().get("answer", "")


class LumenAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are Lumen, a voice assistant that answers questions about the "
                "company's codebase, grounded in real sources."
            )
        )

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        question = _text_of(new_message).strip()
        logger.info("question: %s", question)
        if not question:
            raise StopResponse()
        # immediate acknowledgement so the caller knows it heard them (plays during the search)
        ack = self.session.say("Let me check.")
        try:
            answer = await _ask_brain(question)
            spoken = CITE_RE.sub("", answer).strip() or "I don't have that in the connected sources."
        except Exception:
            logger.exception("brain call failed")
            spoken = "Sorry, I could not reach the knowledge base."
        try:
            await ack
        except Exception:
            pass
        await self.session.say(spoken)
        raise StopResponse()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    session = AgentSession(
        stt=deepgram.STT(model="nova-3"),
        tts=deepgram.TTS(model="aura-2-thalia-en"),
        vad=silero.VAD.load(),
    )
    await session.start(agent=LumenAgent(), room=ctx.room)
    await session.say("Hi, I'm Lumen. Ask me anything about the codebase.")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

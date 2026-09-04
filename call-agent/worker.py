"""Lumen voice worker.

Joins a LiveKit room, transcribes the caller (Deepgram STT), answers from the Lumen
brain (POST /api/agent/ask — the same agent loop the web console uses), and speaks the
answer back (Deepgram TTS). The brain is reached over plain HTTP, so this worker is just
another transport into answer().
"""
import logging
import os
import re

import httpx
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, silero

load_dotenv()

BRAIN_API_URL = os.getenv("BRAIN_API_URL", "http://localhost:8000")
logger = logging.getLogger("lumen-agent")

# strip [E1] / [E1, E3] citation markers before speaking
CITE_RE = re.compile(r"\s*\[[^\]]*\]")


def _text_of(item) -> str:
    content = getattr(item, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(c for c in content if isinstance(c, str))
    return ""


class LumenAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are Lumen, a voice assistant that answers questions about the "
                "company's codebase, grounded in real sources."
            )
        )

    async def llm_node(self, chat_ctx, tools, model_settings):
        # find the latest user turn
        question = ""
        for item in reversed(chat_ctx.items):
            if getattr(item, "role", None) == "user":
                question = _text_of(item).strip()
                if question:
                    break
        if not question:
            yield "Sorry, I didn't catch that."
            return

        logger.info("question: %s", question)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    f"{BRAIN_API_URL}/api/agent/ask", json={"question": question}
                )
                data = r.json()
            answer = data.get("answer", "")
            spoken = CITE_RE.sub("", answer).strip()
            yield spoken or "I don't have that in the connected sources."
        except Exception:
            logger.exception("brain call failed")
            yield "Sorry, I could not reach the knowledge base."


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

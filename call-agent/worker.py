"""Lumen voice worker.

Joins a LiveKit room, transcribes the caller (Deepgram STT), answers from the Lumen
brain (POST /api/agent/ask — the same agent loop the web console uses), speaks the
answer back (Deepgram TTS), and publishes the full result (answer + citations + trace)
to the room as a data message so the meeting UI can show the evidence live.

The reply is produced in `on_user_turn_completed`: when the caller finishes a turn we
take the transcript, call the brain, speak the answer, and stop the default (LLM) reply.
This needs no LLM in the session — the brain is our reasoning.
"""
import json
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
from livekit.plugins import deepgram, sarvam, silero

load_dotenv()

BRAIN_API_URL = os.getenv("BRAIN_API_URL", "http://localhost:8000")
VOICE_STACK = os.getenv("VOICE_STACK", "deepgram")
SARVAM_LANGUAGE = os.getenv("SARVAM_LANGUAGE", "hi-IN")
SARVAM_TTS_SPEAKER = os.getenv("SARVAM_TTS_SPEAKER", "anushka")
logger = logging.getLogger("lumen-agent")


# language code (from the room name) -> Sarvam locale + speaker
SARVAM_LOCALE = {"te": ("te-IN", "priya"), "hi": ("hi-IN", "priya")}

GREETINGS = {
    "en": "Hi, I'm Lumen. Ask me anything about the codebase.",
    "te": "నమస్తే, నేను Lumen. కోడ్‌బేస్ గురించి ఏదైనా అడగండి.",
    "hi": "नमस्ते, मैं Lumen हूँ। कोडबेस के बारे में कुछ भी पूछिए।",
}


def _lang_from_room(name: str) -> str:
    """Room names are 'lumen-<lang>-<rand>', e.g. 'lumen-te-ab12'."""
    parts = (name or "").split("-")
    if len(parts) >= 2 and parts[1] in ("en", "te", "hi"):
        return parts[1]
    return "en"


def _build_stt_tts(lang: str):
    """English -> Deepgram; Indian languages -> Sarvam."""
    if lang in SARVAM_LOCALE:
        locale, speaker = SARVAM_LOCALE[lang]
        return (
            sarvam.STT(language=locale),
            sarvam.TTS(target_language_code=locale, speaker=speaker),
        )
    return (
        deepgram.STT(model="nova-3"),
        deepgram.TTS(model="aura-2-thalia-en"),
    )

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


async def _ask_brain(question: str, language: str = "en") -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{BRAIN_API_URL}/api/agent/ask",
            json={"question": question, "verify": False, "language": language},
        )
        return r.json()


class LumenAgent(Agent):
    def __init__(self, language: str = "en") -> None:
        super().__init__(
            instructions=(
                "You are Lumen, a voice assistant that answers questions about the "
                "company's codebase, grounded in real sources."
            )
        )
        self.room = None
        self.language = language

    async def _publish(self, data: dict) -> None:
        if self.room is None:
            return
        try:
            await self.room.local_participant.publish_data(
                json.dumps(data).encode(), topic="lumen"
            )
        except Exception:
            logger.exception("publish_data failed")

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        question = _text_of(new_message).strip()
        logger.info("question: %s", question)
        if not question:
            raise StopResponse()

        # tell the UI we heard the question and are working on it
        await self._publish({"type": "thinking", "question": question})

        # immediate spoken acknowledgement (plays during the search)
        try:
            ack = self.session.say("Let me check.")
        except Exception:
            ack = None
        try:
            result = await _ask_brain(question, self.language)
            answer = result.get("answer", "")
            spoken = CITE_RE.sub("", answer).strip() or "I don't have that in the connected sources."
        except Exception:
            logger.exception("brain call failed")
            result = {"answer": "", "citations": [], "trace": []}
            spoken = "Sorry, I could not reach the knowledge base."

        # send the full result (answer + citations + trace) to the meeting UI
        await self._publish({"type": "answer", "question": question, **result})

        try:
            if ack is not None:
                await ack
        except Exception:
            pass
        try:
            await self.session.say(spoken)
        except Exception:
            logger.info("session closing; skipped speaking the answer")
        raise StopResponse()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    lang = _lang_from_room(ctx.room.name)
    try:
        await ctx.room.local_participant.set_name("Lumen")
    except Exception:
        pass
    stt, tts = _build_stt_tts(lang)
    session = AgentSession(stt=stt, tts=tts, vad=silero.VAD.load())
    agent = LumenAgent(lang)
    await session.start(agent=agent, room=ctx.room)
    agent.room = ctx.room
    await session.say(GREETINGS.get(lang, GREETINGS["en"]))


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

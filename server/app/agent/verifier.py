"""Independent verifier — a second, different model re-checks the answer.

Runs on Featherless (Qwen/Qwen2.5-7B-Instruct, a fast non-thinking model): checks whether
every claim in the draft answer is supported by its cited evidence, and returns a compact
verdict — pass / revise / abstain. Small output in the common "pass" case keeps it fast.
Falls back to OpenRouter if Featherless errors or returns unparseable output.
"""
import json
import re

from openai import OpenAI

from app.config import settings

_featherless = OpenAI(
    base_url=settings.featherless_base_url,
    api_key=settings.featherless_api_key,
    timeout=25.0,
    max_retries=0,
)
_openrouter = OpenAI(
    base_url=settings.openrouter_base_url,
    api_key=settings.openrouter_api_key,
    timeout=25.0,
    max_retries=0,
)

VERIFY_SYSTEM = """You are an independent verifier for a codebase question-answering agent.

You are given a QUESTION, a draft ANSWER (with [E#] citations), and the EVIDENCE.
Check whether every factual claim in the ANSWER is supported by its cited evidence.

Return ONLY a JSON object, no prose, no markdown:
- If every claim is supported: {"verdict": "pass"}
- If some claims are supported but others are not: {"verdict": "revise", "verified_answer": "<the answer keeping ONLY supported claims, each with its [E#] citation>"}
- If the answer is not supported by the evidence at all: {"verdict": "abstain"}

Prefer "pass" when the claims are reasonably supported by the cited evidence. Use
"revise" only when a specific claim is clearly absent from or contradicted by the
evidence, and "abstain" only when the whole answer is unsupported.

A claim is supported ONLY if its cited evidence actually states it. Never invent an
evidence id, file path, or line number.
"""


def _trim(text: str, limit: int = 300) -> str:
    return text if len(text) <= limit else text[:limit] + "…"


def _call(client: OpenAI, model: str, messages: list, max_tokens: int = 700) -> str:
    r = client.chat.completions.create(
        model=model, messages=messages, temperature=0, max_tokens=max_tokens
    )
    return (r.choices[0].message.content or "").strip()


def _parse_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def verify(question: str, draft_answer: str, evidence: list[dict]) -> dict:
    ev_block = "\n\n".join(
        f'[{e["id"]}] {e["file"]}:{e["start_line"]}-{e["end_line"]}\n{_trim(e["text"])}'
        for e in evidence
    )
    user = f"QUESTION:\n{question}\n\nANSWER:\n{draft_answer}\n\nEVIDENCE:\n{ev_block}"
    messages = [
        {"role": "system", "content": VERIFY_SYSTEM},
        {"role": "user", "content": user},
    ]

    used = settings.verify_provider
    text = ""
    try:
        if settings.verify_provider == "featherless":
            text = _call(_featherless, settings.verify_model, messages)
        else:
            text = _call(_openrouter, settings.llm_model, messages)
    except Exception:
        text = ""

    data = _parse_json(text)

    if data is None and settings.verify_provider == "featherless":
        used = "openrouter (fallback)"
        try:
            text = _call(_openrouter, settings.llm_model, messages)
            data = _parse_json(text)
        except Exception:
            data = None

    if data is None:
        # verifier unavailable — keep the draft, flag as unverified
        return {"verdict": "pass", "verified_answer": "", "provider": used, "verifier_ok": False}

    return {
        "verdict": data.get("verdict", "pass"),
        "verified_answer": data.get("verified_answer", ""),
        "provider": used,
        "verifier_ok": True,
    }

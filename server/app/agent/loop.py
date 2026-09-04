"""The Lumen agent loop — transport-agnostic.

answer(question, workspace_id) -> {answer, citations, trace, abstained}

Knows nothing about HTTP or voice. Callable from a script exactly as from a live call.
Fast path: retrieve (semantic search) -> compose a cited answer. Two round-trips.
"""
import re
import time

from openai import OpenAI

from app.agent import prompts
from app.config import settings
from app.tools.search_code import search_code

_client = OpenAI(base_url=settings.openrouter_base_url, api_key=settings.openrouter_api_key)

ABSTAIN = "I don't have that in the connected sources."


def answer(question: str, workspace_id: str = "demo", limit: int = 6) -> dict:
    trace: list[dict] = []

    # ---- retrieve ----
    t0 = time.perf_counter()
    hits = search_code(question, workspace_id, limit=limit)
    evidence = [{"id": f"E{i + 1}", **h} for i, h in enumerate(hits)]
    trace.append({
        "step": "retrieve", "query": question, "found": len(evidence),
        "ms": int((time.perf_counter() - t0) * 1000),
    })

    if not evidence:
        trace.append({"step": "compose", "result": "abstain (no evidence)"})
        return {"answer": ABSTAIN, "citations": [], "trace": trace, "abstained": True}

    # ---- compose (cited answer) ----
    ev_block = "\n\n".join(
        f'[{e["id"]}] {e["file"]}:{e["start_line"]}-{e["end_line"]}\n{e["text"]}'
        for e in evidence
    )
    compose_messages = [
        {"role": "system", "content": prompts.COMPOSE_SYSTEM},
        {"role": "user", "content": f"Question: {question}\n\nEvidence:\n{ev_block}"},
    ]
    t1 = time.perf_counter()
    resp = _client.chat.completions.create(
        model=settings.llm_model, messages=compose_messages, temperature=0
    )
    answer_text = (resp.choices[0].message.content or "").strip()
    trace.append({
        "step": "compose", "evidence_count": len(evidence),
        "ms": int((time.perf_counter() - t1) * 1000),
    })

    cited_ids: set = set()
    for group in re.findall(r"\[([^\]]+)\]", answer_text):
        cited_ids.update(re.findall(r"E\d+", group))
    cited = [e for e in evidence if e["id"] in cited_ids]

    return {
        "answer": answer_text,
        "citations": [
            {"id": c["id"], "file": c["file"],
             "start_line": c["start_line"], "end_line": c["end_line"]}
            for c in cited
        ],
        "trace": trace,
        "abstained": answer_text.lower().startswith("i don't have"),
    }

"""The Lumen agent loop — transport-agnostic.

answer(question, workspace_id) -> {answer, citations, trace, abstained}

Knows nothing about HTTP or voice. Callable from a script exactly as from a live call.
Flow: retrieve (semantic search) -> compose a cited answer -> verify (independent model).
"""
import re
import time

from openai import OpenAI

from app.agent import prompts
from app.agent.verifier import verify
from app.config import settings
from app.tools.search_code import search_code

_client = OpenAI(base_url=settings.openrouter_base_url, api_key=settings.openrouter_api_key)

ABSTAIN = "I don't have that in the connected sources."


def _citations(text: str, evidence: list[dict]) -> list[dict]:
    ids: set = set()
    for group in re.findall(r"\[([^\]]+)\]", text):
        ids.update(re.findall(r"E\d+", group))
    return [e for e in evidence if e["id"] in ids]


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

    # ---- compose (cited draft) ----
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
    draft = (resp.choices[0].message.content or "").strip()
    trace.append({
        "step": "compose", "evidence_count": len(evidence),
        "ms": int((time.perf_counter() - t1) * 1000),
    })

    # nothing to verify if the composer already abstained
    if draft.lower().startswith("i don't have"):
        trace.append({"step": "verify", "result": "skipped (draft abstained)"})
        return {"answer": ABSTAIN, "citations": [], "trace": trace, "abstained": True}

    # ---- verify (independent model) — check only the evidence the draft cited ----
    t2 = time.perf_counter()
    draft_cited = _citations(draft, evidence) or evidence
    v = verify(question, draft, draft_cited)
    verdict = v["verdict"]
    if verdict == "abstain":
        final = ABSTAIN
    elif verdict == "revise":
        final = (v["verified_answer"] or draft).strip()
    else:  # "pass" (or unverified fallback)
        final = draft
    trace.append({
        "step": "verify", "provider": v["provider"], "verdict": verdict,
        "verifier_ok": v["verifier_ok"], "ms": int((time.perf_counter() - t2) * 1000),
    })

    cited = _citations(final, evidence)
    abstained = final.lower().startswith("i don't have")

    return {
        "answer": final,
        "citations": [
            {"id": c["id"], "repo": c.get("repo"), "file": c["file"],
             "start_line": c["start_line"], "end_line": c["end_line"]}
            for c in cited
        ],
        "trace": trace,
        "abstained": abstained,
    }

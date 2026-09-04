"""The Lumen agent loop — transport-agnostic.

answer(question, workspace_id) -> {answer, citations, trace, abstained}

Knows nothing about HTTP or voice. Callable from a script exactly as from a live call.
Flow: plan (LLM calls search_code) -> gather evidence -> compose a cited answer.
"""
import json
import re

from openai import OpenAI

from app.agent import prompts
from app.config import settings
from app.tools.search_code import search_code

_client = OpenAI(base_url=settings.openrouter_base_url, api_key=settings.openrouter_api_key)

SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_code",
        "description": (
            "Semantic search over the workspace's ingested code and docs. "
            "Returns matching chunks with their file path and line numbers."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "what to search for"}
            },
            "required": ["query"],
        },
    },
}

ABSTAIN = "I don't have that in the connected sources."


def _add_evidence(evidence: list[dict], seen: set, hits: list[dict]) -> list[dict]:
    """Append new, de-duplicated hits to the evidence pool. Returns the new ones."""
    new = []
    for h in hits:
        key = (h["file"], h["start_line"], h["end_line"])
        if key in seen:
            continue
        seen.add(key)
        eid = f"E{len(evidence) + 1}"
        item = {"id": eid, **h}
        evidence.append(item)
        new.append(item)
    return new


def answer(question: str, workspace_id: str = "demo", max_tool_calls: int = 4) -> dict:
    trace: list[dict] = []
    evidence: list[dict] = []
    seen: set = set()

    # ---- plan + retrieve (tool-calling loop) ----
    messages = [
        {"role": "system", "content": prompts.PLAN_SYSTEM},
        {"role": "user", "content": question},
    ]
    for _ in range(max_tool_calls):
        resp = _client.chat.completions.create(
            model=settings.llm_model, messages=messages, tools=[SEARCH_TOOL], temperature=0
        )
        msg = resp.choices[0].message
        if not msg.tool_calls:
            break
        messages.append({
            "role": "assistant",
            "content": msg.content or None,
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ],
        })
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            query = args.get("query", question)
            hits = search_code(query, workspace_id, limit=5)
            new = _add_evidence(evidence, seen, hits)
            trace.append({"step": "search_code", "query": query, "found": len(new)})
            result = [{"id": e["id"], "file": e["file"],
                       "lines": f'{e["start_line"]}-{e["end_line"]}'} for e in new]
            messages.append({
                "role": "tool", "tool_call_id": tc.id,
                "content": json.dumps(result) if result else "no new results",
            })

    # ---- fallback: if the planner never searched, search directly ----
    if not evidence:
        hits = search_code(question, workspace_id, limit=5)
        _add_evidence(evidence, seen, hits)
        trace.append({"step": "search_code", "query": question, "found": len(evidence), "fallback": True})

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
    resp = _client.chat.completions.create(
        model=settings.llm_model, messages=compose_messages, temperature=0
    )
    answer_text = (resp.choices[0].message.content or "").strip()
    trace.append({"step": "compose", "evidence_count": len(evidence)})

    cited_ids: set = set()
    for group in re.findall(r"\[([^\]]+)\]", answer_text):
        cited_ids.update(re.findall(r"E\d+", group))
    cited = [e for e in evidence if e["id"] in cited_ids]
    abstained = answer_text.lower().startswith("i don't have")

    return {
        "answer": answer_text,
        "citations": [
            {"id": c["id"], "file": c["file"],
             "start_line": c["start_line"], "end_line": c["end_line"]}
            for c in cited
        ],
        "trace": trace,
        "abstained": abstained,
    }

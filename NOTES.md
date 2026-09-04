# Lumen — Notes & Decisions

A running log of what we built and why. Useful for the demo and for answering questions.

## P0 — Setup

**Three services, one job each**
- `client/` (Next.js) — what people see: dashboard and the live call UI.
- `server/` (FastAPI) — the "brain": it takes a question and returns a cited answer.
- `call-agent/` (LiveKit worker) — turns speech into text and the answer back into speech.

**Two data stores**
- PostgreSQL — normal records (users, workspaces, repos, meetings).
- Qdrant — vector search, so the agent can find code by *meaning*, not just keywords.

**Decisions**
- Running on **Python 3.13** (3.12 wasn't installed). The only thing that needed 3.12 was
  `voyageai`, so we dropped it and use **Gemini** for embeddings instead.
- **Neo4j** and **Redis/Celery** are deferred — not needed for the core demo. Ingestion
  runs synchronously for now.
- `gh` CLI isn't installed; we push to GitHub over HTTPS.

**Why transport-agnostic matters**
The agent loop takes a question and returns an answer, knowing nothing about *how* the
question arrived. So we can build and test the whole brain from a script first, and add
voice last — a broken microphone can never sink the demo.

## P1 — Ingestion + RAG

**What we built:** the "read a codebase once, search it instantly" pipeline.

- Ingested a real public repo (`scorp2006/BlindSpot`): cloned it, split it into **110
  line-labeled chunks**, embedded each, and stored them in Qdrant.
- **Chunking** (`app/rag/chunker.py`) — splits files into ~50-line pieces and keeps the
  file path + exact line range on each, so answers can cite a real `file:line`.
- **Embeddings + LLM both go through OpenRouter** (one key). Embedding model:
  `openai/text-embedding-3-small` (1536-dim). Text model: `google/gemini-3.5-flash-lite`.
- **Qdrant** (`app/rag/vectorstore.py`) — one collection `lumen_chunks`; every point is
  tagged with a `workspace_id` and searches filter on it, so one workspace can't read
  another's data (tenant isolation).
- **`search_code`** (`app/tools/search_code.py`) — embeds the question, searches Qdrant,
  returns the top chunks with their real `file:line`.

**Verified:** "how is audio captured" → `listen.py` / `audio.py`; "flask app" →
`webapp/server.py`. Search matches by meaning, not keywords.

## P2 — Agent loop (text)

**What we built:** the full RAG loop as one transport-agnostic function,
`answer(question, workspace_id)` in `app/agent/loop.py`.

- **Plan + retrieve** — the LLM (`gemini-3.5-flash-lite` via OpenRouter) is given the
  `search_code` tool and decides what to search, reformulating the query a few times to
  gather enough evidence.
- **Compose** — a second LLM call writes the answer using ONLY the retrieved evidence,
  citing each claim as `[E#]`, which maps to a real `file:line`.
- **Abstain** — if the evidence is unrelated, it replies "I don't have that in the
  connected sources" instead of guessing.
- Returns `{answer, citations, trace, abstained}`. The `trace` records every search and
  the compose step (this feeds the trace panel later).

**Verified with `ask_cli.py`:**
- "how does the vlm answer questions" → real answer citing `blindspot/vlm.py`.
- "what does this project do" → cites `README.md`.
- "how does stripe billing work" → abstains (not in the repo). The safe failure works.

No HTTP or voice involved — this is the exact function a live call will call.

**Latency:** the first version used a multi-step planner (~9 sequential LLM calls) and
took ~15s. Switched to a single retrieve → compose (2 round-trips): retrieve ~1.5s +
compose ~2s ≈ 4s in the warm server (the CLI adds ~3s of Python startup the server does
not have). Streaming the answer (P4/P5) will make it feel ~1s.



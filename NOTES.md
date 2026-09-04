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


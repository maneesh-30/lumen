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

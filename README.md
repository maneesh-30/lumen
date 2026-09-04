# Lumen

**An AI teammate that joins your customer calls, hears the question, and answers it from
your real code, docs and tickets — with a citation for every claim, independently
verified, and an honest "I don't have that" when there's no evidence.**

Built for HackWave 3.0.

---

## The problem

In every technical company, only one or two engineers truly know how the product works.
They get pulled into every sales call, demo, and support escalation to answer a handful
of technical questions. The answers already exist — scattered across the codebase, docs,
tickets, and old chat threads — but finding them live, while a customer waits, is slow.
And customers don't all speak the same language.

## What Lumen does

Lumen joins the call like a participant, listens, searches the company's real sources,
and speaks a grounded answer with the source shown next to it — so the expert stays in
their editor and anyone on the call gets a trustworthy, sourced answer.

## Features

- **Answers grounded in your code** — retrieval-augmented generation over an ingested
  repository (code + its docs). The same ingestion pipeline is built to take tickets and
  Slack as further sources.
- **A citation for every claim** — each answer cites the exact `file:line`; the operator
  can click it to see the source.
- **Independently verified** — a second, *different* model (Qwen on Featherless)
  re-checks every claim against the retrieved evidence. Not the same model grading
  itself. The web console runs this check inline on every answer; the voice call requests
  the fast path (`verify: false`) to keep spoken replies snappy, and shows the trace.
- **Refuses to guess** — no supporting evidence → "I don't have that in the connected
  sources", never an invented answer.
- **Joins a live call** — real WebRTC (LiveKit) with speech-to-text and text-to-speech.
- **Speaks Indian languages** — swappable voice stack (Deepgram for English, Sarvam for
  Telugu / Hindi / Tamil).
- **Operator vs customer views** — the customer hears the answer; only the company
  operator sees the code, citations and trace. Your source never shows to the customer.
- **Shows its work** — a live trace panel (retrieve → compose → verify, with timings).

## Architecture

```
client/       Next.js console + live-call UI (React, Tailwind)
server/       FastAPI "brain" — the agent loop, tools, ingestion, all HTTP APIs
call-agent/   LiveKit voice worker — STT/TTS, drives calls against server/
```

The agent loop in `server/app/agent/` is **transport-agnostic**: `answer(question,
workspace_id)` takes a question and returns a cited answer, knowing nothing about *how*
the question arrived. So it's callable identically from a script, the web console, or a
live voice call — three front doors, one brain.

**Data stores** (via `docker-compose.yml`): **Qdrant** (vector search over code/doc
chunks — every point tagged with a `workspace_id` and filtered on it) and **PostgreSQL**
(provisioned and configured for users / workspaces / meetings; the demo runs a single
workspace, so the relational layer is not yet exercised).

**The answer pipeline:** `retrieve` (embed the question, semantic-search Qdrant) →
`compose` (LLM writes a cited answer from the evidence) → `verify` (independent model
strips any unsupported claim, or abstains).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | FastAPI (Python 3.13) |
| Relational DB | PostgreSQL |
| Vector search | Qdrant |
| LLM (plan / compose) | Google Gemini via OpenRouter |
| Embeddings | OpenRouter embeddings |
| Verifier | Qwen2.5-7B on Featherless (independent model) |
| Voice / calls | LiveKit + Deepgram (English) / Sarvam (Indic) |

## Setup

**Prerequisites:** Docker, Python 3.13, Node 18+.

```bash
# 1. data stores
docker compose up -d

# 2. server (the brain)
cd server
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
cp .env.example .env        # fill in the keys (see below)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# 3. ingest a repository (once): clone it, then chunk + embed it into Qdrant
git clone --depth 1 https://github.com/scorp2006/BlindSpot.git repos_storage/BlindSpot
.venv/Scripts/python ingest_cli.py            # indexes repos_storage/BlindSpot (110 chunks)
# any public repo works: ingest_cli.py <repo_dir> <repo_name>

# 4. call agent (only for live voice calls) — separate terminal, its own venv
cd call-agent
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
cp .env.example .env        # fill in LiveKit + Deepgram/Sarvam keys
.venv/Scripts/python worker.py dev

# 5. client
cd client
npm install
cp .env.local.example .env.local
npm run dev                 # http://localhost:3000
```

Then open **http://localhost:3000** — type a question in the console, or go to
**/call** to ask by voice. For the live call use a Chromium browser (Edge or Chrome)
with microphone access allowed, and click **Sound** once to enable audio playback.

## Environment variables

- **server/.env:** `OPENROUTER_API_KEY` (LLM + embeddings), `FEATHERLESS_API_KEY`
  (verifier), `POSTGRES_*`, `QDRANT_HOST/PORT`, `GITHUB_TOKEN` (optional, public repos).
- **call-agent/.env:** `LIVEKIT_URL/API_KEY/API_SECRET`, `DEEPGRAM_API_KEY`,
  `VOICE_STACK` (`deepgram` | `sarvam`), `SARVAM_API_KEY` + `SARVAM_LANGUAGE` for Indic.
- **client/.env.local:** `NEXT_PUBLIC_BRAIN_API_URL`, `NEXT_PUBLIC_LIVEKIT_URL`,
  `LIVEKIT_API_KEY/SECRET` (server-side token minting only).

Secrets live only in `.env` files, which are gitignored. See each `.env.example`.

## Scope & future work

- Voice quality depends on a stable network (LiveKit is real-time).
- Indic answers are spoken in-language but composed in English; full in-language answers
  (translation while preserving identifiers) are the next step. The win today is
  understanding the caller's spoken language.
- Agent endpoints are unauthenticated in this demo build; auth + per-workspace scoping is
  the next step before real customer data.
- More live connectors (Slack, Jira, Notion, Datadog) run through the same ingestion
  pipeline — currently demonstrated with indexed code + docs.

## Repository notes

See [DEMO.md](DEMO.md) for the demo script, [PLAN.md](PLAN.md) for the phased build
plan, and [NOTES.md](NOTES.md) for the decisions made along the way.

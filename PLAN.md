# Lumen — Build Plan

Hard submission deadline: **06:00, 5 Sep 2026.** Internal code freeze **04:30**, submit by **05:30**.

## What we are building

A voice AI agent that joins a call, hears a question, searches the company's real
code / docs / tickets / Slack, and speaks back a grounded, cited answer in about two
seconds — and refuses to answer (instead of guessing) when it has no evidence.

## Stack

- **client/** — Next.js console + live call UI
- **server/** — FastAPI brain (transport-agnostic agent loop, tools, ingestion, APIs)
- **call-agent/** — LiveKit voice worker (STT/TTS)
- **PostgreSQL** — relational data · **Qdrant** — vector search
- **OpenRouter** — planning / compose / vision LLM calls
- **Gemini** — embeddings (text-embedding model)
- **Featherless** — the verifier step (`Qwen/Qwen3-8B`), an independent open model
- **Deepgram / Sarvam** — voice (STT + TTS)

Running on Python 3.13. (voyageai dropped — no 3.13 wheel — embeddings use Gemini.)

## Phases

Each phase ends in a working, demoable state and its own commits.

- **P0 — Setup + infra.** Git, repo scaffold, data stores up, FastAPI `/health`, Next.js
  loading. No app logic yet.
- **P1 — Ingestion + RAG.** Clone a real public repo, chunk it, embed it into Qdrant,
  and build a `search_code` tool. Plus a small mock/seed corpus for the other sources.
- **P2 — Agent loop (text).** `answer(question, workspace_id)` → plan → call tools →
  gather evidence → compose a cited answer. Tested from a script, no voice.
- **P3 — Verifier + abstain.** A second pass that strips uncited claims and abstains
  when there is no evidence. Runs on Featherless (independent open model).
- **P4 — HTTP + web UI.** `POST /api/agent/ask` and a Next.js page showing the answer,
  clickable citations, a code sidebar, and a live trace panel.
- **P5 — Voice.** LiveKit room + Deepgram STT/TTS: speak a question, hear a cited answer.
- **P6 — Room realism.** Admission flow (knock / server-verified join) and full room
  transcription (per-speaker). Admission takes priority.
- **P7 — Polish + submit.** Seed data, a scripted demo, a backup recording, final push,
  submit before 05:30.

## Deferred / stretch (only if ahead)

Indic voice (Sarvam), richer trace timings, screen-share vision, the code→commit→ticket
→PR→Slack "why" chain (Neo4j), a second real connector, async ingestion (Celery/Redis),
auth hardening, GitHub App for private repos.

## Working rules

- Commit incrementally with real messages; push often (no single bulk push).
- Understand and own every part — able to explain each file to the jury.
- Keep secrets out of git (`.env` is ignored).

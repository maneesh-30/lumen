# Lumen

Lumen is a voice AI agent that joins a call, hears a spoken question, and answers it
from a company's real code, docs, tickets and Slack — grounded in the actual sources,
with a clickable citation behind every claim, and an honest "I don't have that" when
there is no evidence.

Built for HackWave 3.0.

## Architecture

- `client/` — Next.js console: dashboard, sources, and the live call UI.
- `server/` — FastAPI "brain": the agent loop, tools, ingestion, and all APIs.
- `call-agent/` — LiveKit voice worker: speech-to-text, text-to-speech, call orchestration.

The agent loop in `server/` is transport-agnostic: it takes a question and returns a
cited answer, so it is callable from a script exactly as it is from a live call.

## Data stores (via docker-compose)

- **PostgreSQL** — users, workspaces, repos, meetings.
- **Qdrant** — vector search over code chunks, docs, tickets, and Slack.

## Status

Work in progress. See [PLAN.md](PLAN.md) for the phase-by-phase build plan and
[NOTES.md](NOTES.md) for decisions.

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

## P3 — Verifier (independent, on Featherless)

**What we built:** a second, independent model re-checks the answer before it is final
(`app/agent/verifier.py`).

- After compose, the draft answer + the evidence it cited go to Featherless
  (`Qwen/Qwen2.5-7B-Instruct`, a fast non-thinking model).
- It returns a compact verdict: `pass` (all claims supported), `revise` (rewrite keeping
  only supported claims), or `abstain` (nothing supported).
- If Featherless errors or returns unparseable output, it falls back to OpenRouter, so
  the demo never breaks. Verify is skipped when the composer already abstained.

**Why a different model:** the composer is Gemini; the verifier is an open Qwen model on
Featherless — a second, independent model checks the first, not the same model grading
itself. (Also satisfies the "use Featherless" requirement.)

**Latency story (worth telling):** the first attempt was slow — Qwen3-8B's "thinking"
tokens (~14s) plus truncated rewrites causing fallbacks. Fixed by: switching to the
non-thinking Qwen2.5-7B-Instruct, biasing the verdict toward `pass` (tiny output),
sending only the *cited* evidence, and using timeouts with no retries. Verify is now
~2.4s on the common `pass` path (was 14s). Next: make it non-blocking in the UI (show the
answer, then a "verified" badge) so it never adds to perceived latency.

**Verified:** real questions pass with citations; "stripe billing" abstains (verify
skipped). Every remaining claim is checked by the second model.

## P4 — HTTP + web console

**What we built:** the browser demo — two endpoints and a Next.js console.

- `POST /api/agent/ask` (`app/routers/agent.py`) — the HTTP adapter over the same
  `answer()` the CLI uses. Returns `{answer, citations, trace, abstained}`.
- `GET /api/code` (`app/routers/code.py`) — returns a slice of a source file (plus a few
  lines of context) for the code sidebar; refuses any path outside the repos folder.
- Console (`client/src/app/page.tsx`):
  - question box + example chips,
  - answer with inline **clickable [E#] citations** and a **verified / abstained** badge,
  - a **sources** list,
  - a **trace panel** (retrieve / compose / verify + timings + verdict),
  - a **code sidebar** showing the real file at the cited lines, highlighted.

Same brain as the CLI — the web page is just another transport into `answer()`.

**Verified in the browser:** "how does the VLM answer questions" → answer with clickable
citations, verify verdict shown, and clicking `[E1]` opened `webapp/server.py` at the
cited lines.

## P5 — Voice (LiveKit + Deepgram)

**What we built:** speak a question, hear the cited answer.

- **`call-agent/worker.py`** — a LiveKit Agents worker (livekit-agents 1.7). It joins the
  room, transcribes the caller with Deepgram STT (nova-3), and speaks with Deepgram TTS
  (aura-2). Silero VAD + LiveKit's turn detector decide when the caller has finished.
- The answer comes from the **same brain**: the worker overrides `llm_node` to POST the
  transcript to `/api/agent/ask` and speak the returned answer (citation markers stripped
  for speech). Voice is just another transport into `answer()`.
- **`client/src/app/api/livekit-token/route.ts`** — mints a LiveKit token server-side; the
  API secret never reaches the browser.
- **`client/src/app/call/page.tsx`** — the call UI: join, mic, an audio visualizer, and
  the agent state (listening / thinking / speaking).

**Verified:** joining the room dispatched the worker; the agent connected Deepgram STT +
TTS, spoke its greeting ("Hi, I'm Lumen…"), and entered listening. (Actual speaking is
tested on a real mic — an automated browser blocks mic capture.)

## P6 — Full meeting UI

- The worker publishes each result (`{question, answer, citations, trace}`) to the room
  as a LiveKit data message; the call page renders it live.
- The call page uses LiveKit's prebuilt `VideoConference` (participant grid + its native
  control bar — mic / camera / screen-share / leave) plus a right-hand **evidence sidebar**
  (trace / sources / code). We tried a custom control bar with manual mic handling and
  reverted it: the native bar publishes the mic far more reliably.
- **Operator ⇄ Customer toggle:** operator sees the evidence; customer sees only the
  conversation. The customer never sees the code.

## Polish

- **Theme:** Claude-style warm premium look — cream background, clay accent, Fraunces
  serif headings. Call join screen is a dark cinematic hero.
- **Voice latency:** the voice path calls the brain with `verify=false` for speed
  (~5–6s); the web console keeps full verification. A concise-answer cap keeps replies
  short and spoken-friendly.
- **Sarvam (Indic voice):** `VOICE_STACK=sarvam` swaps STT+TTS to Sarvam
  (`bulbul:v3`, speaker `priya`, `te-IN`) for Telugu/Hindi/Tamil. Deepgram stays the
  English default.
- **Network learning:** live voice depends on a stable connection to LiveKit Cloud —
  flaky Wi-Fi drops the worker's socket (`1006`) and STT lags. The console has no such
  dependency and is the reliable demo path.

## Rules compliance

Built during the event; incremental commit history throughout; secrets kept out of git
(`.env` gitignored, `.env.example` committed); the human authored the commits with Claude
as a co-author, understanding and owning the code.



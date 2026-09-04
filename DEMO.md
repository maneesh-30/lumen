# Lumen — Demo Script & Jury Notes

A tight script for the pitch, plus the talking points and likely Q&A.

## One-liner

> "Lumen is an AI teammate that joins your customer calls, hears the question, and
> answers from your own code and docs — with a citation for every claim, independently
> verified, and an honest 'I don't know' when it isn't sure."

## The problem (10 seconds)

Every tech company has one or two engineers who actually know how the product works.
They get pulled into every sales and support call to answer a few technical questions.
The answers already exist — in the code, docs, tickets — but finding them live, while a
customer waits, is slow. And customers don't all speak the same language.

## Demo flow

Run order — lead with the console (rock-solid), then the call.

### 1. The console (`/`) — the trust story

1. Ask: **"What does this project do?"** → grounded answer appears with **[E#] citations**
   and a **✓ verified** badge.
2. Click a citation → the **code panel** shows the exact `file:line` it came from.
3. Point at the **trace panel**: retrieve → compose → **verify** (Featherless) with timings.
4. Ask something the repo can't answer: **"How does Stripe billing work?"** → it
   **abstains**: *"I don't have that in the connected sources."*
   - Say: *"That refusal is the point — it never invents an answer to face a customer with."*

### 2. The live call (`/call`) — the product

1. Join → the Meet-style room. Ask a question **out loud**.
2. Lumen says *"Let me check"*, then speaks the grounded answer.
3. Flip **Operator → Customer**:
   - Say: *"This is what the **customer** sees — just the conversation. No code."*
   - Flip back: *"This is what the **company rep** sees — the citations, code and trace,
     so they can trust the answer before relaying it. The customer never sees your source."*
4. (If Sarvam is on) Ask a question **in Telugu/Hindi** → it understands and answers in an
   Indian voice.

## Key talking points

- **Why it's not just ChatGPT:** ChatGPT answers from memory and hallucinates. Lumen
  retrieves *your* real sources, cites every claim, verifies with a second model, and
  refuses when it has no evidence.
- **Why citations for the rep:** an AI answer with no source is a liability you can't
  repeat to a paying customer. The citation lets the rep verify it's real in a glance —
  or catch a stale source and correct it live. It's the receipt that makes it safe.
- **Why a second model:** the composer is Gemini; the verifier is an open Qwen model on
  Featherless. A different, independent model checks the first — not the same model
  grading itself.
- **The moat:** anyone can wire an LLM to Slack. Making it answer *only* from real
  sources, prove it, and refuse to lie is the work.

## Likely jury Q&A

- **"How do you stop hallucination?"** — verifier pass + three hard rules: no uncited
  claim, abstain over guess, never fabricate a locator.
- **"Data isolation across customers?"** — every chunk is tagged with a workspace id and
  searches filter on it; the agent never chooses the workspace.
- **"Latency?"** — ~a few seconds; retrieve + compose, verify runs independently.
- **"What's genuinely hard here?"** — grounded, cited answers that a second model
  verifies, delivered live in a call.

## Honest limitations (say these — it builds trust)

- Voice needs a stable network (real-time WebRTC).
- Indic: understands and speaks the language, but composes the answer in English
  (translation is future work).
- Agent endpoints are unauthenticated in this demo build.

## Backup

A recorded screen capture of a working console query + one voice call is saved as
insurance in case the venue network is unstable during the live demo.

"use client";

import { useMemo, useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_BRAIN_API_URL ?? "http://localhost:8000";

type Citation = {
  id: string;
  repo: string | null;
  file: string;
  start_line: number;
  end_line: number;
};
type TraceStep = Record<string, unknown>;
type AnswerResp = {
  answer: string;
  citations: Citation[];
  trace: TraceStep[];
  abstained: boolean;
};
type CodeLine = { n: number; text: string };
type CodeResp = { repo: string; path: string; start: number; end: number; lines: CodeLine[] };

const EXAMPLES = [
  "What does this project do?",
  "How does the VLM answer questions?",
  "How is audio classified?",
  "How does the web server work?",
  "How does Stripe billing work?",
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<AnswerResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<CodeResp | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const citById = useMemo(() => {
    const m = new Map<string, Citation>();
    resp?.citations.forEach((c) => m.set(c.id, c));
    return m;
  }, [resp]);

  const verifyStep = resp?.trace.find((t) => t.step === "verify");
  const verdict = verifyStep?.verdict as string | undefined;

  async function ask(q?: string) {
    const query = (q ?? question).trim();
    if (!query) return;
    setQuestion(query);
    setLoading(true);
    setError(null);
    setResp(null);
    setCode(null);
    setActiveId(null);
    try {
      const r = await fetch(`${API}/api/agent/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!r.ok) throw new Error(`server ${r.status}`);
      setResp(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "request failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadCode(id: string) {
    const c = citById.get(id);
    if (!c || !c.repo) return;
    setActiveId(id);
    setCodeLoading(true);
    try {
      const url = `${API}/api/code?repo=${encodeURIComponent(c.repo)}&path=${encodeURIComponent(
        c.file,
      )}&start=${c.start_line}&end=${c.end_line}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`code ${r.status}`);
      setCode(await r.json());
    } catch {
      setCode(null);
    } finally {
      setCodeLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* header */}
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Lumen</h1>
          <p className="text-sm text-neutral-500">
            Ask about the codebase — grounded, cited, and independently verified.
          </p>
        </header>

        {/* ask bar */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask a question about the codebase…"
            className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm outline-none focus:border-neutral-600"
          />
          <button
            onClick={() => ask()}
            disabled={loading}
            className="rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>

        {/* examples */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error} — is the server running on {API}?
          </p>
        )}

        {/* results */}
        {resp && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* left: answer */}
            <section className="space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Answer
                  </span>
                  {resp.abstained ? (
                    <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
                      abstained · no evidence
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
                      ✓ verified{verdict === "revise" ? " (revised)" : ""}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                  <AnswerText
                    text={resp.answer}
                    onCite={loadCode}
                    activeId={activeId}
                  />
                </div>
              </div>

              {resp.citations.length > 0 && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Sources
                  </div>
                  <ul className="space-y-1">
                    {resp.citations.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => loadCode(c.id)}
                          className={`w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-neutral-800 ${
                            activeId === c.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-400"
                          }`}
                        >
                          <span className="text-emerald-400">[{c.id}]</span> {c.file}:
                          {c.start_line}-{c.end_line}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* right: trace + code */}
            <section className="space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Trace
                </div>
                <ol className="space-y-2">
                  {resp.trace.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 font-mono text-xs">
                      <span className="w-16 text-neutral-500">{String(t.step)}</span>
                      <span className="flex-1 text-neutral-300">
                        {formatTrace(t)}
                      </span>
                      {typeof t.ms === "number" && (
                        <span className="text-neutral-500">{t.ms as number}ms</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Code {code && <span className="text-neutral-600">· {code.path}</span>}
                </div>
                {codeLoading ? (
                  <p className="text-xs text-neutral-500">loading…</p>
                ) : code ? (
                  <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs leading-relaxed">
                    {code.lines.map((l) => {
                      const hot = l.n >= code.start && l.n <= code.end;
                      return (
                        <div
                          key={l.n}
                          className={hot ? "bg-emerald-950/40" : ""}
                        >
                          <span className="mr-3 inline-block w-8 select-none text-right text-neutral-600">
                            {l.n}
                          </span>
                          <span className="text-neutral-300">{l.text || " "}</span>
                        </div>
                      );
                    })}
                  </pre>
                ) : (
                  <p className="text-xs text-neutral-600">
                    Click a citation to see the source.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function AnswerText({
  text,
  onCite,
  activeId,
}: {
  text: string;
  onCite: (id: string) => void;
  activeId: string | null;
}) {
  const clean = text.replace(/\*\*/g, "");
  const nodes: ReactNode[] = [];
  const regex = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(clean)) !== null) {
    if (m.index > last) nodes.push(<span key={k++}>{clean.slice(last, m.index)}</span>);
    const ids = m[1].match(/E\d+/g) ?? [];
    if (ids.length) {
      nodes.push(
        <span key={k++} className="text-neutral-500">
          [
          {ids.map((id, i) => (
            <span key={id}>
              <button
                onClick={() => onCite(id)}
                className={`font-medium hover:underline ${
                  activeId === id ? "text-emerald-300" : "text-emerald-400"
                }`}
              >
                {id}
              </button>
              {i < ids.length - 1 ? ", " : ""}
            </span>
          ))}
          ]
        </span>,
      );
    } else {
      nodes.push(<span key={k++}>{m[0]}</span>);
    }
    last = regex.lastIndex;
  }
  if (last < clean.length) nodes.push(<span key={k++}>{clean.slice(last)}</span>);
  return <>{nodes}</>;
}

function formatTrace(t: TraceStep): string {
  const step = t.step;
  if (step === "retrieve") return `found ${String(t.found)} chunks`;
  if (step === "compose") return `${String(t.evidence_count)} evidence`;
  if (step === "verify") {
    if (t.result) return String(t.result);
    return `${String(t.provider)} · ${String(t.verdict)}`;
  }
  return "";
}

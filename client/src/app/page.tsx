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

  const verdict = resp?.trace.find((t) => t.step === "verify")?.verdict as string | undefined;

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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted">Lumen</span>
          </div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Ask your codebase.</h1>
          <p className="mt-2 max-w-xl text-muted">
            Grounded answers with a citation for every claim, independently verified — and an
            honest &quot;I don&apos;t have that&quot; when there&apos;s no evidence.
          </p>
        </header>

        {/* ask bar */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask a question about the codebase…"
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={() => ask()}
            disabled={loading}
            className="cursor-pointer rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#b0512f] disabled:opacity-50"
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
              className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error} — is the server running on {API}?
          </p>
        )}

        {resp && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* left: answer */}
            <section className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-muted">Answer</span>
                  {resp.abstained ? (
                    <Badge tone="amber">abstained · no evidence</Badge>
                  ) : (
                    <Badge tone="green">✓ verified{verdict === "revise" ? " (revised)" : ""}</Badge>
                  )}
                </div>
                <div className="text-[15px] leading-relaxed text-foreground">
                  <AnswerText text={resp.answer} onCite={loadCode} activeId={activeId} />
                </div>
              </div>

              {resp.citations.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Sources</div>
                  <ul className="space-y-1">
                    {resp.citations.map((c) => (
                      <li key={c.id}>
                        <button
                          onClick={() => loadCode(c.id)}
                          className={`w-full cursor-pointer rounded-lg px-2 py-1.5 text-left font-mono text-xs transition-colors hover:bg-surface-2 ${
                            activeId === c.id ? "bg-surface-2 text-foreground" : "text-muted"
                          }`}
                        >
                          <span className="text-accent">[{c.id}]</span> {c.file}:{c.start_line}-{c.end_line}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* right: trace + code */}
            <section className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">Trace</div>
                <ol className="space-y-2">
                  {resp.trace.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 font-mono text-xs">
                      <span className="w-16 text-muted">{String(t.step)}</span>
                      <span className="flex-1 text-foreground/80">{formatTrace(t)}</span>
                      {typeof t.ms === "number" && <span className="text-muted">{t.ms as number}ms</span>}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
                <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">
                  Code {code && <span className="text-foreground/40">· {code.path}</span>}
                </div>
                {codeLoading ? (
                  <p className="text-xs text-muted">loading…</p>
                ) : code ? (
                  <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs leading-relaxed">
                    {code.lines.map((l) => {
                      const hot = l.n >= code.start && l.n <= code.end;
                      return (
                        <div key={l.n} className={hot ? "bg-accent-soft" : ""}>
                          <span className="mr-3 inline-block w-8 select-none text-right text-muted">{l.n}</span>
                          <span className="text-foreground/90">{l.text || " "}</span>
                        </div>
                      );
                    })}
                  </pre>
                ) : (
                  <p className="text-xs text-muted">Click a citation to see the source.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Badge({ tone, children }: { tone: "green" | "amber"; children: ReactNode }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
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
        <span key={k++} className="text-muted">
          [
          {ids.map((id, i) => (
            <span key={id}>
              <button
                onClick={() => onCite(id)}
                className={`cursor-pointer font-medium hover:underline ${
                  activeId === id ? "text-[#b0512f]" : "text-accent"
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

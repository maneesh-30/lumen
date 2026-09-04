"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  useConnectionState,
  useDataChannel,
  useRoomContext,
} from "@livekit/components-react";
import { useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_BRAIN_API_URL ?? "http://localhost:8000";

type Citation = { id: string; repo: string | null; file: string; start_line: number; end_line: number };
type TraceStep = Record<string, unknown>;
type CodeLine = { n: number; text: string };
type CodeResp = { repo: string; path: string; start: number; end: number; lines: CodeLine[] };
type Conn = { token: string; url: string };

export default function CallPage() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const r = await fetch("/api/livekit-token?room=lumen-demo");
      if (!r.ok) throw new Error(`token ${r.status}`);
      setConn(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to get token");
      setJoining(false);
    }
  }

  if (!conn) {
    return (
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#14110d] text-[#f5f1e8]">
        {/* dotted grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        {/* warm radial glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/4 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,100,66,0.30) 0%, rgba(201,100,66,0.08) 32%, transparent 62%)",
            filter: "blur(20px)",
          }}
        />

        {/* top bar */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6">
          <span className="text-sm font-medium tracking-[0.3em]">LUMEN</span>
          <span className="text-xs uppercase tracking-[0.3em] text-[#a8a196]">Live Call</span>
        </nav>

        {/* hero */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-8 sm:px-16">
          <p className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-[#c9a08c]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e07a57]" />
            Grounded · Cited · Verified
          </p>
          <h1 className="font-serif text-6xl font-light leading-[0.95] tracking-[0.04em] sm:text-8xl">
            LUMEN
          </h1>
          <div className="mt-8 max-w-xl space-y-1 text-[#b8b0a4] sm:text-lg">
            <p>An AI teammate that joins your call and answers from your codebase.</p>
            <p>Every claim cited to real code and independently verified — or it says it doesn&apos;t know.</p>
          </div>
          <button
            onClick={join}
            disabled={joining}
            className="group mt-10 flex w-fit cursor-pointer items-center gap-3 border-b border-white/30 pb-2 text-sm uppercase tracking-[0.25em] transition-colors hover:border-[#e07a57] disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join the call"}
            <span className="transition-transform group-hover:translate-x-1">↓</span>
          </button>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video={false}
      data-lk-theme="default"
      className="h-screen bg-background text-foreground"
      onError={(e) => setError(e.message)}
      onDisconnected={() => setConn(null)}
    >
      <Meeting />
    </LiveKitRoom>
  );
}

function Meeting() {
  const room = useRoomContext();
  const roomState = useConnectionState();

  const [view, setView] = useState<"operator" | "customer">("operator");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [thinking, setThinking] = useState(false);
  const [code, setCode] = useState<CodeResp | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useDataChannel("lumen", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "thinking") {
        setThinking(true);
      } else if (data.type === "answer") {
        setThinking(false);
        setCitations(data.citations ?? []);
        setTrace(data.trace ?? []);
        setCode(null);
        setActiveId(null);
      }
    } catch {
      /* ignore */
    }
  });

  const isOperator = view === "operator";
  const status = roomState !== "connected" ? "connecting" : thinking ? "thinking" : "live";

  async function enableSound() {
    try {
      await room.startAudio();
    } catch {
      /* ignore */
    }
  }

  async function loadCode(id: string) {
    const c = citations.find((x) => x.id === id);
    if (!c || !c.repo) return;
    setActiveId(id);
    try {
      const url = `${API}/api/code?repo=${encodeURIComponent(c.repo)}&path=${encodeURIComponent(
        c.file,
      )}&start=${c.start_line}&end=${c.end_line}`;
      const r = await fetch(url);
      setCode(r.ok ? await r.json() : null);
    } catch {
      setCode(null);
    }
  }

  return (
    <div className="flex h-screen">
      {/* LiveKit prebuilt meeting UI */}
      <div className="relative flex-1 bg-neutral-950">
        <VideoConference />

        {/* floating status + sound + view toggle — over the video, not the sidebar */}
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === "thinking"
              ? "bg-amber-100 text-amber-800"
              : status === "live"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {status === "thinking" ? "● Lumen thinking…" : status === "live" ? "● live" : "connecting…"}
        </span>
        <button
          onClick={enableSound}
          className="cursor-pointer rounded-full bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-[#b0512f]"
        >
          🔊 Sound
        </button>
        <div className="flex rounded-full border border-border bg-surface p-0.5 text-xs shadow-sm">
          {(["operator", "customer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`cursor-pointer rounded-full px-3 py-1 capitalize ${
                view === v ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* evidence sidebar (operator only) */}
      {isOperator && (
        <aside className="flex w-[32%] min-w-[320px] flex-col gap-3 overflow-y-auto border-l border-border bg-background p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted">Evidence</div>
            <p className="text-xs text-muted/80">What Lumen grounded its last answer in.</p>
          </div>

          <Panel title="Trace">
            {trace.length === 0 ? (
              <p className="text-xs text-muted">Runs after a question.</p>
            ) : (
              <ol className="space-y-1.5">
                {trace.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-14 text-muted">{String(t.step)}</span>
                    <span className="flex-1 text-foreground/80">{formatTrace(t)}</span>
                    {typeof t.ms === "number" && <span className="text-muted">{t.ms as number}ms</span>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Sources">
            {citations.length === 0 ? (
              <p className="text-xs text-muted">Citations appear here.</p>
            ) : (
              <ul className="space-y-1">
                {citations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => loadCode(c.id)}
                      className={`w-full cursor-pointer rounded-lg px-2 py-1 text-left font-mono text-xs transition-colors hover:bg-surface-2 ${
                        activeId === c.id ? "bg-surface-2 text-foreground" : "text-muted"
                      }`}
                    >
                      <span className="text-accent">[{c.id}]</span> {c.file}:{c.start_line}-{c.end_line}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Code${code ? ` · ${code.path}` : ""}`} grow>
            {code ? (
              <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs leading-relaxed">
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
          </Panel>
        </aside>
      )}
    </div>
  );
}

function Panel({ title, grow, children }: { title: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-3 shadow-sm ${grow ? "flex-1" : ""}`}>
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">{title}</div>
      {children}
    </div>
  );
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

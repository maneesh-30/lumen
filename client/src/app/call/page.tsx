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
      // unique room per join — a reused room keeps the old draining agent and no new one is dispatched
      const room = `lumen-${Math.random().toString(36).slice(2, 8)}`;
      const r = await fetch(`/api/livekit-token?room=${room}`);
      if (!r.ok) throw new Error(`token ${r.status}`);
      setConn(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to get token");
      setJoining(false);
    }
  }

  if (!conn) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#04060c] px-6 text-[#e8f3ff]">
        {/* starfield — two drifting, twinkling layers */}
        <div
          className="pointer-events-none absolute inset-0 animate-[lumen-drift_90s_linear_infinite] opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1.5px), radial-gradient(rgba(186,230,253,0.9) 1px, transparent 1.6px)",
            backgroundSize: "110px 110px, 190px 190px",
            backgroundPosition: "0 0, 60px 40px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 animate-[lumen-twinkle_5s_ease-in-out_infinite]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1.6px)",
            backgroundSize: "260px 260px",
            backgroundPosition: "130px 90px",
          }}
        />

        {/* orbit ring with a travelling satellite dot */}
        <div className="pointer-events-none absolute left-1/2 top-[68%] h-[120vmax] w-[120vmax] animate-[lumen-orbit_28s_linear_infinite] rounded-full border border-cyan-300/15">
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_14px_4px_rgba(125,211,252,0.8)]" />
        </div>

        {/* the light — glowing planet horizon */}
        <div
          className="pointer-events-none absolute left-1/2 top-[70%] h-[200vmax] w-[200vmax] -translate-x-1/2 animate-[lumen-glow_6s_ease-in-out_infinite] rounded-full bg-[#04060c]"
          style={{
            boxShadow:
              "0 -2px 0 rgba(186,230,253,0.95), 0 -18px 40px rgba(56,189,248,0.55), 0 -60px 140px rgba(56,189,248,0.35), 0 -140px 320px rgba(14,165,233,0.22)",
          }}
        />

        {/* content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="mb-5 flex animate-[lumen-rise_0.8s_ease-out_both] items-center gap-2 text-[11px] uppercase tracking-[0.45em] text-cyan-300/90">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.8)]" />
            Live call
          </p>
          <h1 className="animate-[lumen-rise_0.9s_ease-out_both] text-4xl font-light uppercase leading-[1.05] tracking-[0.18em] sm:text-6xl md:text-7xl [animation-delay:120ms]">
            Welcome to
            <br />
            <span className="font-semibold text-cyan-300 [text-shadow:0_0_24px_rgba(34,211,238,0.55)]">
              Lumen
            </span>
          </h1>
          <p className="mt-7 max-w-lg animate-[lumen-rise_0.9s_ease-out_both] text-sm leading-relaxed text-[#9fb7cc] sm:text-base [animation-delay:260ms]">
            An AI teammate that joins your call and answers from your codebase.
            <br />
            Every claim cited to real code and independently verified — or it says it
            doesn&apos;t know.
          </p>
          <button
            onClick={join}
            disabled={joining}
            className="mt-10 animate-[lumen-rise_0.9s_ease-out_both] rounded-full bg-cyan-300 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#04060c] shadow-[0_0_30px_rgba(34,211,238,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_0_56px_rgba(34,211,238,0.85)] disabled:opacity-50 [animation-delay:400ms]"
          >
            {joining ? "Joining…" : "Join the call"}
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
      className="h-screen bg-neutral-950 text-neutral-100"
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
      {/* LiveKit prebuilt meeting UI (70%) */}
      <div className="relative flex-1">
        <VideoConference />

        {/* floating status + view toggle + sound — anchored to the video pane, clear of the sidebar */}
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            status === "thinking"
              ? "bg-amber-500/20 text-amber-300"
              : status === "live"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-neutral-700 text-neutral-300"
          }`}
        >
          {status === "thinking" ? "● Lumen thinking…" : status === "live" ? "● live" : "connecting…"}
        </span>
        <button
          onClick={enableSound}
          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          🔊 Sound
        </button>
        <div className="flex rounded-full border border-neutral-700 bg-neutral-900/80 p-0.5 text-xs">
          {(["operator", "customer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 capitalize ${
                view === v ? "bg-neutral-100 text-neutral-900" : "text-neutral-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* evidence sidebar (30%, operator only) */}
      {isOperator && (
        <aside className="flex w-[32%] min-w-[320px] flex-col gap-3 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Evidence</div>
            <p className="text-xs text-neutral-600">What Lumen grounded its last answer in.</p>
          </div>

          <Panel title="Trace">
            {trace.length === 0 ? (
              <p className="text-xs text-neutral-600">Runs after a question.</p>
            ) : (
              <ol className="space-y-1.5">
                {trace.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="w-14 text-neutral-500">{String(t.step)}</span>
                    <span className="flex-1 text-neutral-300">{formatTrace(t)}</span>
                    {typeof t.ms === "number" && <span className="text-neutral-500">{t.ms as number}ms</span>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Sources">
            {citations.length === 0 ? (
              <p className="text-xs text-neutral-600">Citations appear here.</p>
            ) : (
              <ul className="space-y-1">
                {citations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => loadCode(c.id)}
                      className={`w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-neutral-800 ${
                        activeId === c.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-400"
                      }`}
                    >
                      <span className="text-emerald-400">[{c.id}]</span> {c.file}:{c.start_line}-{c.end_line}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Code${code ? ` · ${code.path}` : ""}`} grow>
            {code ? (
              <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed">
                {code.lines.map((l) => {
                  const hot = l.n >= code.start && l.n <= code.end;
                  return (
                    <div key={l.n} className={hot ? "bg-emerald-950/40" : ""}>
                      <span className="mr-3 inline-block w-8 select-none text-right text-neutral-600">{l.n}</span>
                      <span className="text-neutral-300">{l.text || " "}</span>
                    </div>
                  );
                })}
              </pre>
            ) : (
              <p className="text-xs text-neutral-600">Click a citation to see the source.</p>
            )}
          </Panel>
        </aside>
      )}
    </div>
  );
}

function Panel({ title, grow, children }: { title: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 ${grow ? "flex-1" : ""}`}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</div>
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

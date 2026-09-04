"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useDataChannel,
  useIsSpeaking,
  useLocalParticipant,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_BRAIN_API_URL ?? "http://localhost:8000";

type Citation = { id: string; repo: string | null; file: string; start_line: number; end_line: number };
type TraceStep = Record<string, unknown>;
type Caption = { role: "you" | "lumen"; text: string };
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
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-neutral-100">
        <h1 className="text-4xl font-semibold tracking-tight">Lumen — Live Call</h1>
        <p className="max-w-md text-center text-neutral-400">
          Join the call and ask about the codebase out loud. Lumen listens, searches, and
          answers — grounded and verified.
        </p>
        <button
          onClick={join}
          disabled={joining}
          className="rounded-lg bg-neutral-100 px-6 py-3 font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
        >
          {joining ? "Joining…" : "Join call"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
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
      className="min-h-screen bg-neutral-950 text-neutral-100"
      onError={(e) => setError(e.message)}
    >
      <RoomAudioRenderer />
      <Meeting onLeave={() => setConn(null)} />
    </LiveKitRoom>
  );
}

function Meeting({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext();
  const roomState = useConnectionState();
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const userSpeaking = useIsSpeaking(localParticipant);

  const [view, setView] = useState<"operator" | "customer">("operator");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [thinking, setThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [code, setCode] = useState<CodeResp | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // receive the worker's data messages
  useDataChannel("lumen", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "thinking") {
        setThinking(true);
        setCaptions((c) => [...c, { role: "you" as const, text: data.question }].slice(-8));
      } else if (data.type === "answer") {
        setThinking(false);
        setCitations(data.citations ?? []);
        setTrace(data.trace ?? []);
        setCaptions((c) => [...c, { role: "lumen" as const, text: data.answer ?? "" }].slice(-8));
      }
    } catch {
      /* ignore */
    }
  });

  const connected = roomState === "connected";
  const phase: "connecting" | "listening" | "thinking" | "answering" = !connected
    ? "connecting"
    : state === "speaking"
      ? "answering"
      : thinking
        ? "thinking"
        : "listening";

  const isOperator = view === "operator";

  async function enableSound() {
    try {
      await room.startAudio();
      setSoundOn(true);
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
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-5">
      {/* header */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lumen</h1>
          <p className="text-xs text-neutral-500">Live call · room lumen-demo</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-neutral-800 p-0.5 text-xs">
            {(["operator", "customer"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 capitalize ${
                  view === v ? "bg-neutral-100 text-neutral-900" : "text-neutral-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={onLeave} className="text-xs text-neutral-500 underline hover:text-neutral-300">
            Leave
          </button>
        </div>
      </header>

      <div className={`grid flex-1 gap-5 ${isOperator ? "lg:grid-cols-[1fr_1fr]" : "grid-cols-1"}`}>
        {/* left: call + captions */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 py-8">
            <Orb phase={phase} />
            <p className="text-sm font-medium tracking-wide capitalize">
              {phase === "listening" && userSpeaking ? "hearing you…" : phase}
            </p>
            {!soundOn && (
              <button
                onClick={enableSound}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                🔊 Enable sound
              </button>
            )}
          </div>

          <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Transcript
            </div>
            <div className="space-y-3">
              {captions.length === 0 && (
                <p className="text-sm text-neutral-600">Ask a question out loud to begin.</p>
              )}
              {captions.map((c, i) => (
                <div key={i}>
                  <span
                    className={`text-xs font-medium ${
                      c.role === "you" ? "text-sky-400" : "text-emerald-400"
                    }`}
                  >
                    {c.role === "you" ? "You" : "Lumen"}
                  </span>
                  <p className="text-sm leading-relaxed text-neutral-200">
                    <AnswerText text={c.text} showCites={isOperator} onCite={loadCode} activeId={activeId} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* right: evidence (operator only) */}
        {isOperator && (
          <section className="flex flex-col gap-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Trace</div>
              {trace.length === 0 ? (
                <p className="text-xs text-neutral-600">The pipeline shows here after a question.</p>
              ) : (
                <ol className="space-y-1.5">
                  {trace.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 font-mono text-xs">
                      <span className="w-16 text-neutral-500">{String(t.step)}</span>
                      <span className="flex-1 text-neutral-300">{formatTrace(t)}</span>
                      {typeof t.ms === "number" && <span className="text-neutral-500">{t.ms as number}ms</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Sources</div>
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
            </div>

            <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Code {code && <span className="text-neutral-600">· {code.path}</span>}
              </div>
              {code ? (
                <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs leading-relaxed">
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Orb({ phase }: { phase: "connecting" | "listening" | "thinking" | "answering" }) {
  const color =
    phase === "answering"
      ? "bg-emerald-500"
      : phase === "thinking"
        ? "bg-amber-500"
        : phase === "listening"
          ? "bg-sky-500"
          : "bg-neutral-600";
  const ring =
    phase === "answering"
      ? "animate-ping bg-emerald-500/50"
      : phase === "thinking"
        ? "animate-ping bg-amber-500/40"
        : phase === "listening"
          ? "animate-ping bg-sky-500/40"
          : "";
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      {ring && <span className={`absolute inline-flex h-full w-full rounded-full ${ring}`} />}
      <span className={`relative inline-flex h-16 w-16 rounded-full ${color}`} />
    </div>
  );
}

function AnswerText({
  text,
  showCites,
  onCite,
  activeId,
}: {
  text: string;
  showCites: boolean;
  onCite: (id: string) => void;
  activeId: string | null;
}) {
  const clean = text.replace(/\*\*/g, "");
  if (!showCites) {
    return <>{clean.replace(/\s*\[[^\]]*\]/g, "")}</>;
  }
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
                className={`font-medium hover:underline ${activeId === id ? "text-emerald-300" : "text-emerald-400"}`}
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

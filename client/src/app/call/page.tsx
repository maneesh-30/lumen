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
import { useState, type ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_BRAIN_API_URL ?? "http://localhost:8000";

type Citation = { id: string; repo: string | null; file: string; start_line: number; end_line: number };
type TraceStep = Record<string, unknown>;
type CodeLine = { n: number; text: string };
type CodeResp = { repo: string; path: string; start: number; end: number; lines: CodeLine[] };
type Conn = { token: string; url: string };
type Phase = "connecting" | "listening" | "thinking" | "answering";

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
      className="h-screen bg-neutral-950 text-neutral-100"
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
  const [citations, setCitations] = useState<Citation[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [thinking, setThinking] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
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

  const connected = roomState === "connected";
  const phase: Phase = !connected
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

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!micOn);
      setMicOn(!micOn);
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
      {/* meeting area (70%) */}
      <main className="flex flex-1 flex-col bg-neutral-900">
        <div className="flex flex-1 items-center justify-center gap-6 p-6">
          <Tile name="You" active={userSpeaking} muted={!micOn} accent="sky">
            <span className="text-5xl font-semibold text-neutral-300">Y</span>
          </Tile>
          <Tile
            name="Lumen"
            active={phase === "answering"}
            sublabel={
              phase === "answering" ? "Speaking…" : phase === "thinking" ? "Thinking…" : "Listening"
            }
            accent={phase === "answering" ? "emerald" : phase === "thinking" ? "amber" : "sky"}
          >
            <LumenOrb phase={phase} />
          </Tile>
        </div>

        {/* control bar */}
        <div className="flex items-center justify-center gap-3 border-t border-neutral-800 bg-neutral-950/60 px-6 py-4">
          <button
            onClick={toggleMic}
            className={`rounded-full px-5 py-2.5 text-sm font-medium ${
              micOn ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700" : "bg-red-600 text-white"
            }`}
          >
            {micOn ? "🎤 Mic on" : "🔇 Muted"}
          </button>
          {!soundOn && (
            <button
              onClick={enableSound}
              className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              🔊 Enable sound
            </button>
          )}
          <div className="flex rounded-full border border-neutral-700 p-0.5 text-xs">
            {(["operator", "customer"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1.5 capitalize ${
                  view === v ? "bg-neutral-100 text-neutral-900" : "text-neutral-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={onLeave}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500"
          >
            Leave
          </button>
        </div>
      </main>

      {/* evidence sidebar (30%, operator only) */}
      {isOperator && (
        <aside className="flex w-[32%] min-w-[320px] flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Evidence</div>
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

function Tile({
  name,
  active,
  muted,
  sublabel,
  accent,
  children,
}: {
  name: string;
  active: boolean;
  muted?: boolean;
  sublabel?: string;
  accent: "sky" | "emerald" | "amber";
  children: ReactNode;
}) {
  const ring =
    active && accent === "emerald"
      ? "ring-2 ring-emerald-500"
      : active && accent === "amber"
        ? "ring-2 ring-amber-500"
        : active
          ? "ring-2 ring-sky-500"
          : "ring-1 ring-neutral-800";
  return (
    <div
      className={`relative flex aspect-video w-full max-w-md flex-col items-center justify-center rounded-2xl bg-neutral-800 ${ring}`}
    >
      {children}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-xs">
        <span className="font-medium text-neutral-200">{name}</span>
        {muted && <span className="text-red-400">🔇</span>}
        {sublabel && <span className="text-neutral-400">· {sublabel}</span>}
      </div>
    </div>
  );
}

function LumenOrb({ phase }: { phase: Phase }) {
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
        : "";
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      {ring && <span className={`absolute inline-flex h-full w-full rounded-full ${ring}`} />}
      <span className={`relative inline-flex h-16 w-16 items-center justify-center rounded-full ${color}`}>
        <span className="text-2xl font-bold text-white">L</span>
      </span>
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

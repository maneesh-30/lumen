"use client";

import "@livekit/components-styles";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useRoomContext,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

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
      <CallView error={error} onLeave={() => setConn(null)} />
    </LiveKitRoom>
  );
}

type Phase = "connecting" | "listening" | "thinking" | "answering";

const PHASE_UI: Record<Phase, { label: string; hint: string; color: string; ring: string }> = {
  connecting: { label: "Connecting…", hint: "Joining the call", color: "bg-neutral-600", ring: "" },
  listening: { label: "Listening", hint: "Ask your question out loud", color: "bg-sky-500", ring: "animate-ping bg-sky-500/40" },
  thinking: { label: "Thinking…", hint: "Searching the codebase", color: "bg-amber-500", ring: "animate-ping bg-amber-500/40" },
  answering: { label: "Answering", hint: "Speaking the answer", color: "bg-emerald-500", ring: "animate-ping bg-emerald-500/50" },
};

function CallView({ error, onLeave }: { error: string | null; onLeave: () => void }) {
  const room = useRoomContext();
  const roomState = useConnectionState();
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const userSpeaking = useIsSpeaking(localParticipant);
  const [soundOn, setSoundOn] = useState(false);

  const lastUserSpoke = useRef(0);
  const [, tick] = useState(0);

  // re-evaluate the time-based phase a couple times a second
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 400);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (userSpeaking) lastUserSpoke.current = Date.now();
  }, [userSpeaking]);

  const connected = roomState === "connected";
  const agentSpeaking = state === "speaking";
  const recentlyAsked = Date.now() - lastUserSpoke.current < 10000;

  let phase: Phase = "listening";
  if (!connected) phase = "connecting";
  else if (agentSpeaking) phase = "answering";
  else if (recentlyAsked && !userSpeaking) phase = "thinking";
  else phase = "listening";

  const ui = PHASE_UI[phase];

  async function enableSound() {
    try {
      await room.startAudio();
      setSoundOn(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Lumen</h1>

      {/* animated status orb */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        {ui.ring && <span className={`absolute inline-flex h-full w-full rounded-full ${ui.ring}`} />}
        <span className={`relative inline-flex h-20 w-20 rounded-full ${ui.color}`} />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-lg font-medium tracking-wide">{ui.label}</p>
        <p className="text-sm text-neutral-500">{ui.hint}</p>
        {userSpeaking && phase === "listening" && (
          <p className="mt-1 text-xs text-sky-400">● hearing you…</p>
        )}
      </div>

      {!soundOn && (
        <button
          onClick={enableSound}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          🔊 Enable sound
        </button>
      )}

      {error && <p className="text-xs text-red-400">error: {error}</p>}

      <button
        onClick={onLeave}
        className="text-xs text-neutral-500 underline hover:text-neutral-300"
      >
        Leave call
      </button>
    </div>
  );
}

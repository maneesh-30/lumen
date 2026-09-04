"use client";

import "@livekit/components-styles";
import {
  RoomAudioRenderer,
  useConnectionState,
  useRoomContext,
  useVoiceAssistant,
  LiveKitRoom,
} from "@livekit/components-react";
import { useState } from "react";

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

function CallView({ error, onLeave }: { error: string | null; onLeave: () => void }) {
  const room = useRoomContext();
  const roomState = useConnectionState();
  const { state } = useVoiceAssistant();
  const [soundOn, setSoundOn] = useState(false);

  const connected = roomState === "connected";
  const speaking = state === "speaking";
  const thinking = state === "thinking";

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

      {/* simple, cheap status indicator (no heavy visualizer) */}
      <div
        className={`h-24 w-24 rounded-full transition-all ${
          speaking
            ? "animate-pulse bg-emerald-500"
            : thinking
              ? "animate-pulse bg-amber-500"
              : connected
                ? "bg-neutral-700"
                : "bg-neutral-800"
        }`}
      />

      <p className="text-sm uppercase tracking-widest text-neutral-300">
        {connected ? state : roomState}
      </p>

      {!soundOn && (
        <button
          onClick={enableSound}
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          🔊 Enable sound
        </button>
      )}

      <p className="text-xs text-neutral-600">
        Speak your question — e.g. &quot;How does the VLM answer questions?&quot;
      </p>

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

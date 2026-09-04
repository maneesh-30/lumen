"use client";

import "@livekit/components-styles";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useVoiceAssistant,
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
      onError={(e) => {
        console.error("LiveKit error:", e);
        setError(e.message);
      }}
      onDisconnected={() => console.log("LiveKit disconnected")}
    >
      <RoomAudioRenderer />
      <CallView error={error} />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
        <StartAudio
          label="🔊 Click to enable sound"
          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white"
        />
      </div>
    </LiveKitRoom>
  );
}

function CallView({ error }: { error: string | null }) {
  const roomState = useConnectionState();
  const { state, audioTrack } = useVoiceAssistant();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Lumen</h1>
      <div className="h-40 w-80">
        <BarVisualizer state={state} barCount={7} trackRef={audioTrack} />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm uppercase tracking-widest text-neutral-300">
          room: {roomState} · agent: {state}
        </p>
        <p className="text-xs text-neutral-600">
          Speak your question — e.g. &quot;How does the VLM answer questions?&quot;
        </p>
        {error && <p className="text-xs text-red-400">error: {error}</p>}
      </div>
    </div>
  );
}

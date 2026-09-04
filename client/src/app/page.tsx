"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_BRAIN_API_URL ?? "http://localhost:8000";

type Health = "checking" | "connected" | "offline";

export default function Home() {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d.status === "ok" ? "connected" : "offline"))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-neutral-100">
      <h1 className="text-6xl font-semibold tracking-tight">Lumen</h1>
      <p className="max-w-md text-center text-neutral-400">
        Joins your call, hears the question, and answers from your codebase —
        grounded, cited, and verified, in seconds.
      </p>
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <span
          className={`h-2 w-2 rounded-full ${
            health === "connected"
              ? "bg-green-500"
              : health === "checking"
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
        />
        <span>server: {health}</span>
      </div>
    </main>
  );
}

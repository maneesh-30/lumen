import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

// Mints a short-lived LiveKit access token. Runs server-side only — the API secret
// never reaches the browser.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const room = searchParams.get("room") ?? "lumen-demo";
  const identity = searchParams.get("identity") ?? `user-${Math.floor(Math.random() * 100000)}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) {
    return NextResponse.json({ error: "LiveKit env not configured" }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  return NextResponse.json({ token, url });
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable StrictMode: its dev double-mount makes LiveKitRoom connect→disconnect→reconnect,
  // which drops the agent and leaves the call on "disconnected".
  reactStrictMode: false,
};

export default nextConfig;

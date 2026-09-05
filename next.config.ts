import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname),
  },
  // Next's dev-time cross-origin check otherwise refuses to serve
  // _next/static when the app is opened over 127.0.0.1 instead of localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // The Playwright run starts `next dev`; keep it from writing AGENTS.md and
  // CLAUDE.md into the repository on every start.
  agentRules: false,
};

export default nextConfig;

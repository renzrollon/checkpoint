import path from "node:path";
import type { NextConfig } from "next";

/**
 * Extra origins the development server may serve `_next/*` to, from
 * `CHECKPOINT_DEV_ORIGINS` (comma-separated; Next's own wildcard syntax such
 * as `*.example.dev` is allowed). This is how a phone on the LAN reaches
 * `npm run dev -- -H 0.0.0.0`: without it Next answers 403 for every origin
 * but `127.0.0.1`. The value is read once by the dev server at startup, not by
 * the app per request, which is why it is not in `src/lib/env.ts`'s schema —
 * changing it needs a `npm run dev` restart. `next start` ignores it entirely.
 */
const devOrigins = (process.env.CHECKPOINT_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname),
  },
  // Next's dev-time cross-origin check otherwise refuses to serve
  // _next/static when the app is opened over 127.0.0.1 instead of localhost.
  allowedDevOrigins: ["127.0.0.1", ...devOrigins],
  // The Playwright run starts `next dev`; keep it from writing AGENTS.md and
  // CLAUDE.md into the repository on every start.
  agentRules: false,
};

export default nextConfig;

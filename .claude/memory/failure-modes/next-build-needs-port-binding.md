---
title: next build needs the Bash sandbox off (Turbopack binds a local port)
date: 2026-09-05
change: build-checkpoint-reader
tags: [next, turbopack, sandbox, build]
---
`npm run build` (Next 16 Turbopack) spawns a PostCSS worker that binds a localhost port; inside the Claude Code Bash sandbox that fails with "binding to a port — Operation not permitted", and a failed attempt leaves a poisoned `.next` cache. Run `rm -rf .next && npm run build` with the sandbox disabled. `npm test` and `npm run typecheck` are fine sandboxed.

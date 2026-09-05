---
title: Client components must not value-import src/lib/change/load.ts
date: 2026-09-05
change: build-checkpoint-reader
tags: [next, client-bundle, githost, node-modules]
---
`src/lib/change/load.ts` imports `@/lib/githost`, whose fixture adapter uses `node:fs`, `node:path` and `node:crypto`. Any `"use client"` component that value-imports from `load.ts` drags those into the browser bundle and the build fails ("node:path is not handled by plugins"). `import type` is fine. Pure helpers shared with the client (ledger status words, blocking reasons) live in `src/lib/change/ledger-status.ts`; keep them there and re-export from `load.ts`.

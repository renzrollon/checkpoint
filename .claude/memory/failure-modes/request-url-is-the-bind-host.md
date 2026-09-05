---
title: request.url is the bind host, so redirects must be relative
date: 2026-09-05
change: reach-checkpoint-from-a-phone
tags: [next, redirect, access-gate, lan]
---

Next derives `request.url` from the address the server is bound to, not the `Host` the client sent (`-H 0.0.0.0` reports `http://0.0.0.0:<port>`, a tunnel reports `http://localhost:3000`, and `X-Forwarded-Host` is ignored), so any `Location` built with `new URL(path, request.url)` sends a phone on the LAN to an address it cannot reach — use `redirectToPath` in `src/lib/auth/redirect.ts`, which emits a relative `Location` (`NextResponse.redirect` refuses one).

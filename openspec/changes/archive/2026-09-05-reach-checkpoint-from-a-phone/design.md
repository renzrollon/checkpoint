## Context

See `proposal.md` for motivation. The relevant current state:

- Two places build an absolute redirect from `request.url`: `src/app/api/session/route.ts:51-52` (`new URL(safeNextPath(...), request.url)` then `NextResponse.redirect(destination, 303)`) and `src/proxy.ts:55-57` (`new URL("/login", request.url)` then `NextResponse.redirect(login)`). Nothing else in `src/` composes a URL from the request; `SignOut` and `HostError` use `router.push("/login")` and `window.location.reload()`.
- `request.url` in Next.js 16.3.1 is derived from the server's bind host, not the request's `Host` header: `next dev -H 0.0.0.0` and `next start -H 0.0.0.0` both report `http://0.0.0.0:<port>`, a tunnel to `localhost:3000` reports `http://localhost:3000`, and `X-Forwarded-Host` is not honoured (verified with curl on 2026-09-05; see the proposal's Evidence). The proxy's redirect happens to come out relative today because Next's middleware layer strips an origin that matches `request.url`; the session route's does not.
- `NextResponse.redirect` refuses a relative target: it passes the argument through `validateURL` (`node_modules/next/dist/server/web/spec-extension/response.js:98-109`), which throws on anything the WHATWG `URL` constructor cannot parse on its own.
- `LoginForm` submits with `fetch(..., { redirect: "follow" })` and then `window.location.assign(res.url)`. Fetch resolves a relative `Location` against the request URL, which on the phone is the phone's own origin, so a relative header needs no client change. The no-script fallback (`<form method="post">`) follows a relative `Location` natively.
- `cookieSecure` in the session route is already `NODE_ENV === "production" || request.nextUrl.protocol === "https:"`. The spec says only "Secure"; the delta states the rule as implemented.
- `next.config.ts` hard-codes `allowedDevOrigins: ["127.0.0.1"]`. Next's dev server blocks `/_next/*` for any other origin with a 403 and a console hint naming the option. The check does not run under `next start`.
- `src/lib/change/load.ts` `readSpecs` awaits `listDir` and `readFile` one at a time inside a `for` loop, recursing per directory, and `loadChange` awaits a `listDir` on the change directory (the typed `not_found` check) before starting any read. Against `renzrollon/interlock`, `/changes/port-interlock-to-codex-cli` took 5.9 s and 5.2 s on two runs, with two delta specs.
- Repo memory `.claude/memory/failure-modes/playwright-must-use-localhost.md` records an earlier collision with the same `request.url` behaviour.

No new dependency is introduced. Every pin in the archived change's design D6 stays as it is (next 16.3.1, react 19.2.8, zod 4.4.3, vitest 4.1.10, @playwright/test 1.62.1).

## Goals / Non-Goals

**Goals:**
- Sign-in and the login redirect work from any address the server is reachable at, with no per-network configuration and no trust placed in `Host` or `X-Forwarded-*` headers.
- A phone on the same Wi-Fi can use the development server against the fixture repo or a real repo, with one environment variable.
- A change page against a real repository waits on four sequential GitHub round trips instead of six, with identical output and error behaviour.
- The README tells the owner how to get the app onto a phone in the next five minutes, and why the development server is the plain-http path.

**Non-Goals:**
- Any change to what is written to the git host, to the ledger port, or to the decision flow.
- Honouring `X-Forwarded-Host` or `X-Forwarded-Proto` for URL construction. Relative redirects make the question moot.
- Caching, the Git Trees API, or any other adapter contract change to reduce round trips further. The request count is unchanged; only the ordering is.
- Interlock-side work (`checkpoint.json` consumption by `interlock ready`, the ntfy sender). Those live in `specflow`.

## Decisions

### D1. Redirects carry a relative `Location`, built by hand
A helper `redirectToPath(path, status)` in `src/lib/auth/redirect.ts` returns `new NextResponse(null, { status, headers: { location: path, "cache-control": "no-store" } })`. It accepts only a path that starts with a single `/` (not `//`, not a scheme) and throws otherwise; the session route passes the output of `safeNextPath`, the proxy passes the `/login?next=...` string it already builds. Both call sites drop `new URL(..., request.url)`. RFC 7231 §7.1.2 permits a relative reference in `Location`; every browser and `fetch` resolve it against the request URL.

Alternatives considered: (a) build the absolute URL from `Host` / `X-Forwarded-Host` / `X-Forwarded-Proto`: requires deciding which proxies to trust and is the very thing Next declines to do for us; (b) a `CHECKPOINT_PUBLIC_URL` variable: one more setting that differs per network, and wrong the moment the owner switches from LAN to tunnel; (c) keep `NextResponse.redirect` and accept the bug on self-hosting: rules out the immediate phone test the change exists for.

### D2. The `Secure` rule is stated, not changed
The delta spec records the implemented rule (production or https → `Secure`; development over plain http → no `Secure`). It is the rule that makes the LAN path work, so it belongs in the contract rather than in an implementation comment. A production build over plain http therefore cannot hold a session from a phone, which is why the README's tunnel path uses https and its LAN path uses the development server.

### D3. Development origins come from `CHECKPOINT_DEV_ORIGINS`
`next.config.ts` reads `process.env.CHECKPOINT_DEV_ORIGINS`, splits on commas, trims, drops empties, and prepends `127.0.0.1`, so `allowedDevOrigins` is always at least what it is today. Next loads `.env.local` before it evaluates the config, so the value can live there. Entries use Next's own syntax, including its wildcard form (`*.example.dev`). The variable is not added to the zod schema in `src/lib/env.ts`: that schema validates what the app reads per request, and this value is consumed once by the dev server at startup; a comment in `next.config.ts` says so. The variable has no effect on `next start`.

Alternative considered: allow every origin in development. Next has no such switch by design, and the block exists to stop a page on another site from reading the dev server's source maps and HMR stream.

### D4. Concurrent reads, deterministic errors
`readSpecs` maps each directory listing into `Promise.all` over its entries (recursing for subdirectories, reading `.md` files), flattens, and sorts by path exactly as today, so the output is unchanged for any tree. `loadChange` starts the existence `listDir` on the change directory together with the proposal read, `readCore` and `readSpecs`, and waits with `Promise.allSettled`. Resolution is fixed: if the existence listing rejected with a `not_found` host error, the result is the typed `not_found` and the other outcomes are discarded (they resolve to "missing" for an absent directory anyway); otherwise, if the existence listing rejected, that error is thrown; otherwise the first rejection among the reads is thrown; otherwise the view is assembled. This keeps every error class the pages already name and makes the thrown error independent of network timing. Sequential round trips per change page go from six (ref, exists, proposal‖core, specs listing, per-directory listing, per-file read) to four (ref, exists‖proposal‖core‖specs listing, per-directory listings, per-file reads). Peak concurrency is bounded by the number of spec files in one change, a handful, well inside GitHub's secondary rate limits.

Test approach: a host wrapper that counts in-flight `listDir` and `readFile` calls and records the maximum. Because `Promise.all` starts every call before any resolves, the maximum is the number of siblings, deterministically, whatever the fixture adapter's timing; the sequential code never exceeds one.

### D5. README section "Testing from your phone"
Three paths, cheapest first, each a copy-pasteable block. LAN: `CHECKPOINT_DEV_ORIGINS=<mac-ip> npm run dev -- -H 0.0.0.0` (with the fixture or the GitHub variables), open `http://<mac-ip>:3000` on the phone, find the address with `ipconfig getifaddr en0`; cookie is not `Secure` over http in development. Tunnel: `npm run build && npm start`, then any https tunnel to `localhost:3000`; production cookies are `Secure` and https satisfies them; no origin allowlist applies. Vercel: the existing section. A short caveat explains the `Secure` rule so nobody tries `next start` over plain http on a LAN. `.env.example` gains the new variable with the same explanation in one line.

## Risks / Trade-offs

- [Relative `Location` behind a proxy that rewrites paths] → Checkpoint is always served at the origin root (Vercel, tunnels, `next start`); a sub-path deployment was never supported and is unchanged.
- [`next.config.ts` reads an env variable at startup; a stale dev server keeps the old list] → The README says to restart `npm run dev` after changing it, which Next's own 403 hint also states.
- [`Promise.allSettled` changes which error surfaces when two reads fail differently] → D4 fixes the precedence (existence first, then reads in declaration order), and a test asserts it.
- [Higher concurrency against GitHub] → Bounded by files in one change; the request count is unchanged.
- [Existing tests assert absolute `Location` values] → They are rewritten in task 1.1 to assert path-only values and fail before the fix, per the bug-fix rule.

## Migration Plan

No data, no schema, no deployment change. Vercel deployments pick the change up on the next deploy; a relative `Location` behaves identically there. Rollback is reverting the commit.

## Open Questions

None.

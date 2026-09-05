## Why

The reader is complete for its archived change (204 unit tests, one e2e, lint, typecheck and the production build are green, and the GitHub adapter renders `renzrollon/interlock` read-only), but a phone cannot sign in to it unless it is deployed first. The session endpoint and the access gate build their redirect `Location` from the server's own idea of its URL, which is the bind address, not the address the phone used: verified with curl on 2026-09-05, `POST /api/session` on `next dev -H 0.0.0.0` answers `Location: http://0.0.0.0:3200/`, `next start` answers the same, and with `X-Forwarded-Proto: https` and `X-Forwarded-Host` set it answers `https://0.0.0.0:3300/changes/x`. The login form follows that Location with `fetch`, so on a phone the sign-in ends in "Sign-in failed; check the connection" even though the cookie was set. On top of that, `next dev` refuses `_next/static` to any origin other than `127.0.0.1` (403 "Blocked cross-origin request"), and a real change page costs 5 to 6 seconds because the delta specs are read one file at a time.

Fixing these three things is what lets the owner open Checkpoint on a phone on the same Wi-Fi, or through an https tunnel, today, and it removes one class of failure from the Vercel deployment as well.

## What Changes

- The post-login redirect (303) and the unauthenticated page redirect (307) carry a **relative** `Location` (a same-origin path, never a scheme or host), so the browser resolves it against whatever address it used to reach the server: a LAN IP, a tunnel hostname, `localhost`, or the Vercel URL. The open-redirect guard on `next` is unchanged; a relative path cannot leave the origin.
- The session cookie's `Secure` attribute is stated in the spec as it is implemented: set in production or when the request arrived over https, omitted for a development server reached over plain http so a phone on the LAN can hold the session.
- `next.config.ts` reads `CHECKPOINT_DEV_ORIGINS` (comma-separated hostnames, Next's own wildcard syntax allowed) into `allowedDevOrigins`, always keeping `127.0.0.1`, so `npm run dev -- -H 0.0.0.0` serves assets to a phone on the LAN. Development only; `next start` does not consult it.
- The change loader reads the delta specs concurrently instead of one directory and one file at a time, and runs the change-exists check concurrently with the artifact reads, cutting the sequential GitHub round trips for a change page from six to four. Output order and every error class are unchanged.
- `README.md` gains a "Testing from your phone" section covering the LAN dev path, the https tunnel path on a production build, and the existing Vercel path, with the `Secure`-cookie caveat that explains why plain-http LAN testing uses the dev server. `.env.example` documents `CHECKPOINT_DEV_ORIGINS`.
- The first task lands the failing redirect tests before any fix, per the bug-fix rule.

Not in this change: reading `checkpoint.json` from `interlock ready`, the ntfy push sender, or anything else on the Interlock side; those live in the `specflow` repository. No new dependencies, no version changes, no new routes.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `access-gate`: the two redirects the gate and the session endpoint issue become relative paths, and the `Secure` attribute rule is stated for production, https and plain-http development.

## Impact

- `src/app/api/session/route.ts`, `src/proxy.ts` and a small shared redirect helper under `src/lib/auth/`; their tests.
- `next.config.ts` and `.env.example` (development-only origin allowlist; `src/lib/env.ts` is untouched because the value is consumed by Next at startup, not by the app at request time).
- `src/lib/change/load.ts` (`readSpecs` and the existence check in `loadChange`) and `src/lib/change/load.test.ts`.
- `README.md`.
- External systems: none new. GitHub request count per change page is unchanged; only their ordering is.
- Evidence for the bug, recorded so the fix has a pass/fail signal: `curl -s -o /dev/null -D - -H "Host: 192.168.7.42:3200" -d "key=dev&next=/" http://127.0.0.1:3200/api/session` on a `next dev -H 0.0.0.0 -p 3200` fixture server answers `HTTP/1.1 303 See Other` with `location: http://0.0.0.0:3200/`.

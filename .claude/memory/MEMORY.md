# Project memory

## Common Failure Modes
- [next build needs the Bash sandbox off](failure-modes/next-build-needs-port-binding.md) — Turbopack's PostCSS worker binds a port; clear `.next` and build unsandboxed.
- [Playwright must use localhost](failure-modes/playwright-must-use-localhost.md) — `next dev` redirects to localhost; a 127.0.0.1 baseURL breaks the login fetch.
- [request.url is the bind host](failure-modes/request-url-is-the-bind-host.md) — Next ignores `Host`/`X-Forwarded-Host`, so redirects must be relative via `redirectToPath`.

## Module Coupling
- [Client components must not value-import change/load.ts](coupling/client-components-must-not-import-change-load.md) — it pulls the fixture adapter's `node:` modules into the browser bundle; use `ledger-status.ts`.

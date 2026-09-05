## Context

See `proposal.md` for motivation. This repository is empty: no code, no `openspec/specs/`, no test profile. Everything the reader depends on lives in other repos and is read as evidence, not imported:

- Interlock's ledger grammar and audit: `~/IdeaProjects/specflow/lib/ledger.mjs` (parser `:161-259`, serializer `:265-297`, empty-cell set `:54-73`, row split `:101-108`).
- Interlock's readiness gate, which the laptop side will run against whatever the phone writes: `~/IdeaProjects/specflow/lib/ready.mjs:51-68, 328-390`.
- The product brief: `~/IdeaProjects/app-ideas/top-5-app-ideas-2026-09-05.md:48-100`.
- The sibling Next.js app whose pins this repo copies: `~/IdeaProjects/trading-system/web/package.json`.

The sender (ntfy push, `interlock ready` consuming the approval marker) is assumed done in specflow. This design fixes the cross-repo file contract the reader will honour, and degrades honestly where the sender has not written anything.

Constraints carried from the brief: the phone never talks to the laptop; the git host is the message bus; the reader holds a git host token and nothing else; every number shows its denominator and every unobserved value says so.

## Goals / Non-Goals

**Goals:**
- One Next.js app that reads a change from a branch, renders it for a phone, answers a `needs_human` row, and records approve or send back, all through the git host.
- A `decisions.md` writer whose output Interlock's parser accepts with zero invalid rows, pinned by golden fixtures.
- Two interchangeable git-host adapters (GitHub, local fixture) behind one contract, so every server behaviour is testable without a token.
- Fail closed everywhere: no access key means no access; a blocking ledger means no approve; a stale blob SHA means no write.

**Non-Goals:**
- Any contact with ntfy, web push, service workers, or offline caching.
- Rendering halts, run trajectories or review findings.
- Multi-repo, multi-user, or any database.
- Editing anything other than `decisions.md` and `checkpoint.json`.

## Decisions

Every row in `decisions.md` is referenced here by id. `D1` is the one decision left to a person.

### D1. How the app itself is gated (needs_human; default described here)
The default this design implements: a single shared access key in `CHECKPOINT_ACCESS_KEY`, exchanged at `POST /api/session` for an httpOnly, Secure, SameSite=Lax cookie whose value is `v1.<expiry>.<tag>`, where `tag` is an HMAC-SHA256 over `v1|<expiry>` keyed by the access key and `expiry` is a Unix timestamp 30 days out. Next.js 16's request interceptor (`src/proxy.ts`, the file formerly named `middleware.ts`) verifies the tag and the expiry on every route except `/login`, `/api/session`, `/manifest.webmanifest` and `/icons/*`. A server-action POST is recognised by its `Next-Action` request header and refused with 401 JSON like an API route rather than redirected; every server action re-checks the session itself as well. No configured key means 503 on every gated route. Alternatives the human may prefer instead: Vercel Deployment Protection (no app code, ties the app to Vercel), Cloudflare Access (identity-based, an extra service). The rest of the design does not change with the answer; only `src/lib/auth/*`, `src/proxy.ts` and the login page would be removed.

### D2. Git host is GitHub (agent_resolved)
Both source repos (`specflow`, `project-wedding`) have `github.com/renzrollon/*` remotes. The adapter contract is host-neutral; only one production implementation ships.

### D3. Approval marker lives in the change directory (agent_resolved)
`openspec/changes/<change>/checkpoint.json`. The brief's prose (`:86`) says the marker "goes into the change's own directory so it rides the branch"; its sketch (`:80`) draws `.claude/checkpoint/X.json`. The prose wins: the change directory is archived with the change and is already the place `interlock ledger` and `interlock ready` read. A marker the laptop side does not find reads as "not approved", which is fail-closed and safe if the paths ever disagree.

### D4. The reader never talks to ntfy (agent_resolved)
The ntfy phone app renders the push and opens the click URL (`/changes/<change>?ref=<branch>`). The reader is only the click target. Web Push with VAPID would duplicate a transport that already works.

### D5. No database; the branch is the state (agent_resolved)
Every read is a git host read on a ref; every write is a commit. Nothing is cached across requests in v0.1. Brief `:85`.

### D6. Pinned stack (agent_resolved)
Copied from `trading-system/web/package.json`, plus the markdown pair from the npm registry on 2026-09-05:

| package | version | role |
|---|---|---|
| next | 16.3.1 | app framework |
| react, react-dom | 19.2.8 | UI |
| react-markdown | 10.1.0 | markdown to React, raw HTML escaped by default |
| remark-gfm | 4.0.1 | tables and task lists |
| zod | 4.4.3 | `checkpoint.json` and env schema |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | styling |
| typescript | 5.9.3 | dev |
| vitest | 4.1.10 | unit tests |
| @vitejs/plugin-react | 6.0.5 | vitest React support |
| jsdom | 30.0.1 | component test DOM |
| @testing-library/react | 16.3.2 | component tests |
| @testing-library/user-event | 14.6.4 | component tests |
| @playwright/test | 1.62.1 | e2e |
| eslint, eslint-config-next | 10.8.1, 16.3.1 | lint |
| @types/node, @types/react, @types/react-dom | 26.2.0, 19.2.18, 19.2.4 | types |

`engines.node` is `>=24`. Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`).

### D7. Port the ledger grammar; do not import specflow (agent_resolved)
`src/lib/ledger/ledger.ts` is a TypeScript port of `parseLedger`, `serializeLedger`, `isEmptyCell` and `summarize` from `lib/ledger.mjs`, exposing the same shapes. Parity is pinned by golden fixtures: `scripts/gen-ledger-fixtures.mjs` imports the real module from `INTERLOCK_LIB_DIR` (defaults to `~/.claude/plugins/cache/interlock/interlock/0.2.0/lib`) and writes, for each `fixtures/ledger/*.md`, a `.parsed.json` and a `.serialized.md`. The test compares the port against those files and never needs specflow present. Importing at runtime was rejected: specflow is not on npm yet and the reader wants types.

Answering a row does **not** re-serialize the whole file. `answerRow` renders the one replacement row with the same cell rules as `serializeLedger` and splices it in at the parsed `line`, so every other line of `decisions.md`, including prose outside the table and any hand-typed padding, is byte-identical after the write. Re-serializing would reformat a laptop-authored file on every answer and bury the one-line change in a noisy diff. `serializeLedger` exists for parity tests and for the fixture generator, not for the write path.

### D8. Approve is disabled while the ledger blocks (agent_resolved)
`interlock ready` blocks on any `needs_human` row, any invalid row, a missing ledger or an unparseable one (`ready.mjs:341-388`). Recording an approval the gate will refuse is noise, so the control is disabled with the same reason, and the server action refuses too. Send back is always allowed.

### D9. The sender contract, assumed and tolerated (agent_resolved)
The sender is assumed to write a `request` block into `checkpoint.json` before pushing. The reader validates it with a tolerant schema and degrades when it is absent: risk shows `unobserved`, counts are always computed from `tasks.md` and `decisions.md` on the ref, never taken from the sender.

```json
{
  "schema": "interlock.checkpoint/1",
  "change": "add-user-auth",
  "request": {
    "kind": "checkpoint",
    "requestedAt": "2026-09-05T03:10:00Z",
    "headSha": "0123456789abcdef0123456789abcdef01234567",
    "risk": { "class": "medium", "signals": ["shared-value-transform"] },
    "tasks": { "total": 12, "waves": 3 },
    "ledger": { "needsHuman": 1, "agentResolved": 8, "invalid": 0 }
  },
  "decision": {
    "state": "approved",
    "note": "",
    "decidedAt": "2026-09-05T04:00:00Z",
    "decidedBy": "checkpoint",
    "headSha": "0123456789abcdef0123456789abcdef01234567"
  }
}
```

`request` is optional and opaque beyond `headSha` and `risk.class`; `decision` is written by the reader and replaces any previous decision. Unknown top-level fields are preserved (zod `passthrough`). `risk.class` is displayed only if it is one of `low|medium|high|critical` (`risk.mjs:40`), otherwise it is shown as `unobserved` with the raw value in a tooltip.

### D10. Optimistic concurrency by blob SHA (agent_resolved)
Every write carries the blob SHA of the file the owner was shown. The GitHub contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) requires `sha` for an update and answers 409 or 422 when it is stale; the adapter maps both to `conflict`. The server never retries; the page reloads the file and says the ledger or decision file moved. The fixture adapter computes SHAs as git does (`sha1("blob <len>\0" + content)`) so the same tests cover both.

### D11. Hosting is Vercel (agent_resolved)
As project-wedding. Deployment is documentation only (`README.md`): environment variables, token scope, one project. No Vercel-specific code.

### D12. Halts are not rendered in v0.1 (agent_resolved)
Run trajectories live in `.claude/ship/runs/` on the laptop (`docs/04-when-it-stops.md:57`), not on the branch. A halt push carries its own text; the reader has nothing to add.

### D13. Evidence text for a human answer (agent_resolved)
`human decision <YYYY-MM-DD> via Checkpoint`, following the form the ledger contract documents (`shared/DECISION-LEDGER.md:72-74`, `human decision 2026-08-12`). The date is UTC.

### D14. One-tap options parsed from the question (agent_resolved)
`src/lib/ledger/options.ts` strips a trailing `?`, keeps only the text after the last `:` when the question has one (so "How is the app gated: a cookie, Deployment Protection, or Cloudflare Access?" yields three options), then splits on `, or `, `, `, ` or `, ` vs `, ` versus ` and ` / `, yielding at most four trimmed options of at least two characters each; anything else yields none. Free text is always available. The brief asks for "pick one of the recorded options or type a value" (`:63`) and the ledger has no options column, so the question text is the only recorded source.

### D15. Commit messages and author (agent_resolved)
`checkpoint(<change>): answer <id>`, `checkpoint(<change>): approve`, `checkpoint(<change>): return`. Author is the token owner; the API sets it. The brief has the app commit through the git host API (`:63`).

### D16. Fixture adapter as the second implementation (agent_resolved)
`src/lib/githost/fixture.ts` serves `fixtures/repo/` (a sample repo tree with two changes and an `archive/`) with an in-memory overlay for writes. Selected by `CHECKPOINT_GIT_HOST=fixture`. It exists so the server layer, component tests and the e2e smoke run with no token and no network.

### D17. Writes are path-guarded in the adapter (agent_resolved)
The adapter refuses any write outside `openspec/changes/<change>/` or to a file other than `decisions.md` and `checkpoint.json`, before any network call. The brief: "It reads artifacts, writes ledger rows and an approval marker, and nothing else" (`:69`). Token scope is Contents read and write on one repository (`:96`).

### D18. Ref resolution (agent_resolved)
`ref` query parameter on every page; when absent, the repository's default branch from the host. The header always shows the ref and short head SHA so the owner can tell which branch they are approving.

### D19. PWA is manifest-only (agent_resolved)
`src/app/manifest.ts` produces the web manifest (name, icons, `display: standalone`, theme colour). No service worker: offline is a non-goal, and iOS add-to-home-screen needs only the manifest and icons.

### D20. Counts computed on the ref (agent_resolved)
`src/lib/tasks/tasks.ts` counts checkboxes with the regex Interlock uses (`artifacts.mjs:79`) and waves as `## N.` headings. The header never shows a number the reader did not compute itself from the artifacts, so the sender cannot make the phone lie.

### D21. UI comes from a Claude Design comp, briefed from the repo (agent_resolved)
The visual design is not invented by the implementers. Task 1.8 writes `docs/checkpoint-design-brief.md`, a prompt for Claude Design that carries the six screens, every state and copy string the specs name, the accessibility checklist, and the tokens and absence treatment from specflow's `Interlock Report Design/` comps so Checkpoint reads as Interlock's phone surface. Producing the comp is a human step at the checkpoint: paste the brief into Claude Design, then bring the result back with `/design-comp-import`, which vendors it as `docs/design/checkpoint.dc.html` with provenance and writes the transcription `docs/checkpoint-design-spec.md`. The section 3 tasks implement from the transcription when it exists and from the brief's §Screens when it does not, so ship never waits on the comp. Precedence is fixed: spec scenarios for copy and behaviour, then the transcription for geometry and tokens, then the brief. Alternative rejected: describing the UI only in tasks, which is how every screen in a sibling repo ended up with its own spacing.

## Module layout

```
src/
  proxy.ts                      D1 gate (Next.js 16 request interceptor)
  app/
    layout.tsx, globals.css, manifest.ts
    login/page.tsx              access key form
    api/session/route.ts        POST exchange, DELETE logout
    page.tsx                    inbox
    changes/[name]/page.tsx     change page (server component)
    changes/[name]/actions.ts   server actions: answerRow, decide
  components/
    ChangeCard.tsx, ChangeHeader.tsx, ArtifactTabs.tsx, Markdown.tsx,
    LedgerPanel.tsx, AnswerForm.tsx, DecisionBar.tsx, HostError.tsx
  lib/
    env.ts                      zod-validated env (fails at boot with the missing name)
    auth/session.ts             HMAC cookie make/verify, constant-time compare
    githost/{types,errors,github,fixture,index}.ts
    ledger/{ledger,options}.ts  D7, D14
    tasks/tasks.ts              D20
    checkpoint/checkpoint.ts    D9 schema, merge, staleness
    change/load.ts              listChanges(ref), loadChange(ref, name) → view model
    change/actions.ts           answerRow, decide (pure orchestration over the adapter)
docs/
  checkpoint-design-brief.md   D21 Claude Design prompt (in this change)
  design/checkpoint.dc.html    vendored comp (human step, via /design-comp-import)
  checkpoint-design-spec.md    comp transcription (same step)
fixtures/
  ledger/*.md (+ generated .parsed.json, .serialized.md)
  repo/openspec/changes/{add-user-auth,add-report-flag,archive/...}
scripts/gen-ledger-fixtures.mjs
e2e/checkpoint.spec.ts
```

Data flow: page (server component) → `load.ts` → adapter reads → parsers → view model → components. Form submit → server action → `actions.ts` → adapter read (fresh SHA is the one the page passed) → parser mutate → serialize → adapter write → revalidate page. Every server action re-checks the session.

## Error handling

- Adapter errors are a discriminated union `{ kind, message, path?, ref?, retryAt? }`; nothing else is thrown across the adapter boundary.
- Pages render `HostError` with the kind and a retry control; they never render an empty inbox or an empty change for a failed read.
- Server actions return `{ ok: true, ... } | { ok: false, reason, reloaded? }`; conflict returns the fresh file so the panel can re-render without a second round trip.
- Env validation runs once at module load; a missing variable stops the server with its name. The token is never logged and never included in an error message.
- Markdown: `react-markdown` without `rehype-raw`, so raw HTML is text; links get `target="_blank" rel="noopener noreferrer"`.

## Accessibility

Phone-first at 375 px. Tabs are a `role="tablist"` with arrow-key navigation; every form control has a visible label; disabled Approve carries `aria-disabled` and its reason as text next to it, not only in a title attribute; colour is never the only carrier of ledger state (text labels always present); focus is moved to the result message after a submit.

## Risks / Trade-offs

- [Sender writes a different path or shape] → The reader degrades to `unobserved` risk and still records decisions; `interlock ready` ignoring the marker is fail-closed. D3 and D9 are the two rows to revisit if specflow decides otherwise.
- [Concurrent edits on laptop and phone] → Blob-SHA guarded writes; conflicts reload, never retry (D10).
- [Token on the server, app reachable from the internet] → D1 gate, fail closed on missing key, token scoped to one repo's contents.
- [GitHub rate limit at 5,000 requests per hour per token] → An inbox with N changes costs about 3N reads; acceptable for one owner. No caching in v0.1; revisit if the inbox grows.
- [Golden fixtures drift from a newer Interlock] → The generator records the Interlock version it ran against in `fixtures/ledger/VERSION`; regenerating is one command.
- [Next.js 16 API details differ from memory (`proxy.ts`, server actions)] → Implementers read the installed package's docs; the test suite, not recollection, decides.

## Migration Plan

Greenfield. Deploy: create a Vercel project from this repo, set `CHECKPOINT_ACCESS_KEY`, `CHECKPOINT_GITHUB_TOKEN`, `CHECKPOINT_REPO`, `CHECKPOINT_GIT_HOST=github`. Rollback is deleting the deployment; nothing persists outside the target repo's branch.

## Open Questions

None that change the specs or tasks. D1 is recorded in `decisions.md` as the one question for the human.

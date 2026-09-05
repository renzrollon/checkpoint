# Explore Brief: checkpoint-reader

## Meta
- mode: autonomous
- topic: Checkpoint v0.1 reader — the phone-side PWA for Interlock's human checkpoint (idea 1 in `~/IdeaProjects/app-ideas/top-5-app-ideas-2026-09-05.md`)
- created: 2026-09-05T04:00:00+08:00
- suggested_change_name: build-checkpoint-reader
- related_change: none

## Problem / Intent

`/interlock:spec` stops at a human checkpoint and `interlock ready` refuses to skip it while any `needs_human` ledger row remains. Today both the stop and the row live on a laptop terminal. Checkpoint v0.1 is the smallest thing that moves that read to a phone: a push arrives, the person reads the four artifacts and the ledger on a phone, answers a `needs_human` row, and approves or sends back. The laptop side (push sender, `interlock ready` reading the approval marker) is in specflow and is **assumed done** for this change. This repo is the reader.

This repo has no commits and no code. Everything below is evidence from sibling repos.

## Codebase Findings

- **Ledger row grammar is fixed by specflow and audited.** `~/IdeaProjects/specflow/lib/ledger.mjs:42` — five columns `id | question | class | resolution | evidence`; `:54-73` the set of placeholder/hedge cells that read as empty; `:101-108` row splitting with `\|` escaping; `:123` heading regex `# Decisions — <change>`; `:161-259` `parseLedger` (never throws, collects invalid rows); `:265-297` `serializeLedger` (em-dash placeholders, pipes escaped, newlines collapsed). A phone-side write must round-trip through this parser with zero invalid rows.
- **Answering a row is an in-place edit, not a delete.** `~/.claude/plugins/cache/interlock/interlock/0.2.0/shared/DECISION-LEDGER.md:71-74` — flip class to `agent_resolved`, write the answer into `resolution`, cite the human in `evidence` (`human decision 2026-08-12`). `lib/ledger.mjs:238-246` — an `agent_resolved` row whose id is absent from `design.md` is invalid; ids that came from `needs_human` rows already appear in `design.md` only if spec wrote them there, so the reader must not invent new ids.
- **`interlock ready` is fail-closed and composes ledger + risk + artifacts.** `~/IdeaProjects/specflow/lib/ready.mjs:51-68` strictness (`maxNeedsHuman: 0`, `maxInvalidDecisions: 0`, `requireLedger: true`); `:361-388` the two ledger blockers. An approval marker the reader writes is one more input on that side; a missing marker must read as "not approved".
- **Risk classes and the continuity allowlist.** `~/IdeaProjects/specflow/lib/risk.mjs:40-56` — `low|medium|high|critical`, continuity allowed at `low|medium`, unclassifiable is `high`. The reader cannot run the classifier; risk only reaches it if the sender wrote it down.
- **Task and wave shape.** `~/IdeaProjects/specflow/lib/artifacts.mjs:79-85` — checkbox regex and `N.M` id regex; a `## N.` section is one wave (`skills/spec/SKILL.md` "Task shape for ship"). Task count and wave count are computable from `tasks.md` alone.
- **What a halt looks like.** `~/IdeaProjects/specflow/docs/04-when-it-stops.md:33-40` — halts print to a terminal; `:57` — run trajectories live in `.claude/ship/runs/<runId>.jsonl` on the laptop, not on the branch. The reader has nothing to render for a halt in v0.1.
- **The ten-minute read the reader has to support.** `~/IdeaProjects/specflow/docs/02-the-checkpoint.md:19-26` — proposal, design, tasks, specs, in that order, with one question each.
- **Push transport precedent.** `~/IdeaProjects/trading-system/src/daemon/notify/ntfy.py:1-60` — ntfy POST with bounded retries and no secrets in the body. It is the sender's concern; the reader never talks to ntfy. The ntfy phone app renders the push and opens the click URL.
- **Sibling Next.js pins.** `~/IdeaProjects/trading-system/web/package.json` — `next 16.3.1`, `react 19.2.8`, `react-dom 19.2.8`, `typescript 5.9.3`, `vitest 4.1.10`, `@playwright/test 1.62.1`, `tailwindcss 4.3.3`, `@tailwindcss/postcss 4.3.3`, `eslint 10.8.1`, `eslint-config-next 16.3.1`, `zod 4.4.3`, `jsdom 30.0.1`, `@testing-library/react 16.3.2`, `@vitejs/plugin-react 6.0.5`, `@types/node 26.2.0`, `@types/react 19.2.18`, `@types/react-dom 19.2.4`; scripts `test: vitest run`, `typecheck: tsc --noEmit`, `test:e2e: playwright test`. Local Node is `v26.8.1`.
- **Git host.** `git -C ~/IdeaProjects/specflow remote -v` and project-wedding both point at `github.com/renzrollon/*`. GitHub is the only host in play.
- **Markdown renderer versions** (npm registry, 2026-09-05): `react-markdown 10.1.0`, `remark-gfm 4.0.1`. `react-markdown` escapes raw HTML by default, so artifact text is never injected as HTML.
- **No test profile, no allowlist in this repo.** Session preflight reported `.claude/testing/profile.json` missing and four `Bash(...)` allow rules absent. Both are ship-time preconditions, not spec content.

## Critical Files

- `~/IdeaProjects/specflow/lib/ledger.mjs:42,54-73,101-108,123,161-297` — the row grammar the reader must reproduce exactly.
- `~/IdeaProjects/specflow/lib/ready.mjs:51-68,328-390` — what the laptop side will refuse; defines what "approve" can and cannot mean.
- `~/IdeaProjects/specflow/lib/risk.mjs:40-56` — the risk vocabulary shown on the phone.
- `~/IdeaProjects/specflow/lib/artifacts.mjs:79-85` — task line and id regex for counts.
- `~/IdeaProjects/specflow/docs/02-the-checkpoint.md:19-26` — the reading order the UI mirrors.
- `~/IdeaProjects/app-ideas/top-5-app-ideas-2026-09-05.md:48-100` — the product brief; `:80` and `:86` disagree on the marker path (`.claude/checkpoint/X.json` vs the change directory).
- `~/IdeaProjects/trading-system/web/package.json` — the pinned stack to copy.

## Options Considered

1. **Reader as a Next.js PWA on Vercel, GitHub as the message bus, no database** — recommended. Matches the brief (`app-ideas:84-86`), reuses the sibling stack, keeps the phone off the laptop's network. Cost: a fine-grained PAT on the server, and every read is an API round trip.
2. **Reader as a static page fed by the sender** — rejected. It cannot write a ledger row or a marker without a server holding a token, and a token in a static page is a token on the phone.
3. **Import specflow's `lib/ledger.mjs` at runtime** — rejected for v0.1. specflow is not on npm yet (`publish-interlock-as-npm-package` is in flight) and the reader needs TypeScript types. Port parse/serialize and pin them with golden fixtures generated from the real module.
4. **Web Push from the PWA (VAPID)** — rejected. ntfy already delivers to the phone; the reader only needs to be the click target.

## Recommended Direction

Build the reader as one Next.js app: a git-host adapter (GitHub contents API plus a local-fixture adapter for tests and development), a ported ledger parser/serializer with golden-fixture parity tests, a tasks.md counter, a change inbox and a change page mirroring the ten-minute read, an answer form for `needs_human` rows, and an approve / send-back bar that writes `openspec/changes/<change>/checkpoint.json` to the branch. The first task is the fixture-backed formatter test, as the brief demands.

## Assumptions Made

- Git host is GitHub; single repo per deployment (`CHECKPOINT_REPO=owner/name`), fine-grained PAT with Contents read/write only.
- Approval marker lives in the change directory (`openspec/changes/<change>/checkpoint.json`), following the brief's prose (`:86`) over its sketch (`:80`).
- The sender (assumed done) writes a `request` block into that same file before pushing; the reader tolerates its absence by showing risk as `unobserved` and computing counts itself.
- The reader never talks to ntfy. Halt pushes are sender-only in v0.1.
- Approve is disabled while the ledger still blocks, because `interlock ready` would refuse anyway.
- Stack and versions copied from `trading-system/web`; markdown via `react-markdown 10.1.0` + `remark-gfm 4.0.1`.
- Hosting is Vercel, as with project-wedding.

## Pending Clarifications

- How the PWA itself is gated: a shared access key set as an httpOnly cookie (default in the spec), Vercel Deployment Protection, or Cloudflare Access. This is a security-posture decision.

## Risks / Gaps

- The sender contract is assumed, not read. If specflow writes a different file or shape, the reader still works (it degrades to `unobserved` risk) but the approval marker will be ignored by `interlock ready` until the paths agree.
- A ledger edited on the phone and on the laptop concurrently: the GitHub contents API rejects a write with a stale blob SHA, and the reader must surface that instead of retrying.
- GitHub API rate limits for an unauthenticated or mis-scoped token surface as 401/403/404 and must be spoken, not blank.

## Spec Ready Checklist
- [x] Problem / intent is clear enough to name a change
- [x] Recommended direction is stated (or options narrowed to ≤2)
- [x] Critical files listed with why
- [x] Assumptions recorded
- [x] Residual unknowns are product/policy only (not "I didn't look")

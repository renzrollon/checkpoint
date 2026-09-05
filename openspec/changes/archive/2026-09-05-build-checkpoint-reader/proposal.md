## Why

`/interlock:spec` stops at one deliberate human read, and `interlock ready` refuses to skip it while a `needs_human` ledger row remains. Both the stop and the row currently exist only on a laptop terminal, so an unattended run is unattended right up to the moment it needs a person, and then it waits for someone to sit down. Checkpoint v0.1 is the phone-sized inbox for that one decision: read the artifacts, answer the row, approve or send back, from anywhere.

This change builds the **reader** half described in `~/IdeaProjects/app-ideas/top-5-app-ideas-2026-09-05.md` §1. The sender (ntfy push from specflow) and `interlock ready` consuming the approval marker are assumed to already exist in specflow and are out of scope here.

## What Changes

- New Next.js PWA in this repo (currently empty) that reads one GitHub repository's `openspec/changes/*` on a given branch and renders `proposal.md`, `design.md`, `tasks.md`, `specs/**` and `decisions.md` for a phone.
- A change inbox listing active changes on a ref with ledger status, task count and wave count computed from the artifacts themselves.
- A ledger answer flow: a `needs_human` row is flipped to `agent_resolved` with the typed or picked answer and a `human decision <date> via Checkpoint` evidence cell, then committed to `decisions.md` on the branch. The written file round-trips through a port of specflow's `lib/ledger.mjs` parser with zero invalid rows; golden fixtures generated from the real module pin that parity.
- A decision flow: **Approve** or **Send back with a note** writes `openspec/changes/<change>/checkpoint.json` to the branch with the branch head SHA it was decided against. Approve is disabled while the ledger still blocks, mirroring the laptop-side gate.
- A git-host adapter with two implementations: GitHub contents API (server-side fine-grained token, one repo, contents read/write) and a local-fixture adapter used by tests and by local development without a token.
- An access gate for the app itself: a shared access key exchanged for an httpOnly session cookie (default pending decision D1 in `decisions.md`).
- Risk band is displayed only when the sender recorded it; otherwise the UI says `unobserved`. Every count shows its denominator.

Not in this change: talking to ntfy, rendering halts or run trajectories, review findings as cards, MR approval, multi-repo inbox, web push, offline caching.

## Capabilities

### New Capabilities
- `access-gate`: the app refuses every route until a valid access key has been exchanged for a session cookie; logout clears it.
- `git-host-adapter`: read files and directories, resolve a ref to a head SHA, and write a file with a base blob SHA against one GitHub repository, plus a fixture-backed adapter with the same contract; every failure class is named.
- `change-inbox`: list active changes on a ref with ledger status, task and wave counts, and decision state.
- `change-reading`: render the four artifacts and the ledger in the ten-minute reading order with counts, denominators and an `unobserved` risk state.
- `ledger-answering`: answer a `needs_human` row in place and commit a `decisions.md` that specflow's parser accepts, refusing stale writes.
- `checkpoint-decision`: approve or send back a change by writing `checkpoint.json` on the branch, disabled while the ledger blocks.

### Modified Capabilities
- (none; `openspec/specs/` is empty)

## Impact

- New application code under `src/`, tests under `src/**/*.test.ts(x)` and `e2e/`, fixtures under `fixtures/`.
- New dependencies (pinned in `design.md`): Next.js 16.3.1, React 19.2.8, react-markdown 10.1.0, remark-gfm 4.0.1, zod 4.4.3, Tailwind 4.3.3; dev: vitest 4.1.10, Playwright 1.62.1, TypeScript 5.9.3.
- External systems: GitHub REST contents API on one repository with a fine-grained personal access token held server-side. No database.
- Cross-repo contract with specflow: the file `openspec/changes/<change>/checkpoint.json` (schema `interlock.checkpoint/1`) and the ledger row shape in `lib/ledger.mjs`. Both are recorded as decisions D3 and D9.

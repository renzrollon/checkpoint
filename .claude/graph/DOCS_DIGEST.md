---
audience: agent-only
target_tokens: 2500
generated_at: 2026-09-05T17:24:00Z
source_hashes:
  docs/how-checkpoint-works.md: 4db0fef84ad49dfda133bc0d8941c8c8ed87d4f944b4bf467a8ad0c75318e83c
  openspec/specs/access-gate/spec.md: ab99144fb7d9e68ca0a4152ac383f4e12dc5b77a11d0375cf5f73dd17123e817
  openspec/specs/change-inbox/spec.md: 1221153a1852c1cc9a84772597974e76371d83a2743c579fbb14d2e23dc17032
  openspec/specs/change-reading/spec.md: d3638dc5c06cee316f69924d2ffe8e24d621fea3f92efab05d7d9a587a5d50e4
  openspec/specs/checkpoint-decision/spec.md: 4e8228ee5c3d6e57e531e7f52f087ecb4b41ebde1e376c7f299034c369bd71fd
  openspec/specs/git-host-adapter/spec.md: 53777c37ff88cc60c0a645c23fa3d923b33eff1e11eed2836895c7a78a47992f
  openspec/specs/ledger-answering/spec.md: 44a03cff0a3a0513e2ba2e100b39481861acd80866bf7ec718bae3bb3dd9ba96
  README.md: c30923addf82a42fcc55b4575414daae04d2bfe93152bd3b55e73656f682c907
---
# docs-digest
## map
- readme → README.md
- how → docs/how-checkpoint-works.md
- access-gate → openspec/specs/access-gate/spec.md
- change-inbox → openspec/specs/change-inbox/spec.md
- change-reading → openspec/specs/change-reading/spec.md
- checkpoint-decision → openspec/specs/checkpoint-decision/spec.md
- git-host-adapter → openspec/specs/git-host-adapter/spec.md
- ledger-answering → openspec/specs/ledger-answering/spec.md

## facts
- Checkpoint = phone-side Interlock human checkpoint (375 px Next.js 16); no DB; git host is the bus; phone never talks to laptop.
- `/interlock:spec` halts for human read; `interlock ready` blocks on `needs_human` / invalid / missing `decisions.md`; `/interlock:ship` is unattended. Checkpoint moves that read off the laptop.
- Writes exactly two paths: `openspec/changes/<change>/decisions.md` + `openspec/changes/<change>/checkpoint.json`. Adapter path-guard before any network.
- Never invents numbers: counts from artifacts on the ref, with denominators; sender-missing values → `unobserved`.
- Three Interlock (specflow) touch points, files-only, no import/call: (1) ledger shared+effective today; (2) `checkpoint.json` written today, Interlock 0.2.0 does not read it — audit record, not a gate; approve does not pass `ready`, a clear ledger does; (3) ntfy push + `request` writer assumed, not built. Until then owner opens inbox.
- Ledger port: `src/lib/ledger/ledger.ts` ← Interlock `lib/ledger.mjs`; `answerRow` splices one row (one-line diff); golden `fixtures/ledger/` + `VERSION` (0.2.0). Evidence: `human decision <YYYY-MM-DD> via Checkpoint` (UTC).
- `checkpoint.json` schema `interlock.checkpoint/1`; reader writes only `decision` (replace previous), preserves `request` + unknown top-level. `request` optional/opaque beyond `headSha` + `risk.class` (`low|medium|high|critical` else unobserved + tooltip). Stale if `request.headSha` ≠ current head. `decision.headSha` stale → Approve offered again.
- Env: `CHECKPOINT_ACCESS_KEY` (else 503 fail-closed); `CHECKPOINT_GIT_HOST` `github`|`fixture` (default github); `CHECKPOINT_REPO` `owner/name`; `CHECKPOINT_GITHUB_TOKEN` fine-grained Contents r/w on that one repo, never logged; `CHECKPOINT_FIXTURE_DIR` default `fixtures/repo`; `CHECKPOINT_DEV_ORIGINS` LAN `_next/*` for `npm run dev` only.
- D1 still `needs_human`: gating. Default = shared-key httpOnly SameSite=Lax HMAC cookie via `src/proxy.ts`. Alts: Vercel Deployment Protection, Cloudflare Access. Swap only `src/lib/auth/*`, `src/proxy.ts`, `src/app/api/session/`, login page.
- UI from Claude Design / Nocturne (`src/app/globals.css`); archived change `openspec/changes/archive/2026-09-05-build-checkpoint-reader/`; design brief removed from `docs/`.

## workflows
- Local fixture: `CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run dev` → login `dev`; inbox from `fixtures/repo`; `add-user-auth` has `needs_human`; `add-report-flag` clear+approved; writes in-memory overlay, restart resets. Real: `github` + `CHECKPOINT_REPO` + token. `?ref=` defaults to default branch; header shows ref + short head SHA.
- Scripts: `dev`/`build`/`start`/`lint`/`typecheck`; `npm test` Vitest+jsdom; `npm run test:e2e` Playwright 375 px fixture; `npm run gen:ledger-fixtures` with `INTERLOCK_LIB_DIR` (default plugin cache `~/.claude/plugins/cache/interlock/interlock/0.2.0/lib`).
- Commits: `checkpoint(<change>): answer <id>` | `approve` | `return`. Send back always on, requires note. Approve refused UI+server while ledger blocks (mirrors `ready`).
- No stale writes: blob SHA of shown file; host `conflict` → reload, no retry.
- Phone LAN: relative `Location` (no scheme/host) so bind `0.0.0.0` / tunnel does not leak into redirects; `CHECKPOINT_DEV_ORIGINS`; prod cookie `Secure`.
- Agent constraint: never digest `openspec/changes/**`; read an active change directly.

## specs
- access-gate → private to one owner; ungated: login, session endpoint, PWA manifest/icons; pages 307 relative `/login?next=…`; API 401 `{error:unauthenticated}`; tampered/expired cookie = unauth + clear; constant-time key compare; cookie httpOnly SameSite=Lax, 30d, `Secure` iff prod or https (dev http omits); unsafe `next` (`//…`, absolute URL, `/login`, absent) → `/`; no key → 503 "Checkpoint has no access key configured", never issue session.
- change-inbox → list `openspec/changes/` minus `archive`; blocking first then alpha; show ledger (N needs you / clear / missing), done/total tasks, waves, decision none|approved|returned; `?ref=` else default branch; missing ledger = missing not clear, sorts with blocking; empty/host-fail spoken (kind + retry), never silent empty.
- change-reading → tabs Proposal, Design, Tasks, Specs, Ledger (hash); MD tables+task lists; raw HTML escaped; missing artifact named; Specs = every `specs/**` under capability path; header: name, ref, short SHA, tasks done/total, waves, ledger nh/resolved/invalid of total, decision; counts from artifacts never sender; risk only if recorded in `checkpoint.json` + head; stale if head moved; else `unobserved`; unknown change / host fail spoken.
- checkpoint-decision → write `checkpoint.json` `decision.state` approved|returned, note, decidedAt ISO UTC, decidedBy=`checkpoint`, headSha=ref head; preserve request+unknown; send-back note required; approve disabled if needs_human / invalid / missing / unparseable ledger (server: "ledger blocks approval"); stale decision visible+replaceable; write conflict → no write, reload.
- git-host-adapter → `resolveRef`/`readFile`/`listDir`/`writeFile` on one repo; omit ref → default branch; UTF-8 + blob SHA; typed `not_found`; write needs base blob SHA (or new) + message + ref; refuse locally unless `openspec/changes/<change>/{decisions.md,checkpoint.json}` → `forbidden_path`; stale SHA → `conflict` no retry; kinds: `unauthorized`|`forbidden`(+retryAt)|`not_found`|`conflict`|`forbidden_path`|`upstream`; fixture adapter same contract, git blob SHAs, in-memory writes (disk unchanged).
- ledger-answering → Interlock grammar: `# Decisions — <change>`, cols `id|question|class|resolution|evidence`, `\|` escape, hedge (`Obvious.`/`see above`) empty, em dash empty cells; golden round-trip; unparseable = blocking, no rows; answer only `needs_human` → `agent_resolved` + resolution + evidence, splice in place, other lines byte-identical; trim required, newlines→spaces, pipes escaped; chips from "A or B?" / colon-list (≤4); refuse resolved-row answers; blob-SHA concurrency.

## pointers
- README.md#Checkpoint L1-L24
- README.md#Environment variables L25-L38
- README.md#GitHub token scope L39-L51
- README.md#Running locally L52-L93
- README.md#The `checkpoint.json` contract L151-L199
- README.md#Ledger fixtures L200-L219
- README.md#Open decision D1: how the app itself is gated L220-L230
- docs/how-checkpoint-works.md#The problem L8-L21
- docs/how-checkpoint-works.md#What was built L22-L65
- docs/how-checkpoint-works.md#How it integrates with Interlock (specflow) L66-L162
- docs/how-checkpoint-works.md#Safety properties worth knowing L163-L177
- docs/how-checkpoint-works.md#What is still open L178-L188
- openspec/specs/access-gate/spec.md#Purpose L3-L71
- openspec/specs/change-inbox/spec.md#Purpose L3-L34
- openspec/specs/change-reading/spec.md#Purpose L3-L64
- openspec/specs/checkpoint-decision/spec.md#Purpose L3-L53
- openspec/specs/git-host-adapter/spec.md#Purpose L3-L64
- openspec/specs/ledger-answering/spec.md#Purpose L3-L61

# Explore Brief: use-checkpoint-from-phone

## Meta
- mode: autonomous
- topic: Everything still needed to use Checkpoint from a real phone end to end, integrated with Interlock (specflow, remote renzrollon/interlock, plugin 1.3.0)
- created: 2026-10-08T07:54:13Z
- suggested_change_name: use-checkpoint-from-phone
- related_change: none (archived: build-checkpoint-reader, reach-checkpoint-from-a-phone)

## Problem / Intent

The reader is built and reachable from a phone, but nobody can actually use it. It has never been deployed. A spec checkpoint's push does not open it. The change it would show never reaches GitHub. And the laptop ignores what the phone decides. The owner wants every remaining step for that loop in one change: Interlock stops, the phone buzzes, the owner taps into the change, answers or approves, and the laptop respects the answer.

## Codebase Findings

**Interlock 1.3.0 (specflow HEAD e2d8fb9, byte-identical to the installed plugin)**

- **Push.** The checkpoint push exists, but it carries no link. `skills/spec/SKILL.md:246-256` runs `interlock notify checkpoint <change>`. `lib/notify.mjs:132-138` builds title `SPEC CHECKPOINT — <change>`, body `change: <change>` and priority `default`. `postNtfy` (`lib/notify.mjs:210-245`) sends only `Title` and `Priority`. There is no `Click` header, and nothing is configured beyond the topic and server (`lib/notify.mjs:37-48`, `.claude-plugin/plugin.json:21-34`). Specflow's close-notification spec keeps `lib/notify.mjs` the only module that may `fetch`, and the module is pure (`lib/notify.mjs:8-13`, `openspec/specs/ship/close-notification/spec.md:108-110`).
- **`checkpoint.json` in specflow.** Nothing writes or reads it. `git log --all -S checkpoint.json` finds nothing. The only mention is the untracked `research_notes/ai-guidelines-gap-analysis.md:17,89,207`, which lists this as a gap.
- **Gate inputs.** The phone decision is not one. `lib/ready.mjs:694-790` gates on artifacts, risk, ledger, review findings and test profile, and never on `checkpoint.json`. `ready` runs only on the `--continue` path (`skills/spec/continuity.md:16`). Checkpoint-mode ship start validates artifacts and nothing else (`lib/run.mjs:2453-2463`). So a phone **Send back** cannot stop `/interlock:ship`, and an open `needs_human` row does not stop it either.
- **Commits and pushes.** Nothing pushes, and spec does not commit. Spec writes only to the working tree (`skills/spec/SKILL.md:231-262`). Ship commits but never pushes (`lib/prompts/commit.mjs:22-24`, `skills/commit/SKILL.md:90`). Today the owner has to `git add openspec/changes/<change>`, commit, `git push -u origin <branch>` and open `?ref=<branch>`. Otherwise the phone sees nothing.
- **Ledger grammar.** Unchanged since 0.2.0. `git diff v0.2.0 HEAD -- lib/ledger.mjs shared/DECISION-LEDGER.md` is empty, and the 1.3.0 module reproduces all five golden fixtures byte for byte. What is stale is the label in `fixtures/ledger/VERSION` (`interlock 0.2.0`) and the generator default `scripts/gen-ledger-fixtures.mjs:16`, which points at a plugin-cache path that no longer exists. `npm run gen:ledger-fixtures` therefore exits 1.
- **The `design.md` audit after a phone answer.** `lib/ledger.mjs:367-386` audits whether the row id appears in `design.md`. A row the phone flips to `agent_resolved` is invalid if its id is not mentioned there, and Checkpoint cannot write `design.md` (`src/lib/githost/guard.ts`). In practice spec does mention `needs_human` ids. D1 appears 5× in the archived reader design, and the two live `needs_human` changes reference all three of their ids. So the trap is narrow but real.

**Escapement (`~/IdeaProjects/escapement`), an existing consumer of the same contract**

- `lib/checkpoint.mjs:1-14,46-82` parses `interlock.checkpoint/1` and classifies a marker as `approved-fresh|approved-stale|returned|invalid` by ancestry. The read head must be an ancestor of the marker head, and every path changed in between must be the change's `decisions.md` or `checkpoint.json`. The comment states the reason: equality "can never be satisfied", because the marker write itself moves the head.
- `lib/intake.mjs:29-35` already derives the click URL `<base>/changes/<encodeURIComponent(change)>?ref=<encodeURIComponent(ref)>` from `ESCAPEMENT_CHECKPOINT_URL`. `lib/notifier.mjs:81` sends it as `Click`.

**Checkpoint (this repo)**

- **The self-staleness bug.** `decide` records the head it read before writing (`src/lib/change/actions.ts`, `headSha: head.headSha` before `writeFile`). `decisionView` then flags `stale: d.headSha !== headSha` (`src/lib/checkpoint/checkpoint.ts:150-160`). Reloading after any Approve shows "approved at X, branch has moved to Y" and offers Approve again. `riskView` has the same flaw (`checkpoint.ts:124-134`): any phone answer commit marks the sender's risk stale.
- **Deep links survive sign-in.** `src/proxy.ts:34,52-60` and `src/lib/auth/redirect.ts:26-34` keep path and query through `/login` (`safeNextPath`, `src/lib/auth/session.ts:79-85`). An investigator traced `/changes/foo?ref=a%2Fb` round-tripping to `ref=a/b`. Refs with a slash are encoded correctly for GitHub (`src/lib/githost/github.ts:141,150,165`). Untested paths: session POST with `next` carrying a query, and an e2e deep link through login.
- **Losing the branch.** The header link is a bare `/` (`src/app/layout.tsx:43`). The change page has no ref-keeping link back to the inbox. The inbox defaults to the default branch (`src/lib/githost/github.ts:139-140`) and has no branch field. Interlock work lives on feature branches, so after one tap the owner lands on an inbox that does not list the change.
- **One repository.** It is wired narrowly. `src/lib/env.ts:25-33,83-89`, `src/lib/githost/index.ts:11-28` (one host on `globalThis`), `github.ts:46-52`. Callers that would need a repo threaded through: `app/page.tsx:27`, `app/changes/[name]/page.tsx:34,63`, `app/changes/[name]/actions.ts`, `components/ChangeCard.tsx:10`. `lib/change/*` takes a `GitHost` and a ref, so it is already repo-agnostic.
- **Deploy.** The repo now has a remote, `origin` → `https://github.com/renzrollon/checkpoint.git`. `origin/main` is 1 commit ahead, and this branch is `carlrollon/checkpoint-phone-interlock-integration` with no upstream. There is no Vercel project. Gaps that would bite a first deploy:
  - `CHECKPOINT_GIT_HOST=fixture` is not refused in production (`env.ts:59`, `api/fixture/file/route.ts:11-16`).
  - An `EnvError` in production renders Next's digest-only error page, because there is no `error.tsx`.
  - `.env.example:13` names `renzrollon/specflow`; the repo was renamed to `renzrollon/interlock`.
  - `.claude/ship/` is not ignored.
  - The README's deploy section omits the production-URL handoff to Interlock and Escapement, Deployment Protection, token ownership and key strength.
- **Access gate (archived D1, still `needs_human`).** A shared key exchanged for a 30-day HMAC cookie, compared in constant time (`session.ts:11,18-34`). There is no rate limit on `POST /api/session`. Vercel's default Standard Deployment Protection covers preview and generated URLs, not the production domain. The README claim that the gate is "removable as a unit" is wrong: `layout.tsx:4,36-37` and `actions.ts:17-20` import `@/lib/auth/session`.

**Which repositories run Interlock**

GitHub `renzrollon/*` repos with `openspec/`: interlock (specflow), checkpoint, escapement, expense-bot, planet-wars-simulation and project-wedding. One fine-grained PAT can select several repos of one owner. The two changes that need the owner today are elsewhere:
- `kettle/elephantfish` `add-happy-hour`: no remote.
- `beta-rabbitdeploy/permit` `viber-design-kit`: GitLab dedicated, a work repo.

A GitHub Checkpoint can reach neither. One ntfy topic serves every repo (`hooks/preflight.mjs:308-313`), so a click URL that names no repo cannot tell same-named changes in two repos apart.

## Critical Files

- `src/lib/checkpoint/checkpoint.ts:124-160`: `riskView` and `decisionView` equality staleness. This is the bug, and the place freshness changes.
- `src/lib/change/actions.ts` (`decide`, `ledgerOnRef`): records the pre-write head and runs the post-answer audit against `design.md`.
- `src/lib/githost/types.ts:43-50`, `github.ts`, `fixture.ts`, `index.ts`: the adapter contract. A `compare` read and per-repo hosts land here.
- `src/lib/env.ts:25-89`: repo config, the production fixture guard, and config errors.
- `src/app/layout.tsx:43`, `src/app/page.tsx`, `src/app/changes/[name]/page.tsx`, `src/components/ChangeCard.tsx`: links that must keep `ref` (and `repo`).
- `src/proxy.ts:34,52-60`, `src/app/api/session/route.ts:46-53`, `src/components/LoginForm.tsx:22-29`: the deep-link path; tests are missing for a query in `next`.
- `scripts/gen-ledger-fixtures.mjs:16`, `fixtures/ledger/VERSION`: dead default path and stale label.
- `README.md` ("Deploying to Vercel", "checkpoint.json contract", "Open decision D1", "Ledger fixtures"), `docs/how-checkpoint-works.md:63,84,122-161,178-187`, `.env.example:13`: stale integration story.
- `~/IdeaProjects/escapement/lib/checkpoint.mjs:46-82`, `lib/intake.mjs:29-35`: the freshness rule and click URL already in use. Match them.
- `~/IdeaProjects/specflow/lib/notify.mjs:132-138,210-245`, `lib/ready.mjs:694-790`, `lib/run.mjs:2453-2463`, `skills/spec/SKILL.md:231-262`: where the Interlock-side sender, gate and halt would go.

## Options Considered

**Where the specflow half lives.** One OpenSpec change lives in one repo, and `/interlock:ship` implements, verifies and commits inside one worktree. This session's sandbox writes only to this worktree. Ship's guard-commit hook and verify step run this repo's suite.

1. **Two linked changes, one shared contract** (recommended).
   - `use-checkpoint-from-phone` here covers everything Checkpoint-side and writes the shared contract into the repo: click URL, `request` block, freshness rule, laptop obligations.
   - A companion change in specflow covers the sender, the click URL, the request block, the publish step, and `ready`/run-start consumption.
   - Each ships green in its own repo.
2. **One change here that also lists specflow tasks** (rejected). Ship cannot write, test or commit specflow from this worktree, so those tasks would stall or be silently skipped.
3. **Checkpoint-only, with specflow deferred** (viable fallback). The phone works by manual push and a manual URL, but the push still opens nothing and Send back still cannot stop the laptop.

**Multi-repo.**

1. **One deployment per repo** (no code). N Vercel projects, and the laptop maps repo to URL.
2. **`CHECKPOINT_REPOS` allowlist plus `?repo=owner/name`, default first** (recommended). About 8-10 files. One deployment and one token serve every `renzrollon/*` repo, and a click URL without `repo` still works (Escapement compatibility).
3. **Repo in the route** (`/r/<owner>/<repo>/...`). Same plumbing as option 2 plus moving the app tree. Rejected as churn.

**Freshness.** Keep equality (rejected: a bug, as shown above), or use Escapement's ancestry rule via GitHub `GET /repos/{o}/{r}/compare/{base}...{head}` (`status` plus `files[].filename`), one extra read only when the recorded head differs (recommended).

**Who pushes at the checkpoint.** Either the human, given the exact commands by the spec hand-off, or an opt-in Interlock publish step. The publish step would commit only `openspec/changes/<change>/`, write the `request` block, `git push -u origin <branch>`, then send the push with `Click`. It runs only when a Checkpoint URL is configured. Interlock's standing rule is "never push" (`skills/commit/SKILL.md:90`), so this is a policy call.

## Recommended Direction

Spec `use-checkpoint-from-phone` in this repo as the one big Checkpoint-side change, and give it the integration contract as a first-class artifact (`docs/interlock-contract.md`) that the specflow companion change implements. Checkpoint-side scope:

1. **Freshness by ancestry.** Add `compare` to the adapter (GitHub and fixture). Add a pure freshness classifier identical in meaning to Escapement's. `decisionView` and `riskView` read it. This fixes the self-stale Approve.
2. **Multi-repo.** `CHECKPOINT_REPOS` allowlist with `?repo=`, defaulting to the first repo. Hosts per repo. Server actions re-validate the repo.
3. **Ref- and repo-keeping navigation.** Fix the header and back links, and add a branch field (and repo picker) on the inbox.
4. **Deploy hardening.**
   - Refuse the fixture host in production.
   - Speak config errors by variable name only.
   - Correct `.env.example`.
   - Ignore `.claude/ship/`.
   - Give the access gate whatever answer D2 gets.
5. **Deep-link tests.** Session POST with a query in `next`, plus an e2e deep link through login on a slash ref.
6. **Answer-form warning** when a row id is absent from `design.md`.
7. **Ledger fixtures.** Relabel to 1.3.0 and fix the generator default.
8. **Docs.**
   - A deploy runbook: Vercel, env, protection, key generation, handing the URL to Interlock and Escapement, a first-phone-test checklist, and iOS PWA vs Safari cookie jars.
   - Rewrite the integration and "still open" sections.
   - The contract doc.

The specflow companion carries: config `checkpoint_url` / `INTERLOCK_CHECKPOINT_URL`; an optional `Click` on the checkpoint message; the request-block writer and publish step (per D4); `ready` blocking `CHECKPOINT_RETURNED`; and a run-start halt on a returned marker.

## Assumptions Made

- **D5** (agent_resolved). Click URL is `<base>/changes/<encodeURIComponent(change)>?ref=<encodeURIComponent(branch)>`, with `&repo=<owner/name>` when the deployment serves more than one repo. A URL without `repo` opens the default repo. Evidence: `escapement/lib/intake.mjs:29-35`; `src/proxy.ts:52-60` round-trip.
- **D6** (agent_resolved). Decision and risk freshness use Escapement's ancestry rule through the GitHub compare API, computed only when the recorded head differs from the current head. An unknown or unreachable recorded head reads as stale, never fresh. Evidence: `src/lib/checkpoint/checkpoint.ts:131,160`; `escapement/lib/checkpoint.mjs:1-14,75-82`.
- **D7** (agent_resolved). The ledger port is unchanged. Fixtures are relabelled `interlock 1.3.0`, and the generator default resolves the newest installed plugin `lib`. Evidence: `git diff v0.2.0 HEAD -- lib/ledger.mjs` is empty; `scripts/gen-ledger-fixtures.mjs:16`.
- **D8** (agent_resolved). `CHECKPOINT_GIT_HOST=fixture` is refused when `NODE_ENV=production` (fail closed). Evidence: `src/lib/env.ts:59`; `src/app/api/fixture/file/route.ts:11-16`.
- **D9** (agent_resolved). Every in-app link keeps `ref` (and `repo`), and the inbox gets a branch field (a plain GET form, no branch listing API). Evidence: `src/app/layout.tsx:43`; `src/lib/githost/github.ts:139-140`.
- **D10** (agent_resolved). The answer form warns before answering a row whose id `design.md` never mentions, and still allows it. Evidence: specflow `lib/ledger.mjs:367-386`; `src/lib/githost/guard.ts` two-file rule.
- **D11** (agent_resolved). Production config errors render a page naming the missing or invalid variable, never its value. Evidence: `src/lib/env.ts` `EnvError`; no `src/app/error.tsx`.
- **D12** (agent_resolved). The deployment and Interlock wiring are documented as a runbook for the owner to perform. Nothing in this change creates a Vercel project, sets secrets or pushes. Evidence: archived design D11 (Vercel via README only); creating projects and tokens is outward-facing and owner-held.
- **D13** (agent_resolved). Escapement's click URL gains `repo` in Escapement's own repo, out of scope here. Checkpoint stays compatible with its repo-less URL. Evidence: `escapement/lib/intake.mjs:32-35`.

## Pending Clarifications

- **D1** (needs_human). One change ships into one repo. Should the specflow half be a companion change in specflow (recommended), or be deferred, leaving this change Checkpoint-only?
- **D2** (needs_human, carried from archived build-checkpoint-reader D1). How is the deployed app gated: the shared access key cookie (implemented), Vercel Deployment Protection, or Cloudflare Access?
- **D3** (needs_human). Should one deployment serve several repos through `CHECKPOINT_REPOS` and `?repo=` (recommended), or one repo per deployment?
- **D4** (needs_human). At the checkpoint, who commits and pushes the change so the phone can read it: the owner, with commands printed by the hand-off, or an opt-in Interlock publish step that commits only the change directory and pushes the branch when a Checkpoint URL is configured?

## Risks / Gaps

- **Unreachable live changes.** Both live `needs_human` changes are unreachable by a GitHub Checkpoint (kettle has no remote; beta-rabbitdeploy is GitLab, a work repo). The first real phone test needs a fresh change on a `renzrollon/*` branch. This change can be its own first test once pushed.
- **No pull on the laptop.** The laptop never pulls automatically, so `ready` and ship see a phone answer only after `git pull`. The runbook must say so. Auto-fetch is out of scope.
- **Escapement's repo-less click URL.** Escapement's click URL has no `repo`. With multi-repo, its links open the default repo until Escapement adds it (D13).
- **iOS cookie jars.** On iOS a home-screen PWA and Safari keep separate cookie jars, so an ntfy tap opens Safari and may ask for the key once. Unverified on Android.
- **Login does the change page's GitHub reads twice** (`LoginForm.tsx:22-25`, fetch follows the 303, then `location.assign`). It is slow on first open, not broken. Left out of scope.
- **Not verified this session:** a production `next build` (this worktree has no `node_modules`), Vercel's Node 24 runtime behaviour, and which GitHub account owns `renzrollon/interlock` relative to the PAT minter.
- **Specflow's working tree.** specflow `main` has uncommitted local edits (`bin/interlock`, `plugin.json`, `hooks/mod.mjs` …). The companion change should start from a worktree, not that tree.

## Spec Ready Checklist
- [x] Problem / intent is clear enough to name a change
- [x] Recommended direction is stated (or options narrowed to ≤2)
- [x] Critical files listed with why
- [x] Assumptions recorded
- [x] Residual unknowns are product/policy only (not "I didn't look")

## Context

Checkpoint (Next.js 16, phone-first) reads `openspec/changes/*` from a GitHub branch and commits exactly two files back: `decisions.md` and `checkpoint.json`. Two archived changes built it and made it reachable from a phone. Explore on 2026-10-08 (`.claude/handoff/explore-use-checkpoint-from-phone-20261008-155413.md`) found what still stands between it and real use:

- **Never deployed.** The repository now has a remote (`renzrollon/checkpoint`), but there is no Vercel project.
- **The push opens nothing.** Interlock 1.13.0 pushes `SPEC CHECKPOINT — <change>` to ntfy with only `Title` and `Priority` headers (`~/IdeaProjects/specflow/lib/notify.mjs:132-138,210-245`). It writes no `checkpoint.json`, and nothing in specflow reads one. Spec never commits, and nothing ever pushes.
- **Approvals mark themselves stale.** `decide` records the head it read and then commits, which moves the head. `decisionView` compares by equality (`src/lib/checkpoint/checkpoint.ts:150-160`), so the next load calls the approval stale and offers Approve again. `riskView` has the same flaw (`checkpoint.ts:124-134`): every phone answer marks the sender's risk stale.
- **One tap loses the branch.** The chrome link is a bare `/` (`src/app/layout.tsx:43`), and the inbox defaults to the default branch. Interlock work lives on feature branches.
- **One repository per deployment.** But Interlock runs in about six `renzrollon/*` repositories, and one ntfy topic carries all of them.
- **Production gaps.**
  - Nothing refuses the fixture adapter in production.
  - A configuration error renders Next's digest-only page.
- **Doc drift.** `.env.example` names the pre-rename `renzrollon/specflow`, and the ledger fixtures say 0.2.0 although they regenerate byte-identical under 1.13.0.

Escapement (`~/IdeaProjects/escapement`) already consumes `checkpoint.json`:
- **Freshness.** It classifies freshness by ancestry (`lib/checkpoint.mjs:1-14,75-82`).
- **Click URL.** It derives `<base>/changes/<change>?ref=<ref>` (`lib/intake.mjs:29-35`).

This design matches both.

## Goals / Non-Goals

**Goals:**
- A tap on an Interlock push opens the right change, in the right repository, on the right branch, through sign-in, on a deployed instance.
- A decision is current right after it is made, and goes stale only when something other than Checkpoint's two files changes.
- One deployment and one token serve every configured repository.
- A production deployment cannot run on fixture data, and a misconfiguration says which variable is wrong.
- The Interlock side has a written contract to implement, so the companion change in specflow and this one cannot drift apart.

**Non-Goals:**
- Any code in specflow or Escapement.
- Creating the Vercel project, tokens or secrets.
- A branch-listing API.
- A cross-repository aggregated inbox.
- Login rate limiting.
- A GitLab adapter.
- Offline support.

## Decisions

### Scope and contract (D1, D19, D4)

One OpenSpec change ships into one repository, so this change carries only Checkpoint-side work (D1, human decision). The Interlock half becomes a companion change in specflow, specced after this one.

Both sides build against `docs/interlock-contract.md`, written here (D19). It is the single source for:
- **The click URL** (D5).
- **Who owns which `checkpoint.json` fields.** The sender owns `schema`, `change` and `request`, and never touches `decision`. Checkpoint owns `decision` and preserves everything else.
- **The `request` block shape and `request.headSha` semantics** (D20).
- **The freshness rule** (D6).
- **What each state means to a laptop gate.**
  - `approved` and fresh: approved.
  - `approved` and stale: not approved.
  - `returned`: blocks regardless of freshness until a later phone decision replaces it (D21).
  - Absent or unparseable: no phone decision.
- **The publish sequence the sender follows (D4, human decision).** All of it is opt-in, gated on a configured Checkpoint URL:
  1. Commit only `openspec/changes/<change>/`.
  2. Write `checkpoint.json` with `request.headSha` set to that commit, as a second commit.
  3. Push the current branch.
  4. Send the ntfy push with `Click`.
- **What the laptop must do after a phone decision.** `git pull`; nothing pulls automatically.

Alternative rejected: listing the specflow tasks in this change. Ship cannot write, test or commit another repository from this worktree, so those tasks would stall or be skipped silently.

### Access gate stays the shared key (D2)

The implemented gate stays: a key exchanged for a 30-day HMAC cookie, compared in constant time (D2, human decision). It is host-agnostic, and deep links survive it (`src/proxy.ts:52-60`).

The README adds:
- **Key generation.** `openssl rand -base64 32`; brute-force resistance rests on key entropy because the login is not rate limited.
- **Deployment Protection.** Leave Vercel Deployment Protection on Standard. That covers previews and generated URLs. The production domain is gated by the key alone, and the push links point at the production domain.

The README's claim that the gate is "removable as a unit" is corrected: `layout.tsx` and the server actions import `@/lib/auth/session` too.

### Several repositories per deployment (D3, D14, D15, D16)

**Configuration (D3, D15).**
- `CHECKPOINT_REPOS` is a comma-separated allowlist of `owner/name`. The first entry is the default.
- `CHECKPOINT_REPO` alone is still accepted as a one-entry list, so existing `.env.local` files and the README's old instructions keep working.
- Setting both, a malformed entry, or the same repository listed twice (case-insensitively) is an `EnvError` naming the variable.
- The parsed `Env` exposes `CHECKPOINT_REPOS: string[]` and drops the `CHECKPOINT_REPO` field. Every reader of that field moves in this change:
  - `src/lib/githost/index.ts:15`
  - `src/lib/env.test.ts`
  - `src/app/api/fixture/file/route.test.ts:23`
  - `playwright.config.ts:36`, which keeps working through the one-entry rule

**Canonical identity (D14).** GitHub owner and repository names are case-insensitive. A `repo` value is normalized once, in `src/lib/repo.ts` `resolveRepo(raw, repos)`:
1. Trim it.
2. Compare it case-insensitively against the allowlist.
3. Return the configured entry, which is the canonical form. An empty value means the default. No match is `{ ok: false, requested }`.

Nothing else compares repository strings. Host lookup, links, server actions and the header all take the canonical value `resolveRepo` returned. Invariant sweep of repository identity readers:

| Reader | Today | After |
|---|---|---|
| `src/lib/env.ts` | one `CHECKPOINT_REPO` string | `CHECKPOINT_REPOS: string[]`, validated, duplicates refused case-insensitively |
| `src/lib/githost/index.ts` `createHost`/`getHost` | one host from `env.CHECKPOINT_REPO` | `getHost(repo)` keyed by canonical repo; a repo outside the allowlist throws |
| `src/lib/githost/github.ts:46-52` | `repoBase` from its `repo` option | unchanged; it receives the canonical value |
| `src/app/page.tsx`, `src/app/changes/[name]/page.tsx` | `getHost()` | `resolveRepo(search.repo)` then `getHost(canonical)` |
| `src/app/changes/[name]/actions.ts` | `getHost()` | `resolveRepo(input.repo)`; unknown → `{ ok: false, reason: "unknown_repo" }`, nothing written |
| `src/components/ChangeCard.tsx`, change-page inbox link, chrome home link, inbox controls | `ref` only | canonical `repo` and `ref` via one `locationHref` helper |
| `src/app/api/fixture/file/route.ts` | `getFixtureHost()` | unchanged: the fixture adapter serves one repository |

**Hosts.** `getHost(repo)` keeps one host per canonical repository in the existing `globalThis` slot, now a `Map`.

**Fixture mode (D16).** The fixture adapter serves exactly one repository, under the first configured name (default `fixture/repo`). Listing more than one repository with `CHECKPOINT_GIT_HOST=fixture` is an `EnvError`. Multi-repository routing is covered by unit tests that inject hosts. The e2e suite stays single-repository.

**Unknown repository.** An unknown `repo` renders "Checkpoint is not configured for <requested>" with links to the configured repositories. It never falls back to the default, because the change named in the URL belongs to the requested repository.

Alternatives rejected:
- **One deployment per repository.** Needs a repo-to-URL map on every laptop.
- **The repository in the route path** (`/r/<owner>/<repo>/...`). Same plumbing, plus moving the app tree and its tests.

### Click URL (D5, D13)

The URL is `<base>/changes/<encodeURIComponent(change)>?repo=<encodeURIComponent(owner/name)>&ref=<encodeURIComponent(branch)>`. Both parameters are optional on Checkpoint's side: a missing `repo` is the default repository, and a missing `ref` is the default branch. Escapement's existing repo-less links therefore keep opening the default repository (D13).

The access-gate delta pins this URL through sign-in. A unit test covers a session POST whose `next` carries `repo` and an encoded `ref`, and the e2e test opens such a URL signed out and lands on the change.

### Freshness by ancestry (D6, D17, D18, D20, D21, D22)

**The rule (D6).** A pure classifier in `src/lib/checkpoint/freshness.ts`:

```
classifyFreshness({ recordedHead, currentHead, comparison, change }) → "fresh" | "stale"
  fresh  when recordedHead === currentHead
  fresh  when comparison is present, not truncated, status is "ahead" or "identical",
         and every changed path is changeFilePath(change, f) for f in WRITABLE_FILES
  stale  otherwise (absent comparison, behind, diverged, truncated, any other path)
```

The writable paths come from `WRITABLE_FILES` in `src/lib/githost/guard.ts`. The guard that limits writes and the rule that tolerates them read the same list. A second copy could drift.

**The adapter read (D17).** `GitHost.compare(base, head)` returns `{ status, files, truncated }`:
- **GitHub** calls `GET /repos/{owner}/{repo}/compare/{base}...{head}`. It collects `files[].filename`, plus `previous_filename` for renames. It sets `truncated` when the list reaches the API's 300-file cap.
- **Fixture.** The adapter records, per ref, each head its writes produce and the path each write touched. `compare` walks that history. A head it never produced is `not_found`.

**Where it runs (D18).** `src/lib/change/load.ts` gains `freshnessFor(host, checkpoint, currentHead, change)`:
- It collects the distinct recorded heads (`decision.headSha`, `request.headSha`) that differ from the current head.
- It runs one `compare` per head concurrently.
- Any `HostError` from `compare` becomes an absent comparison, which reads as stale. Freshness never fails a page.

It feeds `decisionView` and `riskView`, which take a freshness lookup in place of equality. It runs for:
- `loadChange`.
- `decide`, before the write (D22). The action already carries the head the page rendered (`input.headSha`). `decide` resolves the ref's current head first. When the two differ, it classifies the page head against the current head with the same rule. `stale` means the owner has not seen what is on the branch now, so nothing is written and the result is `{ ok: false, reason: "moved", message }`. It carries no reloaded state, because the page's artifacts are still the old render: the decision bar renders "The branch moved past <page head>; reload to read it" with a Reload control, and its page head stays the one the owner read, so a second tap is refused again until the page is reloaded. `fresh` (only the two Checkpoint files changed since the render, for example the ledger answer the owner just made) proceeds. `decision.headSha` is always the page head, the head the owner read, and never the resolved head. Without this check the ancestry rule would certify an approval of content the owner never saw.
- `decide`'s success result, which reports the decision view through the lookup against the write's `commitSha`, so the approval reads fresh right after it is written. Its `headSha` follows the advance rule below.
- `decide`'s conflict reload. A conflict means only `checkpoint.json` differed, so it may report the resolved head, again through the advance rule.

**The page head only advances over Checkpoint's own commits (D23).** The page head is the head the owner read; `ChangeWorkspace` sends it with every decision, and it moves when a write comes back. Taking the head resolved after a write would sweep in any commit pushed from the laptop in the meantime, and the next Approve would then compare equal and certify content the owner never read. So one helper in `src/lib/change/load.ts`, `advancePageHead(host, change, pageHead, newHead)`, returns `newHead` only when `classifyFreshness` reads the page head fresh against it (one `compare`, none when the heads are equal) and returns `pageHead` otherwise. Both writes use it:
- `answerRow` takes the page head in its input, resolves the head after its write, and returns the advanced head plus `moved: true` when the head did not advance. The answer itself stays written, and the ledger panel says the branch also moved and to reload before approving. The reference audit after the write reuses the `design.md` text already read for the pre-write view instead of reading it again.
- `decide`'s success and conflict results.

`listChanges` does not call it. The inbox shows only the decision state, so the inbox's request count is unchanged.

Invariant sweep of freshness readers:

| Reader | Change |
|---|---|
| `src/lib/checkpoint/checkpoint.ts` `decisionView` | `stale` from the lookup, not `!==` |
| `src/lib/checkpoint/checkpoint.ts` `riskView` | `stale` state from the lookup, not `!==` |
| `src/lib/change/load.ts` `loadChange`, `listChanges` | `loadChange` computes the lookup; `listChanges` reads `state` only and is unchanged |
| `src/lib/change/actions.ts` `decide`, `checkpointReload` | compute the lookup against the head after the write or reload; the reported head goes through `advancePageHead` |
| `src/lib/change/actions.ts` `answerRow` | takes the page head; reports the head through `advancePageHead`, with `moved` when it did not advance (D23) |
| `src/components/ChangeWorkspace.tsx` `headSha` state, fed by `onLedgerChange` and `onDecided` | unchanged: it only ever receives an advanced head |
| `src/components/DecisionBar.tsx` `moved` handling | keeps its page head and its note; shows the message and a Reload control |
| `src/components/DecisionBar.tsx` `staleText`, `src/components/ChangeHeader.tsx` risk line | unchanged: they render the view's `stale` flag and state |
| Escapement `classify` | already ancestry-based, out of scope (D13) |
| Interlock `ready` and run start | companion change, per the contract (D1) |

**`request.headSha` (D20).** It names the commit that carries the artifacts. The sender writes `checkpoint.json` in a later commit, so that commit and every phone answer leave the risk fresh.

**A returned decision (D21).** It is cleared only by a later phone decision. Checkpoint already lets a new decision replace any previous one (`withDecision`).

Alternative rejected: storing the write's own commit SHA in `decision.headSha`. Escapement and the contract already define `headSha` as the head the person read, which is the meaningful audit value, and a commit cannot contain its own SHA.

### Navigation keeps the repository and branch (D9)

- **One link builder.** `locationHref(path, { repo, ref })` in `src/lib/repo.ts` builds every in-app link. It always carries the canonical `repo` and the resolved `ref`, each `encodeURIComponent`-encoded.
- **Chrome home link.** The root layout receives no `searchParams`, and nothing may echo a raw `repo` from the URL (D14: only the canonical value `resolveRepo` returned travels). So the layout stops rendering the header bar. A server component `src/components/Chrome.tsx` renders the whole bar, the "Checkpoint" home link built from props through `locationHref` and the Sign out control, and every page renders it with the canonical `repo` and resolved `ref` from its page context. The unknown-repository and configuration-error pages render it with no `repo` and no `ref`, which is bare `/`. A new `src/app/not-found.tsx` renders it the same way, so an unknown URL keeps Sign out and a home link. The bar is still shown only to a signed-in session, as the layout did. No client component reads `useSearchParams()` for navigation.
- **Change page.** The header gains an "Inbox" link with the change's `repo` and `ref`. The `not_found` link keeps the repository too.
- **Inbox controls.**
  - **Branch field.** A `GET` form labelled "Branch", with `repo` as a hidden input.
  - **Repository picker.** Shown only when more than one repository is configured, as links that mark the current one with `aria-current`. Choosing a repository drops `ref`.
- **Header.** The inbox header and change header show the repository when more than one is configured.
- **No branch listing.** There is no branch-listing API. The push link is the primary entry, and the field covers the rest.

### Production configuration fails closed and speaks (D8, D11)

- **Fixture refused in production (D8).** `parseEnv` refuses `CHECKPOINT_GIT_HOST=fixture` when `NODE_ENV === "production"`, naming `CHECKPOINT_GIT_HOST`. This also refuses `next start` on fixture data. The README's tunnel path already uses GitHub variables, and is reworded to say so.
- **Config errors are spoken (D11).** Pages resolve their context (env, repository, host) in one helper. It returns a configuration result instead of throwing.
  - **Pages** render `ConfigError`: "Checkpoint is not configured: <names>", from `EnvError.missing` only. Never `EnvError.message`, which can quote a value.
  - **Server actions** return `{ ok: false, reason: "config", message }` with the same names.
  - **The fixture file route** keeps answering 404 unless the fixture adapter is configured.

### Answer-form warning (D10)

`referenceResolves` in `src/lib/ledger/ledger.ts` is the port's copy of Interlock's id matcher. It becomes an export, so the warning and the audit use one matcher.

The ledger view gains `unreferenced: string[]`. It lists the ids of `needs_human` rows that `design.md` does not mention, or every such id when `design.md` is missing. It is computed in `ledgerViewFrom` from the design text the loader already reads, and carried through every reloaded-ledger result and `LedgerState`. The parsed `LedgerRow` type stays untouched, because it is the parity type with Interlock. `AnswerForm` shows "design.md does not mention <id>; after this answer the laptop reads the row as invalid until the design references it" above the submit control. The answer is still allowed. Checkpoint never writes `design.md`.

### Ledger fixtures for Interlock 1.13.0 (D7)

`scripts/gen-ledger-fixtures.mjs` resolves its default library path to the highest-versioned directory under `~/.claude/plugins/cache/interlock/interlock/` that contains `lib/ledger.mjs`. `INTERLOCK_LIB_DIR` still wins.

The newest plugin installed here was 1.12.0 when this was written, so the regeneration runs with `INTERLOCK_LIB_DIR` pointing at the 1.13.0 sources; the new default path serves later installs. Regenerating against 1.13.0 changes only `fixtures/ledger/VERSION` (checked 2026-10-31 with `INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures`): after 1.3.0 `lib/ledger.mjs` moved `splitRow`, `isSeparatorRow` and the cell escape into `lib/md-table.mjs` without changing the grammar, and every golden file came back byte-identical.

### Docs and the deploy runbook (D12)

Nothing here reaches Vercel, GitHub settings or a remote (D12). The README gains a runbook the owner follows:
1. **Create the Vercel project** from `renzrollon/checkpoint` `main`.
2. **Mint one fine-grained token.** It is owned by the account that owns the repositories, selects every repository in `CHECKPOINT_REPOS`, and has Contents read and write.
3. **Generate the key.**
4. **Set the environment** for Production.
5. **Keep Deployment Protection on Standard.**
6. **Deploy and add to the home screen.** On iOS, the home-screen app and Safari keep separate cookies, so a push tap may ask for the key once.
7. **Hand the production URL to the laptop.** That means Interlock's Checkpoint URL option (from the companion change) and `ESCAPEMENT_CHECKPOINT_URL`.
8. **Run a first-phone-test checklist** on a fresh change pushed to a `renzrollon/*` branch.

The rest of the docs change as follows:
- `docs/how-checkpoint-works.md` is rewritten for the integration story: what exists, what the companion adds, and the corrected sequence (spec does not commit; the publish step does).
- The README's "Open decision D1" section becomes "Access gate" and cites D2.
- `.env.example` documents `CHECKPOINT_REPOS`.
- `.gitignore` gains `.claude/ship/`.

## Risks / Trade-offs

- **[Risk] Escapement's repo-less push links open the default repository.** If its watched repository is not first, the owner sees the "No change named …" page. → Mitigation: that page names the repository it looked in and links to the others. Escapement adding `repo` is its own change (D13).
- **[Risk] A rate-limited or failing `compare` reads as stale and offers Approve again.** → Mitigation: stale is the conservative reading. Re-approving writes a correct decision, and the page still renders.
- **[Risk] A comparison spanning more than 300 files reads as stale.** → Mitigation: such a branch has changed far beyond the two Checkpoint files, so stale is correct.
- **[Risk] Laptop and phone disagree until the laptop pulls.** → Mitigation: the contract and runbook say `git pull` before `ready` or ship. The companion change decides whether its gate fetches.
- **[Trade-off] Links always carry `repo` and `ref`,** even with one repository configured. URLs are longer but deterministic, and a link copied from the phone always names its branch.
- **[Trade-off] No rate limiting on `POST /api/session`.** Resistance rests on a 32-byte random key, documented as required.
- **[Risk] iOS cookie jars.** The home-screen app and Safari keep separate cookies, so a push tap may meet the login page once. → Mitigation: the deep link survives login; documented in the runbook.

## Migration Plan

1. Merge to `main`; this is the commit Vercel deploys.
2. Follow the README runbook:
   - Create the project.
   - Set `CHECKPOINT_ACCESS_KEY`, `CHECKPOINT_GITHUB_TOKEN`, `CHECKPOINT_REPOS` and `CHECKPOINT_GIT_HOST=github`.
   - Deploy.
3. Existing local `.env.local` files that set `CHECKPOINT_REPO` keep working. One that sets both variables now stops with a configuration error naming both.
4. Rollback: delete the deployment. Nothing persists outside the target branches. Reverting the merge restores single-repository behaviour, and `CHECKPOINT_REPO` still works there.

## Open Questions

None block this change. The companion change in specflow owns:
- the Checkpoint URL option name;
- whether `ready` fetches before reading `checkpoint.json`;
- the exact `request` block writer.

All three must stay within `docs/interlock-contract.md`.

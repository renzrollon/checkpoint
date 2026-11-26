## 1. Foundations: configuration, resolution, freshness rule, compare, docs

- [x] 1.1 **Repository allowlist and production rules** in `src/lib/env.ts` (design D8, D15, D16).
  - Parse `CHECKPOINT_REPOS`, a comma-separated `owner/name` list. Trim each entry; the first is the default. Store it as `Env.CHECKPOINT_REPOS: string[]`, and drop the `CHECKPOINT_REPO` field from `Env`.
  - Accept `CHECKPOINT_REPO` alone as a one-entry list. With the fixture adapter, default to `["fixture/repo"]`.
  - Raise `EnvError` naming the variables for each of:
    - both variables set;
    - a malformed entry;
    - an empty list;
    - a case-insensitive duplicate;
    - more than one repository with `CHECKPOINT_GIT_HOST=fixture`;
    - `CHECKPOINT_GIT_HOST=fixture` under `NODE_ENV=production`.
  - Move the field's one production reader, `createHost` in `src/lib/githost/index.ts`, to `env.CHECKPOINT_REPOS[0]`, so the suite stays green until 2.1 replaces it.
  - Cover every scenario of `specs/repo-selection` "Repository allowlist" and `specs/deployment-config` "Production refuses the fixture adapter" in `src/lib/env.test.ts`. Update its existing `CHECKPOINT_REPO` assertions to the new field.
- [x] 1.2 **Repository resolution** in new `src/lib/repo.ts` (design D14, D9). `resolveRepo` is the only place a repository string is compared.
  - `resolveRepo(raw, repos)` trims the value, compares it case-insensitively against the list, and returns the configured entry. An empty value returns the default. No match returns `{ ok: false, requested }`.
  - `locationHref(path, { repo, ref })` builds `?repo=…&ref=…` with `encodeURIComponent` on both values and omits a missing one.
  - Tests in `src/lib/repo.test.ts` for every scenario of `specs/repo-selection` "The repository parameter resolves to one canonical entry", plus surrounding whitespace, mixed case, an unknown repository, and a `ref` containing a slash.
- [x] 1.3 **`compare` on the GitHub adapter** (design D17).
  - Add the `Comparison` type (`status: "ahead" | "identical" | "behind" | "diverged"`, `files: string[]`, `truncated: boolean`) and `GitHost.compare(base, head)` to `src/lib/githost/types.ts`.
  - Implement it in `src/lib/githost/github.ts` with `GET {repoBase}/compare/{base}...{head}`, each SHA `encodeURIComponent`-encoded.
  - Map `status`, `files[].filename` plus `previous_filename`, and `truncated` when the list holds 300 entries. Reuse the existing status-to-`HostError` mapping (404 → `not_found`).
  - Tests in `src/lib/githost/github.test.ts`, with stubbed `fetch`, for each "Compare two heads" scenario in `specs/git-host-adapter`, and for its "Two adapters read two repositories" scenario (two adapters, each request URL names its own repository).
- [x] 1.4 **`compare` on the fixture adapter** in `src/lib/githost/fixture.ts` (design D17).
  - Record, per ref, the initial head and every head a write produces, with the path that write touched.
  - `compare` returns `identical`, `ahead` with the paths written between the two heads, `behind`, or `not_found` for a head the adapter never produced.
  - `reset()` clears the history.
  - Add the compare scenarios to the shared suite in `src/lib/githost/contract.test.ts`.
- [x] 1.5 **Freshness classifier** in new `src/lib/checkpoint/freshness.ts` (design D6).
  - `classifyFreshness({ recordedHead, currentHead, comparison, change })` returns `"fresh" | "stale"`.
  - It tolerates exactly `changeFilePath(change, f)` for each `f` in `WRITABLE_FILES` from `src/lib/githost/guard.ts`, imported rather than restated.
  - Tests in `src/lib/checkpoint/freshness.test.ts`, one per case:
    - equal heads;
    - `ahead` touching only this change's `decisions.md` and `checkpoint.json`;
    - `identical`;
    - `ahead` touching `design.md`;
    - `ahead` touching another change's `checkpoint.json`;
    - `behind`;
    - `diverged`;
    - truncated;
    - absent comparison.
- [x] 1.6 **Pin the push link through sign-in** (`specs/access-gate` "A push link survives sign-in").
  - In `src/app/api/session/route.test.ts`: a session POST whose `next` is `/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar` answers 303 with exactly that `Location`.
  - In `src/proxy.test.ts`: an unauthenticated request for that URL, with the ref already `%2F`-encoded, redirects with the whole path and query preserved in `next`.
  - Tests only. If either fails, fix only `safeNextPath` in `src/lib/auth/session.ts` or `src/proxy.ts`.
- [x] 1.7 **Ledger fixtures for Interlock 1.13.0** (design D7).
  - In `scripts/gen-ledger-fixtures.mjs`, default `INTERLOCK_LIB_DIR` to the highest-semver directory under `~/.claude/plugins/cache/interlock/interlock/` that contains `lib/ledger.mjs`. `INTERLOCK_LIB_DIR` still wins, and the script exits 1 with a clear message when no such directory exists.
  - Run `INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures` (the newest installed plugin here is 1.12.0, and the version recorded must be 1.13.0). Only `fixtures/ledger/VERSION` may change. Report any other golden-file diff as a port defect rather than keeping it.
- [x] 1.8 **Write `docs/interlock-contract.md`**, versioned `interlock.checkpoint/1` (design §Scope and contract; D1, D4, D5, D6, D19, D20, D21). It must cover:
  - The click URL, with `repo` and `ref` both optional.
  - Field ownership in `checkpoint.json`: the sender owns `schema`, `change` and `request`; Checkpoint owns `decision`; both preserve unknown fields.
  - The `request` block fields, with `request.headSha` naming the commit that carries the artifacts.
  - The freshness rule and its two tolerated paths.
  - What a laptop gate must read for `approved` and fresh, `approved` and stale, `returned`, an absent file, and an unparseable file.
  - The opt-in publish sequence:
    1. Commit only the change directory.
    2. Write `checkpoint.json` as a second commit.
    3. Push the branch.
    4. Notify with `Click`.
  - That the laptop must `git pull` after a phone decision.
  - Escapement's `lib/checkpoint.mjs` and `lib/intake.mjs` as the existing consumer it agrees with.
- [x] 1.9 **Rewrite `README.md`** for deployed use (design D2, D3, D12).
  - **Environment table** with `CHECKPOINT_REPOS`, and `CHECKPOINT_REPO` as the one-entry fallback.
  - **Token scope:** one fine-grained token, owned by the repositories' owner, selecting every listed repository, Contents read and write.
  - **Key generation:** `openssl rand -base64 32`.
  - **"Deploying to Vercel"** as the eight-step runbook in design §Docs and the deploy runbook, including:
    - Deployment Protection on Standard;
    - handing the production URL to Interlock and `ESCAPEMENT_CHECKPOINT_URL`;
    - the iOS home-screen versus Safari cookie note.
  - **A "First test from your phone" checklist**, on a fresh change pushed to a `renzrollon/*` branch.
  - **"Open decision D1" becomes "Access gate"**, citing this change's D2 and the corrected list of files that import the session (`layout.tsx` and the server actions too).
  - **Tunnel path:** note that a production build refuses the fixture adapter.
  - **"Ledger fixtures"** with the new default path.
  - **The `checkpoint.json` contract section** shortened to a pointer to `docs/interlock-contract.md`.
- [x] 1.10 **Rewrite the integration story and fix the repo files** (design D1, D4, D19).
  - **`docs/how-checkpoint-works.md`:**
    - Interlock 1.13.0 already pushes, without a link.
    - The companion change adds the link, the publish step and the gates, per `docs/interlock-contract.md`.
    - `/interlock:spec` does not commit; the publish step does.
    - Corrected sequence diagram.
    - Ledger version 1.13.0.
    - "What is still open" reduced to the companion change and Escapement's `repo` parameter.
  - **`.env.example`:** `CHECKPOINT_REPOS=renzrollon/interlock,renzrollon/checkpoint`, plus the key-strength line.
  - **`.gitignore`:** add `.claude/ship/`.

## 2. Hosts per repository, and freshness wired into reads and writes

- [x] 2.1 **Host registry** in `src/lib/githost/index.ts` (design D3, D16).
  - `getHost(repo?)` keeps one host per canonical repository in the existing `globalThis` slot, now a `Map`, and throws for a repository outside `getEnv().CHECKPOINT_REPOS`. An omitted `repo` means the default, so the pages' existing `getHost()` calls keep working until section 3 passes the resolved repository.
  - It creates GitHub hosts with `{ repo, token }`, and the fixture host once, for the single fixture repository.
  - `getFixtureHost()` and `resetHost()` keep their meaning.
  - Tests in new `src/lib/githost/index.test.ts` for `specs/repo-selection` "One host per configured repository".
- [x] 2.2 **Freshness lookup in the views, wired into loads and writes** (design D6, D18, D22). One task: changing the view signatures and rewiring their callers in separate tasks leaves the suite red at the boundary.
  - **`src/lib/checkpoint/checkpoint.ts`:** `decisionView` and `riskView` take a required lookup, `(recordedHead: string) => "fresh" | "stale"`, in place of comparing with `!==`. Rewrite the two tests in `src/lib/checkpoint/checkpoint.test.ts` that pin the old equality rule, by name: "risk recorded for an older head is stale" and "flags a decision stale when the head moved" each go through the lookup with one fresh and one stale case.
  - **`src/lib/change/load.ts`:**
    - Add `freshnessFor(host, checkpoint, currentHead, change)`. It makes one `compare` per distinct recorded head that differs from the current head, concurrently, and reads any `HostError` as an absent comparison. It then calls `classifyFreshness`.
    - Add `advancePageHead(host, change, pageHead, newHead)` (design D23): `newHead` when the heads are equal or `classifyFreshness` reads `pageHead` fresh against it (one `compare`, a `HostError` reading as stale), otherwise `pageHead`.
    - Use `freshnessFor` in `loadChange`.
    - `listChanges` takes the decision state straight from the parsed `checkpoint.json` and makes no comparison.
  - **`src/lib/change/actions.ts`:**
    - `decide` resolves the current head before writing. When it differs from `input.headSha` (the page head), classify the page head against it with `classifyFreshness` over one `compare`: `stale` returns `{ ok: false, reason: "moved", message: "The branch moved past <short page head>; reload to read it" }` and writes nothing (no reloaded state, design D22); `fresh` proceeds. `decision.headSha` stays the page head.
    - On success `decide` builds its decision view through `freshnessFor` against the write's `commitSha`, and returns as `headSha` the result of `advancePageHead(host, change, input.headSha, commitSha)`.
    - `checkpointReload` takes the page head, uses `freshnessFor`, and reports its head through `advancePageHead`.
    - `answerRow` (D23) takes the page head as an optional `AnswerInput.headSha`, so the existing action caller still typechecks until 3.2. After its write it resolves the head and returns `advancePageHead(...)` as `headSha`, with `moved: true` when that is not the resolved head. With no page head given it returns `headSha: null` (the page head is left alone, which `onLedgerChange` already accepts) and `moved: false`. `AnswerResult`'s success `headSha` becomes `string | null` and gains `moved: boolean`. It reuses the `design.md` text already read for the pre-write view for the reference audit, and drops the second read and its "did not change" comment.
  - **Tests** in `src/lib/change/load.test.ts` and `src/lib/change/actions.test.ts`. First rewrite the two tests that pin the old equality rule, by name: in `load.test.ts`, "shows the approved decision and stale risk after the head moves" becomes two ancestry cases (a `checkpoint.json` write keeps decision and risk fresh; a `design.md` write makes both stale); in `actions.test.ts`, "approve writes the decision file with the head sha and the request preserved" drops its "a fresh load would call it stale" assertion and asserts the returned decision is fresh. Then add:
    - The branch moved past the page head with a `design.md` change: `decide` returns `moved`, and the host saw no `writeFile` (spy).
    - The branch moved only by a ledger answer since the render: `decide` writes, and `decision.headSha` is the page head.
    - `answerRow` with a `design.md` commit since the page head: the answer is written, `headSha` stays the page head, `moved` is true; a following `decide` with that page head returns `moved` and writes nothing (spy).
    - `answerRow` with no other commit: `headSha` is the new head and `moved` is false.
    - `advancePageHead` unit cases: equal heads (no `compare` call), fresh, stale, `compare` throws.
    - Approve, then reload: fresh, with the header head equal to the approval commit.
    - An answer after an approval: still fresh.
    - A stub host whose `compare` reports `design.md`: stale.
    - A stub host whose `compare` throws: page still loads, decision stale.
    - The inbox makes no `compare` call (spy).

## 3. Pages, actions and components

- [x] 3.1 **Page context and the two spoken failure pages.**
  - **New `src/lib/page-context.ts`.** From a page's `searchParams` it resolves:
    - the environment, where an `EnvError` becomes `{ kind: "config", missing }`;
    - the repository via `resolveRepo`, where no match is `{ kind: "unknown_repo", requested, repos }`;
    - the host via `getHost(repo)`;
    - the trimmed `ref`.
  - **New `src/components/ConfigError.tsx`:** "Checkpoint is not configured", then the names from `EnvError.missing`. Never the error message or a value.
  - **New `src/components/UnknownRepo.tsx`:** "Checkpoint is not configured for <requested>", with `locationHref` links to each configured repository.
  - Tests beside each file, for `specs/deployment-config` "Configuration errors are spoken by name" and `specs/repo-selection` "Unknown repository is spoken, not guessed".
- [x] 3.2 **Server actions** in `src/app/changes/[name]/actions.ts` (`specs/repo-selection` "Writes re-validate the repository"; `specs/deployment-config` "A write under a broken configuration").
  - Add `repo` to `AnswerActionInput` and `DecideActionInput` as an optional field (an omitted value resolves to the default repository), so the components, which only start passing it in 3.4, still typecheck. 3.4 makes it required. Add an optional `headSha` to `AnswerActionInput` (design D23) and pass it into `answerRow`.
  - Resolve it with `resolveRepo` before anything else. Answer `{ ok: false, reason: "unknown_repo" }` or `{ ok: false, reason: "config" }` (variable names only) without writing.
  - Call `answerRow` and `decide` with `getHost(canonical)`.
  - Tests in new `src/app/changes/[name]/actions.test.ts`, with the session check and hosts mocked.
- [x] 3.3 **Inbox** (`specs/change-inbox` "List active changes on a ref"; `specs/repo-selection` "Links keep the repository and branch"). Depends on 3.1.
  - `src/app/page.tsx` uses the page context and renders `ConfigError` or `UnknownRepo` when it says so. It shows the repository in the header when more than one is configured.
  - New `src/components/InboxControls.tsx`:
    - a `GET` form labelled "Branch", with `repo` as a hidden input;
    - with more than one repository, a picker of `locationHref` links that marks the current one with `aria-current="page"` and drops `ref`.
  - `src/components/ChangeCard.tsx` links through `locationHref` with `repo` and `ref`.
  - Update `src/app/page.test.tsx` and `src/components/ChangeCard.test.tsx`; add `src/components/InboxControls.test.tsx`.
- [x] 3.4 **Change page** (`specs/change-reading` "Header with counts and denominators" and "Change page failures are spoken"). Depends on 3.1, and on 3.2 for the action input types.
  - `src/app/changes/[name]/page.tsx` uses the page context. The not-found page names the repository when more than one is configured, and its inbox link keeps `repo` and `ref`.
  - `src/components/ChangeWorkspace.tsx` receives `repo` and whether to show it, passes `repo` into every `LedgerPanel`, `AnswerForm` and `DecisionBar` action call, and takes the header head from a decision result's `headSha`.
  - Make `repo` required on both action input types and `headSha` required on `AnswerActionInput`, and pass them from `AnswerForm` and `LedgerPanel` into the answer call.
  - `src/components/DecisionBar.tsx` renders a `moved` result as "The branch moved past <short page head>; reload to read it" with a Reload control (`window.location.reload()`). It does not adopt any new head, and it keeps the typed note, so a second tap is refused again until the page is reloaded (design D22, D23).
  - `src/components/LedgerPanel.tsx` shows, for an answer result with `moved: true`, that the branch also moved and the page must be reloaded before approving; the workspace head does not change.
  - `src/components/ChangeHeader.tsx` shows the repository when more than one is configured, and gains an "Inbox" link built with `locationHref`.
  - Update for the `repo` field: `src/app/changes/[name]/page.test.tsx`, `src/components/ChangeHeader.test.tsx`, `src/components/LedgerPanel.test.tsx`, `src/components/AnswerForm.test.tsx`, `src/components/DecisionBar.test.tsx`. Add:
    - `DecisionBar.test.tsx`: a `moved` result shows the message and the Reload control, keeps the note, and the next submit carries the same `headSha` as the first.
    - `LedgerPanel.test.tsx`: an answer result with `moved: true` shows the moved notice and does not call `onLedgerChange` with a new head.
- [x] 3.5 **Chrome header with a canonical home link** (`specs/repo-selection` "Back to the inbox stays on the branch", its canonical-repository edge case and its no-query edge case; design D9, D14). Depends on 3.1, 3.3 and 3.4, which edit the same page files and page tests.
  - New server component `src/components/Chrome.tsx`: the whole header bar, the "Checkpoint" home link built with `locationHref` from props `repo?: string` and `ref?: string`, and the `SignOut` control. It never reads the URL, and renders only for a signed-in session, as the layout did.
  - `src/app/layout.tsx` stops rendering the header bar and drops its now unused imports. `src/app/page.tsx`, `src/app/changes/[name]/page.tsx`, `ConfigError` and `UnknownRepo` render `Chrome` with the canonical values from the page context, or with none. New `src/app/not-found.tsx` renders `Chrome` with none, so an unknown URL keeps Sign out and a bare `/` home link.
  - Test in `src/components/Chrome.test.tsx`: a canonical repo and a ref with a slash are encoded; no props gives bare `/`; Sign out is rendered; `not-found.tsx` renders the bar. In `src/app/changes/[name]/page.test.tsx`: a request with `?repo=RENZROLLON%2FInterlock` renders the home link with `renzrollon%2Finterlock`.
- [x] 3.6 **Answer-form reference warning** (design D10; `specs/ledger-answering` "Answering warns when the design does not reference the row"). Depends on 3.4, which edits the same `AnswerForm.tsx` and `LedgerPanel.tsx`.
  - Export `referenceResolves` from `src/lib/ledger/ledger.ts`.
  - Add `unreferenced: string[]` to the ledger view built by `ledgerViewFrom` in `src/lib/change/load.ts`, computed with that same matcher.
  - Carry it through the reloaded-ledger results in `src/lib/change/actions.ts`, through `LedgerState` in `src/components/LedgerPanel.tsx`, and into the initial `LedgerState` built in `src/components/ChangeWorkspace.tsx`.
  - `src/components/AnswerForm.tsx` shows the spec's warning text above the submit control and still submits.
  - Tests:
    - the `D1`-versus-`D10` token case and a missing `design.md`, in `src/lib/change/load.test.ts`;
    - warning shown and hidden, in `src/components/AnswerForm.test.tsx`.

## 4. The phone loop end to end

- [x] 4.1 **New e2e test `e2e/phone-loop.spec.ts`**, on the fixture adapter at 375 px.
  1. Open `/changes/add-user-auth?repo=fixture%2Frepo&ref=carlrollon%2Fsunstar` signed out and sign in. It lands on that change, with `carlrollon/sunstar` in the header.
  2. Answer D1 and approve, then reload. The approval shows without a stale label.
  3. Tap the chrome "Checkpoint" link. The inbox opens for `carlrollon/sunstar`.
  4. Use the Branch field to open `main`.

  Also:
  - Switch `playwright.config.ts` to `CHECKPOINT_REPOS: "fixture/repo"`.
  - Keep `e2e/checkpoint.spec.ts` green with the new links.
- [x] 4.2 **Full verification.** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` and `npm run build` all pass.
  - The build runs outside the Bash sandbox with `.next` cleared, per `.claude/memory/failure-modes/next-build-needs-port-binding.md`.
  - Fix any failure at its root cause in the file that owns it.

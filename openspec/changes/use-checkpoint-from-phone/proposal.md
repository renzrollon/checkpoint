## Why

Checkpoint is built and reachable from a phone, but the owner still cannot use it. It has never been deployed. The push Interlock 1.13.0 sends at a spec checkpoint opens nothing. Once the owner approves on the phone, the next reload calls that same approval stale, because the approve commit moves the head it was compared against. One tap anywhere in the app drops the feature branch the change lives on. And the deployment can reach only one repository, while Interlock runs in several and pushes them all to one ntfy topic.

This change makes the Checkpoint side of the loop work end to end, and writes the contract the Interlock side implements: Interlock stops, the phone buzzes, one tap opens the change on its branch, the owner answers and approves, and the laptop can tell whether that approval still holds. The Interlock half (click link, `request` block, opt-in publish step, `ready` and ship honouring **Send back**) is a companion change in the specflow repository (decision D1). It is built against `docs/interlock-contract.md` from this change.

## What Changes

- **Freshness by ancestry, not equality.** A recorded decision or risk stays fresh while the only commits on top of its head touch the change's `decisions.md` or `checkpoint.json`. That is the rule Escapement already applies. Approve-then-reload shows the approval as current, and answering a row no longer marks the sender's risk stale. The git host adapter gains a `compare(base, head)` read, on GitHub and in the fixture.
- **Several repositories per deployment.** `CHECKPOINT_REPOS` is an allowlist of `owner/name`, and the first entry is the default. Every route takes `?repo=`, matched case-insensitively to its canonical allowlist entry. An unknown repository is spoken, not guessed. Each repository gets its own host. Server actions re-validate the repository before they write. `CHECKPOINT_REPO` keeps working as a one-entry list, and setting both variables is a configuration error.
- **Navigation keeps the branch.** The chrome home link, inbox cards and a new change-page inbox link all carry `repo` and `ref`. The inbox gains a branch field and, when more than one repository is configured, a repository picker. The change header shows the repository when more than one is configured.
- **Push links land.** The click URL is `/changes/<change>?repo=<owner/name>&ref=<branch>`, and a repo-less URL opens the default repository. That URL is pinned through sign-in by unit tests and an e2e test on a branch name containing a slash.
- **Production fails closed and speaks.** The fixture adapter is refused when `NODE_ENV=production`. A configuration error renders a page naming the variables, never their values, instead of Next's digest page.
- **Answer-form warning.** When `design.md` never mentions a row's id, the answer form says the row will read as invalid on the laptop until the design references it.
- **Ledger fixtures for 1.13.0.** `fixtures/ledger/VERSION` is regenerated from Interlock 1.13.0, whose ledger grammar is unchanged since 0.2.0 (its table helpers moved to `lib/md-table.mjs`; the goldens regenerate byte-identical). The generator's default path resolves the newest installed plugin instead of the deleted 0.2.0 cache.
- **Docs.**
  - New `docs/interlock-contract.md`: the click URL, who owns which `checkpoint.json` fields, the freshness rule, and what `approved`, a stale approval, `returned` and an absent file mean to a laptop gate.
  - A README deploy runbook for Vercel: env vars, the token selecting several repositories, key generation, Deployment Protection, and handing the URL to Interlock and Escapement.
  - A first-phone-test checklist.
  - A rewritten integration story in `docs/how-checkpoint-works.md`.
  - `.env.example` and `.gitignore` corrected.
- **BREAKING (config only).** Deployments that set both `CHECKPOINT_REPO` and `CHECKPOINT_REPOS` stop with a configuration error. Production deployments that set `CHECKPOINT_GIT_HOST=fixture` stop with a configuration error.

Not in this change:
- Anything in specflow: sender, publish step, `Click` header, `ready` and run-start gates.
- Escapement's click URL gaining `repo`.
- Creating the Vercel project or tokens (the owner follows the runbook).
- Rate limiting the login.
- A branch-listing API.
- A GitLab adapter.

## Capabilities

### New Capabilities
- `repo-selection`: the repository allowlist, canonical resolution of `?repo=`, the default repository, the spoken unknown-repository page, per-repository hosts, server-side re-validation on writes, and links that keep the repository and branch.
- `deployment-config`: production configuration rules (the fixture adapter refused in production, conflicting repository variables refused) and configuration errors rendered by variable name without values.

### Modified Capabilities
- `git-host-adapter`: reads are scoped to the repository a host was created for, and a new `compare` read reports ancestry and changed paths between two heads, on both adapters.
- `checkpoint-decision`: a decision is stale by the ancestry rule, not head equality, so a decision is current right after it is written.
- `change-reading`: risk is stale by the same ancestry rule; the header shows the repository when more than one is configured; the page offers an inbox link that keeps repository and branch.
- `change-inbox`: the inbox reads `repo` as well as `ref`, offers a branch field and a repository picker, and its cards link with both.
- `ledger-answering`: the answer form warns when `design.md` does not reference the row being answered.
- `access-gate`: the preserved `next` path is pinned to keep its query (`repo`, and a `ref` containing a slash) through sign-in.

## Impact

- **Adapter:** `src/lib/githost/types.ts`, `github.ts`, `fixture.ts`, `index.ts`, and the shared contract test.
- **Environment:** `src/lib/env.ts`, plus a new repository resolver under `src/lib/`.
- **Freshness:** a new pure classifier under `src/lib/checkpoint/`, wired into `checkpoint.ts`, `src/lib/change/load.ts` and `src/lib/change/actions.ts`.
- **Pages and actions:** `src/app/page.tsx`, `src/app/changes/[name]/page.tsx`, `src/app/changes/[name]/actions.ts`, `src/app/layout.tsx`, and the fixture file route.
- **Components:** `ChangeCard`, `ChangeHeader`, `ChangeWorkspace`, `LedgerPanel`, `AnswerForm`, `DecisionBar`, and new home-link, inbox-controls and configuration-error components.
- **Tests:** unit and component tests beside each file, one new e2e spec, and `playwright.config.ts`.
- **Repo files:** `scripts/gen-ledger-fixtures.mjs`, `fixtures/ledger/VERSION`, `README.md`, `docs/how-checkpoint-works.md`, new `docs/interlock-contract.md`, `.env.example` and `.gitignore`.
- **GitHub API:** one extra request (`compare`) on a change page only when a recorded head differs from the current head. The inbox's request count is unchanged.
- **Dependencies:** no new dependencies and no version changes.

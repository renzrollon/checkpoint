# Checkpoint readiness and setup

This checkout is at `/Users/caro/IdeaProjects/checkpoint` on `main` (`b383bf9`). The working tree was clean when this guide was written. Local `main` was one commit ahead of `origin/main` (`https://github.com/renzrollon/checkpoint.git`); that commit adds graph and docs-digest files under `.claude/` and is not required to run the app.

## What this is

Checkpoint is a phone-sized Next.js app for the person who owns an [Interlock](https://github.com/renzrollon/specflow) change. When `/interlock:spec` stops for a human read, Checkpoint shows that change's OpenSpec artifacts and decision ledger, lets the owner answer a `needs_human` row, and records **Approve** or **Send back** by committing two files on the same git ref: `openspec/changes/<change>/decisions.md` and `openspec/changes/<change>/checkpoint.json`.

There is no database. The git host is the backend. Local development can use a bundled fixture tree instead of GitHub. The longer integration story is in [how-checkpoint-works.md](./how-checkpoint-works.md). Behavior contracts live in `openspec/specs/`.

## Readiness verdict

**Ready with caveats.**

You can run it on this machine against the bundled fixture repository. That path needs Node.js 24 or newer, an `npm install`, and an access key. It does not need a GitHub token, a database, or Docker.

### In place

- `README.md` documents environment variables, a fixture dev command, a GitHub dev command, phone testing, and a Vercel deploy.
- `.env.example` lists every variable the app reads.
- `package.json` defines `dev`, `build`, `start`, `lint`, `typecheck`, `test`, and `test:e2e`. `package-lock.json` is lockfileVersion 3.
- `engines.node` is `>=24`.
- Unit and component tests, `tsc --noEmit`, and ESLint completed successfully in this review (details under [What this review checked](#what-this-review-checked)).
- Fixture data for two sample changes is in `fixtures/repo/`. Ledger parity files are in `fixtures/ledger/` (Interlock 0.2.0).

### Before a working local run

- **Do not treat a raw copy of `.env.example` as a working config.** `CHECKPOINT_ACCESS_KEY` is empty, so every gated route answers `503` with `Checkpoint has no access key configured`. `CHECKPOINT_GIT_HOST` is `github` and `CHECKPOINT_GITHUB_TOKEN` is empty, so the first read throws `Checkpoint environment is incomplete` and names `CHECKPOINT_GITHUB_TOKEN`. The example also sets `CHECKPOINT_REPO=renzrollon/specflow`; replace that when you point at your own repository.
- **Node.js 24 or newer is required.** The manifest says `>=24`. There is no `.nvmrc`, `.node-version`, or `.tool-versions` file.
- **GitHub mode needs a fine-grained personal access token** with Contents read and write on the single repository in `CHECKPOINT_REPO`, plus network access to `https://api.github.com`. The adapter sends `X-GitHub-Api-Version: 2022-11-28`.

### Does not block the fixture run

- No CI workflow, `LICENSE`, or `CONTRIBUTING` file is in the tree. Nothing in the repo runs tests on push.
- No health-check route exists. Confirm the app by signing in and reading the inbox, or by running the test scripts.
- Playwright end-to-end was not run for this review. `npm run test:e2e` starts its own dev server. The repo does not document a browser-install command.
- Interlock 0.2.0 does not read `checkpoint.json` and does not send the phone push. Answering the ledger from Checkpoint is what clears `interlock ready`. Approve on the phone writes an audit file on the branch. See [how-checkpoint-works.md](./how-checkpoint-works.md).
- The dev server and production server were not started for this review, so the browser flow was not exercised here.

## Prerequisites

| Tool | What the repo says | Observed on this machine |
|---|---|---|
| Node.js | `>=24` in `package.json` `engines` | `v26.8.1` (`/Users/caro/.local/bin/node`) |
| npm | Scripts and `package-lock.json` use npm. No `packageManager` field. No pnpm or Yarn lockfile. | `11.19.0` (inferred as the client that matches the lockfile; the repo does not pin an npm version) |
| Git | Reads and writes a GitHub repo in production. The fixture path does not call `git`. | Present; remote `origin` is `https://github.com/renzrollon/checkpoint.git` |

Not required for the fixture path: Docker, Compose, a database, Redis, or a running Interlock install. `npm run gen:ledger-fixtures` is the one script that imports Interlock, and only when you regenerate golden files. Its default `INTERLOCK_LIB_DIR` is `~/.claude/plugins/cache/interlock/interlock/0.2.0/lib`. The README also shows `INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib`.

## Complete setup guide

### 1. Use this checkout

The repo is already at `/Users/caro/IdeaProjects/checkpoint`. From a clean machine, clone and enter it:

```sh
git clone https://github.com/renzrollon/checkpoint.git
cd checkpoint
```

`node_modules` was already present in this checkout. A clean clone still needs the install step below.

### 2. Install dependencies

```sh
npm install
```

That is the command the README documents. `package-lock.json` is in the repo if you prefer a lockfile install with npm.

### 3. Configure the fixture (no GitHub token)

The README's first-run command sets the two variables the fixture path needs. You do not have to create a file:

```sh
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run dev
```

`CHECKPOINT_ACCESS_KEY` is the shared password you will type at `/login`. `dev` is the value in the README example. Pick another string if you want; use that same string on the login page.

What those variables do:

| Variable | Fixture path |
|---|---|
| `CHECKPOINT_GIT_HOST` | `fixture` serves `fixtures/repo` and keeps writes in memory. Default when unset is `github`. |
| `CHECKPOINT_ACCESS_KEY` | Required to get past the gate. A missing or blank value fails closed with HTTP 503. |
| `CHECKPOINT_FIXTURE_DIR` | Optional. Defaults to `fixtures/repo`. |
| `CHECKPOINT_REPO` | Optional in fixture mode. Defaults to `fixture/repo`. |
| `CHECKPOINT_GITHUB_TOKEN` | Unused in fixture mode. |
| `CHECKPOINT_DEV_ORIGINS` | Optional. Only for opening the dev server from another device. Ignored by `npm start` and by Vercel. |

To keep the same settings across runs, copy the example and edit it. Next.js reads `.env.local` for `npm run dev`, `npm run build`, and `npm start`. `.gitignore` ignores `.env*.local`.

```sh
cp .env.example .env.local
```

Then set at least:

```sh
CHECKPOINT_ACCESS_KEY=dev
CHECKPOINT_GIT_HOST=fixture
```

Leave `CHECKPOINT_GITHUB_TOKEN` empty while `CHECKPOINT_GIT_HOST=fixture`. This checkout had no `.env` and no `.env.local`.

A command-line assignment applies to that process. If `.env.local` still says `CHECKPOINT_GIT_HOST=github`, prefix the dev command with `CHECKPOINT_GIT_HOST=fixture` so the process environment selects the fixture.

### 4. Services

None. Fixture mode reads `fixtures/repo/openspec/changes/` from disk. Writes go to an in-memory overlay. Restarting the dev server drops them. The files under `fixtures/repo/` stay as they are in git.

GitHub mode (later) talks only to `https://api.github.com`. There is still no database.

### 5. Run the dev server

From the repo root:

```sh
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run dev
```

The README opens the app at <http://localhost:3000>. The repo does not set a custom port for `npm run dev`. Playwright uses port **3100** for its own server; leave that port free if you will run `npm run test:e2e` while a dev server is up, or stop the dev server first. The e2e config sets `reuseExistingServer: false` and starts `npm run dev -- --port 3100`.

Other documented modes:

**Production build on this machine**

```sh
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run build
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm start
```

`npm start` serves the production build. The README's tunnel example assumes that process is on port 3000. `CHECKPOINT_DEV_ORIGINS` has no effect here.

On a production build, or any request that arrived over HTTPS, the session cookie is `Secure`. A phone that opens `http://<lan-address>:3000` against `npm start` can accept the key and then return to the login page, because the browser will not store that cookie over plain HTTP. Use `npm run dev` for plain-HTTP LAN testing.

**Phone on the same Wi-Fi, dev server**

```sh
ipconfig getifaddr en0
CHECKPOINT_DEV_ORIGINS=<that-address> \
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev \
npm run dev -- -H 0.0.0.0
```

Open `http://<that-address>:3000` on the phone. `CHECKPOINT_DEV_ORIGINS` is read once when the dev server starts. Restart `npm run dev` after changing it. `127.0.0.1` is always allowed. The value is a hostname (Next wildcard syntax such as `*.example.dev` is allowed), not a full URL.

**GitHub repository**

Create a fine-grained personal access token at <https://github.com/settings/personal-access-tokens> with access limited to the one repository in `CHECKPOINT_REPO` and permission **Contents: Read and write**.

```sh
CHECKPOINT_GIT_HOST=github \
CHECKPOINT_REPO=owner/name \
CHECKPOINT_GITHUB_TOKEN=github_pat_... \
CHECKPOINT_ACCESS_KEY=... \
npm run dev
```

Put the same values in `.env.local` if you do not want them in the shell history. The token is not logged. Validation runs on first use and names a missing variable. It does not echo the token.

Every page takes `?ref=<branch>` and otherwise uses the repository default branch. The fixture default branch is `main`. The header shows the ref and the short head SHA the page was rendered from.

**Vercel**

The README's deploy steps: create a Vercel project from this repository, set `CHECKPOINT_ACCESS_KEY`, `CHECKPOINT_GITHUB_TOKEN`, `CHECKPOINT_REPO`, and `CHECKPOINT_GIT_HOST=github` for Production, then deploy. The app ships a web manifest and icons under `public/icons/`. Rollback is deleting the deployment. Nothing persists outside the target repository branch.

### 6. Confirm it works

The repo defines no health URL. With the fixture server running and `CHECKPOINT_ACCESS_KEY=dev`:

1. Open <http://localhost:3000>. You should land on the login page ("Enter the access key to read the change waiting on you.").
2. Enter `dev` and sign in.
3. The inbox lists `add-user-auth` first with **1 needs you**, then `add-report-flag` with a clear ledger and an approved decision. The header shows ref `main`. The archive sample under `fixtures/repo/openspec/changes/archive/` is omitted.
4. Open `add-user-auth`. Approve stays unavailable while the ledger still has a `needs_human` row. The Ledger tab can answer row D1. After that answer, Approve is offered. Send back stays available and requires a note.
5. Restart the dev server if you want the fixture files back to their on-disk state. The overlay is memory-only.

A wrong key returns `That key was not accepted` and stays on the login form.

Commands that do not start the app, run from the repo root:

```sh
npm test
npm run typecheck
npm run lint
```

`npm test` is Vitest (`src/**/*.test.{ts,tsx}`, jsdom). `npm run test:e2e` is Playwright at a 375×812 viewport. It signs in with `e2e-access-key` (set by `playwright.config.ts`, not by your `.env.local`), answers D1, approves, and reads the committed files through `GET /api/fixture/file`, which exists only when `CHECKPOINT_GIT_HOST=fixture`.

### 7. Failures the repo already names

| What you see | What to check |
|---|---|
| `503` and the text `Checkpoint has no access key configured` | `CHECKPOINT_ACCESS_KEY` is unset or blank. Set it and restart the server. |
| `That key was not accepted` | The value typed at `/login` does not match `CHECKPOINT_ACCESS_KEY`. |
| `Checkpoint environment is incomplete` naming `CHECKPOINT_GITHUB_TOKEN` or `CHECKPOINT_REPO` | `CHECKPOINT_GIT_HOST` is `github` (the default) and the token or `owner/name` repo is missing. Use `fixture` for the local sample, or fill both GitHub variables. `CHECKPOINT_REPO` must match `owner/name` with no spaces. |
| `CHECKPOINT_GIT_HOST must be "github" or "fixture"` | The variable is some other string. |
| Inbox text `GitHub rejected the token (unauthorized)` | GitHub returned 401. Replace the fine-grained token. |
| `GitHub refused (forbidden)` with a retry time | GitHub returned 403 or 429. The UI includes the reset time when GitHub sent `x-ratelimit-reset` or `Retry-After`. |
| `GitHub unreachable (upstream)` | The contents API could not be reached, or GitHub returned 5xx. |
| `403 Blocked cross-origin request` on `_next/*` when a phone loads the dev server | Set `CHECKPOINT_DEV_ORIGINS` to the host the phone used, and restart `npm run dev`. |
| Login succeeds, then the phone returns to `/login` on a LAN address | You are on `npm start` (or HTTPS) over plain HTTP, so the `Secure` cookie is not stored. Use `npm run dev` for that LAN check. |
| Answered ledger rows disappeared after a restart | Expected in fixture mode. The overlay is in memory. |
| `npm run build` fails with a port-binding error and a bad `.next` cache | Documented for a sandbox that forbids binding a localhost port (Next 16 Turbopack's PostCSS worker). Remove `.next` and rerun the build where binding localhost is allowed. |

## Project layout

| Path | Why it matters |
|---|---|
| `src/app/page.tsx` | Inbox at `/`. |
| `src/app/login/page.tsx` | Access-key form. |
| `src/app/changes/[name]/page.tsx` | One change: proposal, design, tasks, specs, ledger, approve / send back. |
| `src/app/api/session/route.ts` | `POST` exchanges the key for a 30-day `checkpoint_session` cookie. `DELETE` signs out. |
| `src/proxy.ts` | Gate on every route except `/login`, `/api/session`, the manifest, and `/icons/*`. |
| `src/lib/env.ts` | Zod check of the environment on first use. |
| `src/lib/githost/` | `github` and `fixture` adapters. Writes are limited to the two files above. |
| `src/lib/ledger/ledger.ts` | TypeScript port of Interlock's ledger parser. |
| `src/lib/checkpoint/checkpoint.ts` | `interlock.checkpoint/1` decision file. |
| `src/components/` | Inbox cards, artifact tabs, ledger panel, decision bar. |
| `fixtures/repo/` | Sample repository the fixture adapter serves. |
| `fixtures/ledger/` | Golden parse/serialize files. `VERSION` records Interlock 0.2.0. |
| `e2e/checkpoint.spec.ts` | One Playwright smoke. |
| `openspec/specs/` | Current behavior specs (inbox, reading, ledger answering, checkpoint decision, git host, access gate). |
| `openspec/changes/archive/` | Archived design changes. No active change directory. |
| `docs/how-checkpoint-works.md` | How the phone app meets the laptop gate, and what Interlock still does not do. |
| `public/icons/` | Home-screen icons. |
| `scripts/gen-ledger-fixtures.mjs` | Regenerates ledger goldens from an Interlock install. |
| `scripts/gen-icons.mjs` | Icon generator. Not part of first-run setup. |

## Next steps after the first run

From the repo root:

```sh
npm test
npm run typecheck
npm run lint
npm run test:e2e
```

`test:e2e` starts and stops its own server on port 3100. The repo does not say to install Playwright browsers separately. If that command fails because a browser is missing, use the install instruction Playwright prints. This review did not run it.

Once the inbox is up, the owner workflow is: open the blocking change, read the tabs, answer each `needs_human` row, then **Approve** or **Send back**. Commit messages the app writes are `checkpoint(<change>): answer <id>`, `checkpoint(<change>): approve`, and `checkpoint(<change>): return`. A human answer sets the evidence cell to `human decision <YYYY-MM-DD> via Checkpoint` (UTC date).

To judge a real branch, switch to the GitHub variables in step 5 and open `/?ref=<branch>` or `/changes/<change>?ref=<branch>`.

Phone checks and the Vercel path are in the README sections "Testing from your phone" and "Deploying to Vercel". What still lives only on the Interlock side (the ntfy push, and any `interlock ready` check of `checkpoint.json`) is in [how-checkpoint-works.md](./how-checkpoint-works.md).

## What this review checked

On this machine, with dependencies already installed:

- `node -v` → `v26.8.1` (satisfies `>=24`)
- `npm -v` → `11.19.0`
- `.env.example` present; `.env` and `.env.local` absent
- `npm test` → 23 files, 218 tests passed (Vitest 4.1.10)
- `npm run typecheck` → passed
- `npm run lint` → passed

Not run: `npm run dev`, `npm run build`, `npm start`, and `npm run test:e2e` (those start or bind a server). A Playwright browser cache exists under the user Library folder; this review did not check that those builds match `@playwright/test` 1.62.1. No GitHub token was present, so the live GitHub adapter was not called.

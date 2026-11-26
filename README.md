# Checkpoint

> **Status:** ready to deploy. The Checkpoint side is complete; the Interlock side (the push link and publish step) is specified in `docs/interlock-contract.md`.

Checkpoint is the phone-sized inbox for the one decision an unattended
Interlock run cannot make. `/interlock:spec` stops at a human read, and
`interlock ready` refuses to continue while a `needs_human` row remains in a
change's `decisions.md`. Checkpoint reads that change from a branch on GitHub,
renders `proposal.md`, `design.md`, `tasks.md`, the delta specs and the ledger
for a 375 px screen, lets the owner answer the row, and records **Approve** or
**Send back** as a file on the same branch.

The phone never talks to the laptop. The git host is the message bus: every
read is a read on a ref, every write is a commit, and there is no database.
The app holds one repository token and nothing else (one deployment serves every repository in its allowlist), and it writes exactly two
files, `openspec/changes/<change>/decisions.md` and
`openspec/changes/<change>/checkpoint.json`.

Every number the app shows is computed from the artifacts on the ref, with its
denominator. Anything the sender did not record is shown as `unobserved`, never
guessed.

For the longer story, what problem this solves, how it meets Interlock's
ledger and `checkpoint.json` contracts, see `docs/how-checkpoint-works.md`. The
wire contract both sides build against is `docs/interlock-contract.md`.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `CHECKPOINT_ACCESS_KEY` | for any access | Shared access key exchanged at `/login` for a 30-day httpOnly session cookie. When unset, every gated route answers `503 Checkpoint has no access key configured`. The app fails closed. Generate it with `openssl rand -base64 32` (below). |
| `CHECKPOINT_GIT_HOST` | yes | `github` in production, `fixture` for local development and tests. Defaults to `github`. A production build (`NODE_ENV=production`) refuses `fixture`. |
| `CHECKPOINT_REPOS` | with `github` | Comma-separated `owner/name` allowlist of the repositories the app may read and write, for example `renzrollon/interlock,renzrollon/checkpoint`. The first entry is the default. Duplicates (case-insensitive) and malformed entries are refused. |
| `CHECKPOINT_REPO` | fallback | The older single-repository variable, read as a one-entry `CHECKPOINT_REPOS`. Setting both is a configuration error. |
| `CHECKPOINT_GITHUB_TOKEN` | with `github` | Fine-grained personal access token covering every listed repository (scope below). Never logged, never included in an error message. |
| `CHECKPOINT_FIXTURE_DIR` | with `fixture` | Directory served as the repository. Defaults to `fixtures/repo`. The fixture adapter serves exactly one repository, `fixture/repo` unless named. |
| `CHECKPOINT_DEV_ORIGINS` | no, development only | Comma-separated extra origins `npm run dev` may serve `_next/*` to, so a phone on the LAN can load the app ("Testing from your phone" below). `127.0.0.1` is always allowed. Read once at dev-server startup; `next start` and Vercel ignore it. |

Copy `.env.example` to `.env.local` and fill it in. Validation runs on first
use. A page that cannot start says "Checkpoint is not configured" and names the
variables at fault, never their values.

### Generating the access key

```sh
openssl rand -base64 32
```

The login is not rate limited, so brute-force resistance rests on the key's
entropy. Use a random 32-byte key, not a phrase.

## GitHub token scope

Create **one** fine-grained personal access token at
<https://github.com/settings/personal-access-tokens>:

- **Resource owner:** the account that owns the repositories (for example `renzrollon`).
- **Repository access:** select every repository listed in `CHECKPOINT_REPOS`, and no others.
- **Permissions:** Contents, **read and write**. Nothing else.

Read access is enough to render a change. Write access is what commits the
answered ledger row and the decision file. The adapter refuses any path other
than the two files above before it makes a request, so the token's blast
radius is those two files on whatever branch the owner is looking at.

## Running locally

Without a token, on the bundled fixture repository:

```sh
npm install
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run dev
```

Open <http://localhost:3000>, enter `dev` at the login page, and the inbox
lists the two sample changes under `fixtures/repo/openspec/changes/`.
`add-user-auth` carries one `needs_human` row; `add-report-flag` has a clear
ledger and an approved `checkpoint.json`. Writes go to an in-memory overlay,
so the files on disk never change; restart the server to reset them.

Against real repositories:

```sh
CHECKPOINT_GIT_HOST=github \
CHECKPOINT_REPOS=owner/one,owner/two \
CHECKPOINT_GITHUB_TOKEN=github_pat_... \
CHECKPOINT_ACCESS_KEY=... \
npm run dev
```

Every page takes `?repo=<owner/name>` and `?ref=<branch>`. A missing `repo` is
the first configured repository and a missing `ref` is its default branch; a
`repo` outside the allowlist is refused by name, never replaced by the default.
The header always shows the ref and the short head SHA the page was rendered from.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit and component tests (Vitest, jsdom) |
| `npm run test:e2e` | Playwright smoke on the fixture adapter at 375 px |
| `npm run gen:ledger-fixtures` | Regenerate the ledger golden files (below) |

## Deploying to Vercel

Checkpoint is a plain Next.js app with no Vercel-specific code. Nothing here is
done for you; follow it once.

1. **Create the Vercel project** from `renzrollon/checkpoint`, branch `main`.
2. **Mint one fine-grained token**, owned by the account that owns the
   repositories, selecting every repository in `CHECKPOINT_REPOS`, with
   Contents read and write ("GitHub token scope" above).
3. **Generate the access key** with `openssl rand -base64 32`.
4. **Set the environment** for Production: `CHECKPOINT_ACCESS_KEY`,
   `CHECKPOINT_GITHUB_TOKEN`, `CHECKPOINT_REPOS` and `CHECKPOINT_GIT_HOST=github`.
5. **Keep Deployment Protection on Standard.** That covers previews and
   generated URLs. The production domain is gated by the access key alone, and
   push links point at the production domain.
6. **Deploy and add to the home screen.** The app ships a web manifest and icons
   and needs no service worker. On iOS the home-screen app and Safari keep
   separate cookies, so a push tap may ask for the key once; the link survives
   sign-in.
7. **Hand the production URL to the laptop:** Interlock's Checkpoint URL option
   (from the companion change in specflow) and `ESCAPEMENT_CHECKPOINT_URL`.
8. **Run the first phone test** below.

Rollback is deleting the deployment. Nothing persists outside the target
repositories' branches. Reverting to a single repository only needs
`CHECKPOINT_REPO`.

### First test from your phone

On a fresh change pushed to a `renzrollon/*` branch:

- [ ] Open `<production URL>/changes/<change>?repo=<owner/name>&ref=<branch>` on the phone. Sign in with the key; you land on that change, not the inbox, and the header names the branch.
- [ ] The change renders: proposal, design, tasks, specs, ledger and the risk line.
- [ ] Answer a `needs_human` row. The ledger count drops and the branch has a `checkpoint(<change>): answer <id>` commit.
- [ ] Approve. The approval shows without a stale label, including after a reload.
- [ ] Tap "Checkpoint" in the header. The inbox opens on the same repository and branch.
- [ ] Type a different branch in the Branch field and open it.
- [ ] On the laptop, `git pull` and confirm `checkpoint.json` carries the decision.

## Testing from your phone before deploying

Checkpoint is built for a 375 px screen, so it is worth opening on a real one
before deploying. The redirects it issues carry a relative `Location`, so
sign-in works at whatever address the phone used; the only thing that needs
configuring is which origins the development server will serve assets to.

**On the same Wi-Fi, against the development server.** Find this Mac's address
and start the server bound to every interface:

```sh
ipconfig getifaddr en0            # e.g. 192.168.7.42
CHECKPOINT_DEV_ORIGINS=192.168.7.42 \
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev \
npm run dev -- -H 0.0.0.0
```

Open `http://192.168.7.42:3000` on the phone and sign in with the access key.
The GitHub variables from "Running locally" work here too; only
`CHECKPOINT_DEV_ORIGINS` and `-H 0.0.0.0` are extra. Without the variable Next
answers `403 Blocked cross-origin request` for every `_next/*` asset from any
origin but `127.0.0.1`. It is read once at startup, so **restart `npm run dev`
after changing it**.

**Over an https tunnel, against the production build.** No origin allowlist is
involved; the tunnel terminates https and forwards to `localhost:3000`. A
production build refuses `CHECKPOINT_GIT_HOST=fixture`, so this path needs the
GitHub variables (`CHECKPOINT_REPOS`, `CHECKPOINT_GITHUB_TOKEN`):

```sh
npm run build && npm start
# then point any https tunnel (cloudflared, ngrok, tailscale funnel) at localhost:3000
```

> **Why the LAN path uses the development server.** In production, and on any
> request that arrived over https, the session cookie carries `Secure`, so a
> browser will not store it over plain http. A production build reached at
> `http://192.168.7.42:3000` therefore accepts the key and then bounces back to
> the login page. The development server omits `Secure` over plain http, which
> is what lets the phone hold the session on a LAN.

## The `checkpoint.json` contract

The wire contract, `interlock.checkpoint/1`, is written in
[`docs/interlock-contract.md`](docs/interlock-contract.md): the click URL, who
owns which fields, the `request` block, the freshness rule, what a laptop gate
reads, and the publish sequence. In short, the sender owns `request`, Checkpoint
owns `decision`, and both preserve unknown fields.

Approve is refused, in the UI and on the server, while the ledger has a
`needs_human` row, an invalid row, is missing, or is unparseable. That mirrors
`interlock ready`, which would refuse the same ledger on the laptop. Send
back is always available and requires a note.

Commit messages are `checkpoint(<change>): answer <id>`,
`checkpoint(<change>): approve` and `checkpoint(<change>): return`. A human
answer writes the evidence cell `human decision <YYYY-MM-DD> via Checkpoint`
(UTC date).

## Ledger fixtures

`src/lib/ledger/ledger.ts` is a TypeScript port of Interlock's
`lib/ledger.mjs`. Parity is pinned by golden files under `fixtures/ledger/`:
for each hand-written `<name>.md` there is a `<name>.parsed.json` and a
`<name>.serialized.md` produced by the real module, and
`fixtures/ledger/VERSION` records the Interlock version that produced them
(currently 1.13.0). The tests compare the port against those files and never
need Interlock installed.

To regenerate after an Interlock release:

```sh
npm run gen:ledger-fixtures
```

`INTERLOCK_LIB_DIR` wins when set. Otherwise the script uses the highest-semver
directory under `~/.claude/plugins/cache/interlock/interlock/` that contains
`lib/ledger.mjs`, and exits 1 with a message when there is none. If the newest
installed plugin is older than the release you want to record, point it at the
sources:

```sh
INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures
```

Commit the regenerated files together with `VERSION`. Any golden-file diff other
than `VERSION` is a port defect to fix, not to keep.

## Access gate

The app is gated by a shared access key exchanged for an httpOnly, Secure,
SameSite=Lax cookie (a 30-day HMAC, compared in constant time) and verified by
`src/proxy.ts` on every route. The choice is recorded as decision D2 of the
`use-checkpoint-from-phone` change: the key is host-agnostic, and deep links
survive sign-in. Vercel Deployment Protection stays on Standard as a second
layer for previews, not as a replacement.

The gate is not removable as a single unit. Besides `src/lib/auth/*`,
`src/proxy.ts`, `src/app/api/session/` and the login page, `src/app/layout.tsx`
and the server actions also import `@/lib/auth/session`. Changing the gate means
touching those too.

# Checkpoint

Checkpoint is the phone-sized inbox for the one decision an unattended
Interlock run cannot make. `/interlock:spec` stops at a human read, and
`interlock ready` refuses to continue while a `needs_human` row remains in a
change's `decisions.md`. Checkpoint reads that change from a branch on GitHub,
renders `proposal.md`, `design.md`, `tasks.md`, the delta specs and the ledger
for a 375 px screen, lets the owner answer the row, and records **Approve** or
**Send back** as a file on the same branch.

The phone never talks to the laptop. The git host is the message bus: every
read is a read on a ref, every write is a commit, and there is no database.
The app holds one repository token and nothing else, and it writes exactly two
files, `openspec/changes/<change>/decisions.md` and
`openspec/changes/<change>/checkpoint.json`.

Every number the app shows is computed from the artifacts on the ref, with its
denominator. Anything the sender did not record is shown as `unobserved`, never
guessed.

For the longer story, what problem this solves, how it meets Interlock's
ledger and `checkpoint.json` contracts, and which parts of that integration
still have to land in specflow, see `docs/how-checkpoint-works.md`.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `CHECKPOINT_ACCESS_KEY` | for any access | Shared access key exchanged at `/login` for a 30-day httpOnly session cookie. When unset, every gated route answers `503 Checkpoint has no access key configured`. The app fails closed. |
| `CHECKPOINT_GIT_HOST` | yes | `github` in production, `fixture` for local development and tests. Defaults to `github`. |
| `CHECKPOINT_REPO` | with `github` | `owner/name` of the one repository the app reads and writes. |
| `CHECKPOINT_GITHUB_TOKEN` | with `github` | Fine-grained personal access token for that repository (scope below). Never logged, never included in an error message. |
| `CHECKPOINT_FIXTURE_DIR` | with `fixture` | Directory served as the repository. Defaults to `fixtures/repo`. |
| `CHECKPOINT_DEV_ORIGINS` | no, development only | Comma-separated extra origins `npm run dev` may serve `_next/*` to, so a phone on the LAN can load the app ("Testing from your phone" below). `127.0.0.1` is always allowed. Read once at dev-server startup; `next start` and Vercel ignore it. |

Copy `.env.example` to `.env.local` and fill it in. Validation runs on first
use and stops the request naming the missing variable.

## GitHub token scope

Create a fine-grained personal access token at
<https://github.com/settings/personal-access-tokens>:

- **Repository access:** only the repository named in `CHECKPOINT_REPO`.
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

Against a real repository:

```sh
CHECKPOINT_GIT_HOST=github \
CHECKPOINT_REPO=owner/name \
CHECKPOINT_GITHUB_TOKEN=github_pat_... \
CHECKPOINT_ACCESS_KEY=... \
npm run dev
```

Every page takes a `?ref=<branch>` query parameter and defaults to the
repository's default branch. The header always shows the ref and the short
head SHA the page was rendered from.

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

## Testing from your phone

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
involved; the tunnel terminates https and forwards to `localhost:3000`:

```sh
npm run build && npm start
# then point any https tunnel (cloudflared, ngrok, tailscale funnel) at localhost:3000
```

**Deployed.** See "Deploying to Vercel" below; the same phone flow applies with
none of this setup.

> **Why the LAN path uses the development server.** In production, and on any
> request that arrived over https, the session cookie carries `Secure`, so a
> browser will not store it over plain http. A production build reached at
> `http://192.168.7.42:3000` therefore accepts the key and then bounces back to
> the login page. The development server omits `Secure` over plain http, which
> is what lets the phone hold the session on a LAN.

## Deploying to Vercel

Checkpoint is a plain Next.js app with no Vercel-specific code.

1. Create a Vercel project from this repository.
2. Set the environment variables `CHECKPOINT_ACCESS_KEY`,
   `CHECKPOINT_GITHUB_TOKEN`, `CHECKPOINT_REPO` and
   `CHECKPOINT_GIT_HOST=github` in the project settings, for the Production
   environment at least.
3. Deploy. Add the deployed URL to the home screen on the phone; the app
   ships a web manifest and icons and needs no service worker.

Rollback is deleting the deployment. Nothing persists outside the target
repository's branch.

## The `checkpoint.json` contract

The sender (specflow's push) is assumed to write a `request` block before it
pushes. The reader validates it with a tolerant schema, shows risk as
`unobserved` when it is absent, and always computes task and ledger counts
itself from `tasks.md` and `decisions.md` on the ref. The reader writes
`decision`, replacing any previous decision, and preserves `request` and any
unknown top-level field.

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

`request` is optional and opaque beyond `headSha` and `risk.class`.
`risk.class` is displayed only if it is one of `low|medium|high|critical`;
otherwise it is shown as `unobserved` with the raw value in a tooltip. When
`request.headSha` differs from the ref's current head, the risk is labelled
stale. `decision.headSha` is the ref's head at the moment of decision; when
the branch has moved past it the decision is labelled stale and Approve is
offered again.

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
`fixtures/ledger/VERSION` records the Interlock version that produced them.
The tests compare the port against those files and never need Interlock
installed.

To regenerate after an Interlock release:

```sh
INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures
```

`INTERLOCK_LIB_DIR` defaults to the installed plugin cache,
`~/.claude/plugins/cache/interlock/interlock/0.2.0/lib`. Commit the regenerated
files together with `VERSION`.

## Open decision D1: how the app itself is gated

`openspec/changes/build-checkpoint-reader/decisions.md` carries one
`needs_human` row. The implemented default is a shared access key exchanged
for an httpOnly, Secure, SameSite=Lax cookie verified by `src/proxy.ts` on
every route. The alternatives the owner may prefer are Vercel Deployment
Protection (no app code, ties the app to Vercel) and Cloudflare Access
(identity-based, one more service). Only `src/lib/auth/*`, `src/proxy.ts`,
`src/app/api/session/` and the login page would be removed if the answer
changes; nothing else in the app depends on it.

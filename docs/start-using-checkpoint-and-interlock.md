# Start using Checkpoint with Interlock

**Written 2026-10-31**, against Checkpoint `main` at `d6a737e` (in sync with `origin/main`), the Interlock plugin **1.12.0** installed on this Mac, and the specflow checkout at **1.13.0** (`~/IdeaProjects/specflow`, tagged `v1.13.0`, in sync with its origin). Every "verified" line below was run on this machine today. Every "not done" line names where the work lives.

This guide answers three questions, in order:

1. What works today, and how to use the two tools together right now with a few manual steps.
2. The complete setup, laptop and phone, from a clean machine.
3. What is still missing for the loop to run without those manual steps, and where each gap is specced.

The companion documents are [readiness-and-setup.md](./readiness-and-setup.md) (running Checkpoint locally in detail, failure table included) and [how-checkpoint-works.md](./how-checkpoint-works.md) (the design and the contracts).

---

## 1. The loop, and which arrows exist

```
laptop: /interlock:spec ──writes──▶ openspec/changes/<change>/{proposal,design,tasks,specs,decisions.md}
        stops at the checkpoint; `interlock notify checkpoint <change>` pushes "SPEC CHECKPOINT — <change>" to ntfy
                                                                                   │
   (A) commit + push the change dir ───────────────────────▶ GitHub branch         │  (B) push carries no link
                                                                  │                ▼
phone:  open Checkpoint at /changes/<change>?ref=<branch> ◀───────┘        tap the push: opens nothing
        read the artifacts · answer each needs_human row (commits decisions.md)
        Approve / Send back (commits checkpoint.json)
                                                                  │
   (C) git pull on the laptop ◀───────────────────────────────────┘
laptop: interlock ledger <change>  → clear       (D) checkpoint.json is read by nobody on the laptop
        /interlock:ship
```

| Arrow | State today | Who fixes it |
|---|---|---|
| spec writes artifacts, stops, pushes a title-only ntfy message | **Works** (Interlock 1.12.0 and 1.13.0) | nothing |
| (A) the change dir reaches the branch | **Manual**: you commit and push | specflow companion change (publish step), see §4 |
| (B) the push opens the change | **Missing**: no `Click` header | specflow companion change |
| phone reads, answers rows, approves | **Works**; ledger parity with Interlock 1.13.0 verified today (regenerating the goldens changed only `fixtures/ledger/VERSION`) | nothing |
| (C) laptop sees the answer | **Manual**: `git pull` | stays manual by design (decision D4 of the Checkpoint change) |
| ledger gate on the laptop | **Works**: `interlock ledger <change>` and `interlock ready` block on a `needs_human` row and pass once the phone answered it | nothing |
| (D) Approve / Send back mean something on the laptop | **Missing**: nothing in specflow reads `checkpoint.json`; today it is an audit record only, and Send back blocks nothing | specflow companion change |
| the approval survives its own commit | **Bug on `main`**: `decide` compares heads by equality, so the next reload calls the approval stale | Checkpoint change `use-checkpoint-from-phone` |
| the app is reachable from the phone | **Not deployed**: no Vercel project; LAN dev server or tunnel only | you, runbook in §3.4 |

So the ledger half of the integration is complete and effective. The `checkpoint.json` half exists on the phone side only.

---

## 2. Use it today, with the manual steps

Prerequisites: §3.1 (Interlock on the laptop) and §3.3 (Checkpoint against GitHub). Then, for one change:

**On the laptop, in the repository you are changing**

1. Work on a branch. Run `/interlock:spec <what you want>` in Claude Code. It stops at the checkpoint and prints `GOAL MET: interlock spec stopped at the checkpoint.`
2. Commit only the change directory and push the branch. Interlock does not do this yet.

```bash
git add openspec/changes/<change> && git commit -m "spec(<change>): artifacts for the checkpoint" && git push -u origin HEAD
```

**On the phone**

3. Open Checkpoint at `/changes/<change>?ref=<branch>` (the ntfy push has no link yet, so type it or bookmark the inbox at `/?ref=<branch>`). Sign in with the access key.
4. Read the tabs in order: proposal, design, tasks, specs, ledger. Answer every row marked **needs you**. Each answer is a commit `checkpoint(<change>): answer <id>` on the branch.
5. Tap **Approve** (or **Send back** with a note). This commits `checkpoint.json`. Today the laptop ignores it, so treat Approve as your own record and Send back as a note to yourself; what unblocks the laptop is the answered ledger.

**Back on the laptop**

6. Pull, confirm the ledger is clear, ship:

```bash
git pull
```

```bash
interlock ledger <change>
```

```bash
/interlock:ship <change>
```

`interlock ledger` exits 1 while a `needs_human` or invalid row remains, or the ledger is missing. If the phone's answer made a row invalid (it referenced an id that `design.md` never mentions), edit `design.md` on the laptop so it references the id, or answer the row again.

Known rough edges on this path until the Checkpoint change in §4 lands: after Approve, the next reload shows the approval as stale and offers Approve again (harmless); the chrome "Checkpoint" link and the inbox drop `?ref=` and fall back to the default branch, so keep `?ref=<branch>` in the URL you type; the app serves one repository per deployment.

---

## 3. Setup

### 3.1 Laptop: Interlock

Interlock is the Claude Code plugin `interlock@interlock`, installed from the GitHub marketplace `renzrollon/interlock` (that repository is the `specflow` checkout). State observed today with `interlock doctor` from this repository:

| Check | State |
|---|---|
| Node | v26.8.1 (plugin needs 18+, OpenSpec 20.19+) |
| plugin | 1.12.0 installed at `~/.claude/plugins/cache/interlock/interlock/1.12.0`; 1.13.0 is tagged in specflow |
| `interlock`, `interlock-graph` on PATH | ok, through the shim `~/.claude/bin/interlock` |
| openspec | available, this project initialised |
| git | 2.54.0 |
| test profile | `.claude/testing/profile.json` present, unit suite `npm test` |
| **permissions** | **FAIL**: 11 commands a ship run shells out to have no allow rule |
| notify | skip: no ntfy topic configured |
| claude-bare | skip: no `ANTHROPIC_API_KEY`; only matters for headless `-p --bare` runs |

Do these in order.

**a. Install or update the plugin.**

```bash
claude plugin install interlock@interlock
```

```bash
claude plugin update interlock@interlock
```

Updating to 1.13.0 moves the executables from `bin/` to `cli/`. Inside a Claude Code session the 1.13.0 preflight hook puts `cli/` on the PATH itself, but the terminal shim at `~/.claude/bin/interlock` still execs `<install>/bin/<name>` and will stop working. Replace its last line so it tries both:

```bash
cat > ~/.claude/bin/interlock <<'SHIM'
#!/usr/bin/env bash
# Shim for the interlock plugin's CLIs (interlock, interlock-graph via symlink).
# Resolves the *installed* plugin version at call time so plugin updates don't strand it.
name=$(basename "$0")
root=$(node -e 'const r=require(process.argv[1]).plugins["interlock@interlock"];process.stdout.write(r[0].installPath)' \
  "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null)
root="${root:-$HOME/.claude/plugins/marketplaces/interlock}"
for dir in cli bin; do
  [ -x "$root/$dir/$name" ] && exec "$root/$dir/$name" "$@"
done
echo "interlock shim: no $name under $root/cli or $root/bin" >&2
exit 127
SHIM
```

Then `interlock version` must print the installed version.

**b. Allow the commands a ship run needs.** Without this every unattended run stops on an approval prompt. Put the rules in your user settings so they cover every repository. `~/.claude/settings.json`, under `permissions.allow`:

```json
"Bash(interlock:*)",
"Bash(interlock-graph:*)",
"Bash(openspec:*)",
"Bash(git:*)",
"Bash(test:*)",
"Bash(printenv:*)",
"Bash(mkdir:*)",
"Bash(npm test:*)",
"Bash(npx vitest run:*)",
"Bash(npm run test:e2e:*)",
"Bash(npx playwright test:*)"
```

The last four are this repository's test profile; another repository's `interlock doctor` names its own. Re-run `interlock doctor` and the `permissions` row must read `ok`.

**c. Give every repository a test profile.** `interlock ready` refuses to run unattended without `.claude/testing/profile.json`. Checkpoint has one. In a repository that does not, run `/interlock:fix-tests --reconfigure` once; it discovers the commands and writes the file.

**d. Configure the push to your phone.** Interlock's only outbound call is one ntfy message per stop (ship halt, ship complete, spec checkpoint). Pick a long random topic name; anyone who knows it can read the messages.

```bash
echo "{\"ntfy_topic\": \"$(openssl rand -hex 16)\"}" | claude plugin configure interlock@interlock --values-stdin
```

Or set `INTERLOCK_NTFY_TOPIC` (and `INTERLOCK_NTFY_URL` for a self-hosted server) in the `env` block of `~/.claude/settings.json`. Install the ntfy app on the phone and subscribe to the same topic. Test it from a Claude Code session:

```bash
interlock notify --title "checkpoint test" --body "from the laptop"
```

Note that `interlock doctor` run by the session-start hook cannot see a plugin option; run it again from inside the session and the `notify` row reads `ok`.

**e. Confirm.** `interlock doctor` with no `FAIL` rows. `skip` rows for `prompt-cache`, `advisor` and `claude-bare` are fine.

### 3.2 Checkpoint on the laptop, fixture mode (no token)

```bash
cd ~/IdeaProjects/checkpoint && npm install
```

```bash
CHECKPOINT_GIT_HOST=fixture CHECKPOINT_ACCESS_KEY=dev npm run dev
```

Open <http://localhost:3000>, sign in with `dev`. The inbox shows `add-user-auth` (one row needs you) and `add-report-flag`. Writes stay in memory until you restart. Checks that pass today: `npm test` (23 files, 218 tests), `npm run typecheck`, `npm run lint`. `npm run build` and `npm run test:e2e` bind ports and must run outside the Claude Code Bash sandbox (see `.claude/memory/failure-modes/`). The full variable table and the failure table are in [readiness-and-setup.md](./readiness-and-setup.md).

### 3.3 Checkpoint against your GitHub repository

**Token.** At <https://github.com/settings/personal-access-tokens> create a fine-grained token: resource owner `renzrollon`, repository access limited to the one repository Interlock runs in, permission **Contents: read and write**, nothing else. One repository per deployment until the Checkpoint change in §4 lands (`CHECKPOINT_REPOS` is part of it).

**Key.** Generate the shared access key. There is no login rate limit, so its strength is the gate:

```bash
openssl rand -base64 32
```

**Environment.** `cp .env.example .env.local`, then set:

```
CHECKPOINT_ACCESS_KEY=<the key>
CHECKPOINT_GIT_HOST=github
CHECKPOINT_REPO=renzrollon/<repository Interlock runs in>
CHECKPOINT_GITHUB_TOKEN=github_pat_...
```

`.env.example` still says `CHECKPOINT_REPO=renzrollon/specflow`; that repository is now `renzrollon/interlock` on GitHub, and in any case it should name the repository whose changes you want to read, not Interlock itself.

**Run and open.**

```bash
npm run dev
```

Open `http://localhost:3000/?ref=<branch>`. The header shows the ref and the short head SHA it rendered. A branch that holds a `needs_human` row shows **1 needs you**.

### 3.4 Reach it from the phone

Three options, cheapest first. All three need §3.3.

**Same Wi-Fi, dev server.** The dev server omits the `Secure` cookie flag over plain http, which is what lets the phone keep the session.

```bash
ipconfig getifaddr en0
```

```bash
CHECKPOINT_DEV_ORIGINS=<that address> npm run dev -- -H 0.0.0.0
```

Open `http://<that address>:3000` on the phone. Restart the server after changing `CHECKPOINT_DEV_ORIGINS`.

**Anywhere, https tunnel to a production build.** None of `cloudflared`, `ngrok` or `tailscale` is installed on this Mac today; install one. Then, outside the Bash sandbox:

```bash
rm -rf .next && npm run build && npm start
```

Point the tunnel at `localhost:3000`. The laptop must stay awake.

**Deployed on Vercel (the intended end state).** `vercel` is not installed and no project exists yet. Runbook, all owner-held actions:

1. Create a Vercel project from `renzrollon/checkpoint`, branch `main`. The repository is public; the app is gated by the key, not by the repository.
2. In the project's Production environment set `CHECKPOINT_ACCESS_KEY`, `CHECKPOINT_GIT_HOST=github`, `CHECKPOINT_REPO`, `CHECKPOINT_GITHUB_TOKEN`.
3. Leave Vercel Deployment Protection on Standard (it covers preview URLs). The production domain is gated by the key alone.
4. Deploy. On the phone, open the URL, sign in, add to the home screen. On iOS the home-screen app and Safari keep separate cookie jars, so a link tapped in ntfy may ask for the key once more.
5. Rollback is deleting the deployment; nothing persists outside the repository branches.

After the Checkpoint change in §4 lands, production refuses `CHECKPOINT_GIT_HOST=fixture`, accepts `CHECKPOINT_REPOS` for several repositories, and renders a configuration page naming a missing variable instead of a Next.js digest page.

### 3.5 Optional: Escapement

`~/IdeaProjects/escapement` drains a queue of approved changes overnight. It already reads `checkpoint.json` from watched branches with the ancestry freshness rule and starts `/interlock:ship` in a background session. It is not installed (`escapement` is not on PATH). It is the third piece of the loop, not a prerequisite for the two above; install it once Checkpoint is deployed, with `ESCAPEMENT_CHECKPOINT_URL` set to the production URL. See its README, section "Intake from Checkpoint".

---

## 4. What is left

### 4.1 Checkpoint side: the change `use-checkpoint-from-phone`

What it does: freshness by ancestry so an approval is current right after it is written; `CHECKPOINT_REPOS` and `?repo=` so one deployment serves every `renzrollon/*` repository; every link keeps `repo` and `ref`; production fails closed (no fixture adapter) and names a misconfigured variable; the answer form warns when `design.md` does not reference the row; `docs/interlock-contract.md`, the written contract both repositories build against; a deploy runbook and a first-phone-test checklist in the README. 20 tasks in four sections.

Where it was: specced 2026-10-08 in the orca worktree `~/orca/workspaces/checkpoint/sunstar` (branch `carlrollon/checkpoint-phone-interlock-integration`), never committed, and its first artifact review ended with three blockers.

Where it is now: copied into this checkout at `openspec/changes/use-checkpoint-from-phone/` (plus the explore brief under `.claude/handoff/`) and revised today:

- Blocker "ancestry certifies approvals of content the owner never saw": new decision D22. `decide` judges the page's head against the ref's current head before writing; stale writes nothing and reloads with "The branch moved past <head>; reloaded"; `decision.headSha` is always the head the owner read. New scenarios in `specs/checkpoint-decision/spec.md`.
- Blocker "chrome home link echoes the raw repo": the home link moves out of the layout into a server-rendered `Chrome` component fed the canonical `repo` and `ref` from the page context. New edge-case scenario in `specs/repo-selection/spec.md`.
- Blocker "existing tests pin the old equality rule": tasks 2.2 and 2.3 are one task that names the four tests to rewrite, by title, in `checkpoint.test.ts`, `load.test.ts` and `actions.test.ts`.
- Version facts moved from Interlock 1.3.0 to 1.13.0; D7 now records that `lib/ledger.mjs` moved its table helpers to `lib/md-table.mjs` and that the goldens still regenerate byte-identical.
- Warnings also taken: task 3.6 depends on 3.4; the view-signature change no longer leaves the suite red between tasks.

`interlock validate use-checkpoint-from-phone` reads `READY`. The artifact-review re-gate on 2026-10-31 passed with no blockers; its two warnings and one suggestion were applied at once (see the end of this file).

Next step for you: read the spec (ten minutes, `docs/02-the-checkpoint.md` in specflow says how), then `/interlock:ship use-checkpoint-from-phone` from this checkout. The orca worktree and its branch hold nothing that is not here and can be removed.

### 4.2 Interlock side: the companion change in specflow

Never specced before today. It is being specced now in its own session, in a specflow worktree, with the contract restated in its brief: the click URL, who owns which `checkpoint.json` fields, the `request` block, the ancestry freshness rule, what each decision state means to a gate, the opt-in publish step at the spec checkpoint (commit the change dir, write `request`, push, ntfy with `Click`), and `interlock ready` plus the ship run start reading `checkpoint.json` from the working tree. Its outcome, the change name and the option and variable names it chose are recorded at the end of this file once the session reports.

Until it lands: step 2 of §2 stays manual, the push stays link-less, and Send back blocks nothing on the laptop.

### 4.3 Owner-held actions nobody can spec

- Create the Vercel project and set its four variables (§3.4).
- Mint the fine-grained token and generate the key (§3.3).
- Configure the ntfy topic and subscribe the phone (§3.1 d).
- Add the permission allow rules (§3.1 b).
- Replace the shim before updating the plugin to 1.13.0 (§3.1 a).

### 4.4 Housekeeping in this repository

- `docs/readiness-and-setup.md` and this file are untracked; commit them.
- `.env.example` names `renzrollon/specflow`; the Checkpoint change fixes it along with `.gitignore` (`.claude/ship/` is untracked today).
- `fixtures/ledger/VERSION` says 0.2.0; task 1.7 of the change regenerates it as 1.13.0.
- `.claude/autonomy.json` and `.claude/metrics/` are Interlock state written on 2026-10-08; they are untracked and harmless.

---

## 5. Order of operations

1. §3.1: plugin, shim, permissions, ntfy topic, `interlock doctor` clean.
2. §3.3: token, key, `.env.local`, open a real branch on the laptop.
3. §2: run the manual loop once on a small change to see the ledger round-trip work.
4. Ship `use-checkpoint-from-phone` here (§4.1), then deploy to Vercel (§3.4) and add the app to the phone's home screen.
5. When the specflow companion is specced and reviewed (§4.2), ship it there, update the plugin, set its Checkpoint URL option to the production URL. From then on `/interlock:spec` publishes and the push opens the change.
6. Optional: install Escapement with `ESCAPEMENT_CHECKPOINT_URL` (§3.5).

---

## 6. Verification log for this guide

Run on 2026-10-31 in `~/IdeaProjects/checkpoint`:

- `npm test`: 23 files, 218 tests passed. `npm run typecheck` and `npm run lint`: clean.
- `interlock doctor`: 11 ok, 1 fail (permissions), 4 skip.
- `INTERLOCK_LIB_DIR=~/IdeaProjects/specflow/lib npm run gen:ledger-fixtures`: only `fixtures/ledger/VERSION` changed; restored.
- `git -C ~/IdeaProjects/specflow diff v0.2.0 HEAD -- lib/ledger.mjs`: table helpers moved to `lib/md-table.mjs`, grammar unchanged.
- `grep -rl 'checkpoint\.json\|interlock\.checkpoint' lib cli skills workflows hooks docs` in specflow 1.13.0: no match.
- `gh repo view renzrollon/checkpoint`: public, default branch `main`, last push 2026-10-21.
- Not run: `npm run build`, `npm run test:e2e`, the dev server, any GitHub write. No token is present on this machine for the app.

### Re-gate and companion results

**Checkpoint spec re-gate, 2026-10-31.** `/interlock:review-artifacts use-checkpoint-from-phone` at depth lean, inline read of proposal, design, tasks, decisions and the eight delta specs, then `interlock gate --findings .claude/metrics/review-artifacts-use-checkpoint-from-phone-20261031-112149.json --metrics use-checkpoint-from-phone`.

| Result | Value |
|---|---|
| `passed` | true |
| blockers | 0 |
| warnings | 2 |
| suggestions | 1 |
| malformed | none |
| metrics record | written |

All three findings were taken on the spot, so the artifacts on disk are past them:

- Tasks 1.3 to 1.5 renumbered so the `Comparison` type and GitHub `compare` come first, then the fixture `compare`, then the freshness classifier. The two "Depends on" notes that only existed to patch the order are gone.
- Task 2.2 stays one task. It is the largest session in the change; give it the judgment-hard implementer when the wave planner asks.
- `specs/change-inbox/spec.md` now says a card's decision state is shown as recorded, without a freshness label, and that the change page is where staleness is judged.

`interlock validate use-checkpoint-from-phone` still reads ready. The change is at the human checkpoint: read it, then `/interlock:ship use-checkpoint-from-phone`.

**Specflow companion change.** _(pending: the side session is still running; its change name, gate verdict, option and env var names, and the `request` field names land here when it reports)_

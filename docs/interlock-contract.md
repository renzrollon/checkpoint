# Interlock contract: `interlock.checkpoint/1`

This is the single source both sides build against: Checkpoint (this repository)
and the sender, Interlock's companion change in specflow. If the two disagree,
this file is right and the code is the bug. Escapement's `lib/checkpoint.mjs` and
`lib/intake.mjs` are the existing consumer, and this contract agrees with them.

Everything the sender does here is **opt-in**, gated on a configured Checkpoint
URL. With none configured, nothing in this document happens.

## 1. The click URL

```
<base>/changes/<encodeURIComponent(change)>?repo=<encodeURIComponent(owner/name)>&ref=<encodeURIComponent(branch)>
```

- `base` is the production URL of the Checkpoint deployment, without a trailing slash.
- `repo` and `ref` are **both optional** on Checkpoint's side. A missing `repo` is the
  first repository in `CHECKPOINT_REPOS`; a missing `ref` is that repository's default
  branch. Escapement's existing repo-less links therefore keep opening the default repository.
- Both values are `encodeURIComponent`-encoded, so a branch such as `carlrollon/sunstar`
  travels as `carlrollon%2Fsunstar`. The link survives sign-in unchanged.
- `repo` is matched case-insensitively against the allowlist. A repository outside it is
  shown as "Checkpoint is not configured for <requested>"; it is never replaced by the default.

## 2. Field ownership in `checkpoint.json`

Path: `openspec/changes/<change>/checkpoint.json`.

| Field | Owner | Rule |
|---|---|---|
| `schema` | sender | Always the string `interlock.checkpoint/1`. |
| `change` | sender | The change directory name. |
| `request` | sender | Optional block, section 3. The sender never touches `decision`. |
| `decision` | Checkpoint | Written on Approve or Send back, replacing any previous decision. |

Both sides **preserve unknown fields**, at the top level and inside `request` and
`decision`. A writer reads the file, changes only what it owns, and writes the rest back as
it found it.

`decision`:

```json
{
  "state": "approved",
  "note": "",
  "decidedAt": "2026-09-05T04:00:00Z",
  "decidedBy": "checkpoint",
  "headSha": "0123456789abcdef0123456789abcdef01234567"
}
```

`state` is `approved` or `returned`. `decision.headSha` is the head the person **read**
(the page head), not the commit the decision write produced. A commit cannot contain its own SHA.

## 3. The `request` block

Optional, and opaque beyond `headSha` and `risk.class`.

```json
{
  "kind": "checkpoint",
  "requestedAt": "2026-09-05T03:10:00Z",
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "risk": { "class": "medium", "signals": ["shared-value-transform"] },
  "tasks": { "total": 12, "waves": 3 },
  "ledger": { "needsHuman": 1, "agentResolved": 8, "invalid": 0 }
}
```

- `kind`: `"checkpoint"`.
- `requestedAt`: ISO 8601 timestamp.
- `headSha`: **the commit that carries the artifacts** (publish step 1 below), not the commit
  that carries `checkpoint.json`. The sender writes `checkpoint.json` in a later commit, so
  that commit and every phone answer leave the risk fresh.
- `risk.class`: displayed only when one of `low|medium|high|critical`; otherwise shown as
  `unobserved`. `risk.signals`: array of strings.
- `tasks`, `ledger`: informational. Checkpoint always computes its own counts from `tasks.md`
  and `decisions.md` on the ref and never trusts these.

## 4. The freshness rule

A recorded head (`decision.headSha` or `request.headSha`) is judged against the branch's
current head by ancestry, not equality:

- **fresh** when the recorded head equals the current head; or when the recorded head is an
  ancestor of the current head (status `ahead` or `identical`), the comparison is not
  truncated, and **every path changed in between is one of the two tolerated paths**;
- **stale** otherwise: a different path changed, the branch is `behind` or `diverged`, the
  comparison hit the host's 300-file cap, or the comparison could not be made.

The two tolerated paths, for change `<change>`:

1. `openspec/changes/<change>/decisions.md`
2. `openspec/changes/<change>/checkpoint.json`

These are exactly the two files Checkpoint may write. Another change's `checkpoint.json`
is not tolerated.

## 5. What a laptop gate reads

| `checkpoint.json` state | Reading |
|---|---|
| `decision.state` is `approved` and fresh | **Approved.** The gate may continue. |
| `decision.state` is `approved` and stale | **Not approved.** Something other than Checkpoint's two files changed after the person read it. |
| `decision.state` is `returned` | **Blocks**, fresh or stale, until a later phone decision replaces it. |
| File absent | No phone decision. |
| File unparseable (not JSON, wrong `schema`, no valid `decision`) | No phone decision. Report the problem; never treat it as approval. |

## 6. The publish sequence

The sender follows this order, and only when a Checkpoint URL is configured:

1. **Commit only the change directory**, `openspec/changes/<change>/`. Nothing else is staged.
2. **Write `checkpoint.json`** with `request.headSha` set to the commit from step 1, as a
   **second** commit.
3. **Push the branch.**
4. **Notify**, with the click URL of section 1 in the `Click` header.

Spec itself does not commit; the publish step does.

## 7. After a phone decision

Checkpoint commits `decisions.md` and `checkpoint.json` to the branch on the remote. The
laptop must `git pull` before it reads them. Nothing pulls automatically.

## 8. Existing consumer

Escapement already agrees with this contract:

- `lib/checkpoint.mjs` parses the marker, classifies it as `approved-fresh`, `approved-stale`,
  `returned` or `invalid` by ancestry, and tolerates the same two paths.
- `lib/intake.mjs` derives the click URL. It currently emits `?ref=` only; adding `repo` is a
  separate change, and until then its links open the default repository.

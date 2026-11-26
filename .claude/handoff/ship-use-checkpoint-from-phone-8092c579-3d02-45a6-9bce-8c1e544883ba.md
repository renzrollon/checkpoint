<!-- interlock.resume-card/1 change=use-checkpoint-from-phone run=8092c579-3d02-45a6-9bce-8c1e544883ba -->
# Ship halted — use-checkpoint-from-phone

the run program returned no step — the CLI relay could not be read (RELAY UNREADABLE): cli-6 (interlock run judge): 432 relayed chars do not parse as JSON (JSON Parse error: Unexpected identifier "No"); the call had not taken effect, and relaying it again failed too: 0 relayed chars do not parse as JSON (JSON Parse error: Unexpected EOF); the relay copied "No output. The judge command was not run. The relayed results claim a unit run (`interlock verify exec --kind unit --command 'npm test'`, 261… (truncated)

This file is a record, not a trigger. Nothing reads it back: the next ship decides what to skip from the stored plan fingerprint, never from this card. **Do not start another ship run unless the user asks.**

## Where this run stopped

- change: `use-checkpoint-from-phone`
- run: `8092c579-3d02-45a6-9bce-8c1e544883ba`
- project: `-Users-caro-IdeaProjects-checkpoint`
- cwd: `/Users/caro/IdeaProjects/checkpoint`
- trajectory: `.claude/ship/runs/8092c579-3d02-45a6-9bce-8c1e544883ba.jsonl`

Read the whole walk that led here rather than re-deriving it:

```bash
interlock run-log show 8092c579-3d02-45a6-9bce-8c1e544883ba
interlock run-log query --run 8092c579-3d02-45a6-9bce-8c1e544883ba --halted
```

## Leftover tasks

Boxes still unchecked in `openspec/changes/use-checkpoint-from-phone/tasks.md`:

- `1.6`
- `2.1`
- `2.2`
- `3.1`
- `3.2`
- `3.3`
- `3.4`
- `3.5`
- `3.6`
- `4.1`
- `4.2`

Some of these are done on disk and only unticked; the rest were never attempted, because the run stopped. Tick **only** the ones you have checked are implemented — ticking the rest is how unimplemented work ships behind a `[x]`:

```bash
interlock tasks tick use-checkpoint-from-phone --ids <the ids above you verified are done>
```

## The plan

This run **rebuilt** the plan (no-plan): no stored plan at .claude/ship/plan.json

A plan and its fingerprint are on disk at `.claude/ship/plan.json` and `.claude/ship/plan-fingerprint.json`, and they name this change. The next ship skips the wave classifier only if a fingerprint recomputed from the current artifacts still matches — ticking a checkbox does not break it; editing an artifact, or adding, removing, reordering or rewording a task does, and so does passing a different `--solo` / `--waves` / `--tdd` shape.

## Waves, as far as they got

- wave 1 (run-batch): 7 ok, 0 failed
- wave 1 (run-batch): 2 ok, 0 failed

Note, handoff reports rejected: 1.3. These tasks were recorded as done, but their handoff packets failed validation, so nothing checked what they report. Read their paths before trusting them.

## Lanes with a host session

No lane recorded a host session, so there is no session to resume.

## Degraded before the halt

- PLUGIN VERSION NOT CHECKED: run start was given no --plugin-root
- HANDOFF REJECTED: 1.3 — evidence entry "src/lib/githost/github.ts:compare" is not a locator (path, path:line or path:start-end) — recorded as done and not counted toward the task-failure cap; the next wave is told these tasks filed no usable report
- VERIFICATION SKIPPED: reason=no-detectable-command
- VERIFICATION SKIPPED: reason=disabled-by-caller
- VERIFICATION SKIPPED: reason=e2e-not-requested
- RELAY UNREADABLE: cli-6 (interlock run judge): 432 relayed chars do not parse as JSON (JSON Parse error: Unexpected identifier "No"); the call had not taken effect, and relaying it again failed too: 0 relayed chars do not parse as JSON (JSON Parse error: Unexpected EOF); the relay copied "No output. The judge command was not run. The relayed results claim a unit run (`interlock verify exec --kind unit --command 'npm test'`, 261/261 passing, log at /tmp/claude-501/verify-unit-5.log) tha…" — the CLI's own bytes are in .claude/ship/last-step.json

## Picking it up

1. Fix what the halt reason names. A halt is a gate that failed closed, not a flake.
2. Tick anything already done but unticked, with the command above.
3. In a new session, when a person asks for it: `/interlock:ship use-checkpoint-from-phone`. A stored plan whose fingerprint still matches is reused, so the wave classifier is not paid for twice. Add `--apply-only` if you want the waves alone and will review and commit yourself.

The wave cursor and the previous wave's handoff packets are **not** resumed: `.claude/ship/state.json` is replaced at wave 0 by the next run. Work that was written but never ticked can therefore be dispatched again, which is why step 2 is not optional.

## Purpose

Records the owner's approve or send-back verdict on the change branch as a file the laptop side can read, and refuses to record an approval the laptop side would reject anyway.

## ADDED Requirements

### Requirement: Decision file on the branch
A decision SHALL be written to `openspec/changes/<change>/checkpoint.json` on the ref as JSON with `schema` equal to `interlock.checkpoint/1`, the change name, and a `decision` object holding `state` (`approved` or `returned`), an optional `note`, `decidedAt` (ISO-8601 UTC), `decidedBy` equal to `checkpoint`, and `headSha` equal to the ref's head at the moment of decision. Any existing `request` block and any unknown top-level fields SHALL be preserved. The commit message SHALL be `checkpoint(<change>): approve` or `checkpoint(<change>): return`.

#### Scenario: Approve writes the decision file
- **WHEN** the owner approves `add-user-auth` while the ref head is `0123456…`
- **THEN** `checkpoint.json` on the ref contains `decision.state = "approved"`, `decision.headSha = "0123456…"`, `decision.decidedBy = "checkpoint"`, and the existing `request` block unchanged
- Covered by task 2.3

#### Scenario: Send back requires a note
- **WHEN** the owner chooses "Send back" without a note
- **THEN** the form shows "Say what should change" and nothing is written
- Covered by task 3.4

#### Scenario: Send back writes the note
- **WHEN** the owner sends back with the note "Split the auth change out"
- **THEN** `checkpoint.json` holds `decision.state = "returned"` and `decision.note = "Split the auth change out"`
- Covered by task 2.3

#### Scenario: Unknown fields survive a decision write
- **WHEN** the existing `checkpoint.json` carries a top-level field the app does not know
- **THEN** the written file still carries that field with its value unchanged
- Covered by task 1.4

### Requirement: Approve is disabled while the ledger blocks
The app SHALL not approve while the ledger has any `needs_human` row, any invalid row, is missing, or is unparseable, and SHALL say which of those is the reason. Send back SHALL remain available in every ledger state.

#### Scenario: Approve blocked by a needs_human row
- **WHEN** the ledger has one `needs_human` row
- **THEN** the Approve control is disabled with the text "1 decision still needs you" and Send back is enabled
- Covered by task 3.4

#### Scenario: Approve blocked by a missing ledger
- **WHEN** the change has no `decisions.md`
- **THEN** Approve is disabled with the text "decisions.md is missing; the laptop side would refuse this" and Send back is enabled
- Covered by task 3.4

#### Scenario: Server refuses an approve that bypasses the control
- **WHEN** an approve request arrives for a change whose ledger blocks
- **THEN** the server responds with "ledger blocks approval" and writes nothing
- Covered by task 2.3

### Requirement: Decision state is visible and replaceable
The page SHALL show the current decision (state, note, decided time, head) when one exists, SHALL label it stale when the ref head has moved past its `headSha`, and SHALL allow a new decision to replace it.

#### Scenario: Stale approval after the branch moved
- **WHEN** `checkpoint.json` holds an approval for head `0123456…` and the ref head is now `89abcde…`
- **THEN** the decision bar shows "approved at 0123456, branch has moved to 89abcde" and Approve is offered again
- Covered by task 3.4

#### Scenario: Decision write conflict
- **WHEN** `checkpoint.json` changed on the ref between page load and the decision
- **THEN** the decision is not written and the bar shows "The decision file changed on <ref>; reloaded" with the fresh state
- Covered by task 3.4

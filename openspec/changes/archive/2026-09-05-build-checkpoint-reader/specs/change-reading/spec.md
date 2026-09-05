## Purpose

Renders one change the way the checkpoint procedure asks it to be read, proposal to specs, on a phone, with every number carrying its denominator and every unobserved value saying so.

## ADDED Requirements

### Requirement: Artifacts in reading order
The change page SHALL present `proposal.md`, `design.md`, `tasks.md` and the delta specs under `specs/**` as four sections in that order, plus the ledger, reachable by tabs that keep the current section in the URL hash. Markdown SHALL be rendered with tables and task lists supported, raw HTML in the artifacts SHALL be shown as escaped text and never executed, and links SHALL open in a new tab.

#### Scenario: Four artifacts plus ledger tabs
- **WHEN** the change page for `add-user-auth` loads
- **THEN** tabs appear in the order Proposal, Design, Tasks, Specs, Ledger, the Proposal tab is active, and each tab shows the rendered markdown of its artifact
- Covered by task 3.2

#### Scenario: Raw HTML in an artifact is escaped
- **WHEN** `design.md` contains `<script>alert(1)</script>`
- **THEN** the page shows that text literally and no script element exists in the document
- Covered by task 3.2

#### Scenario: Missing artifact is shown as missing
- **WHEN** the change has no `design.md`
- **THEN** the Design tab shows "design.md is missing on <ref>" and the other tabs render normally
- Covered by task 3.2

#### Scenario: Specs tree renders every delta spec
- **WHEN** `specs/` holds `access-gate/spec.md` and `change-inbox/spec.md`
- **THEN** the Specs tab shows both, each under a heading with its capability path
- Covered by task 3.2

### Requirement: Header with counts and denominators
The header SHALL show the change name, the ref and the head SHA (short form), the task count as done of total, the wave count, the ledger summary as needs-human, agent-resolved and invalid counts out of total rows, and the decision state. Counts SHALL be computed from the artifacts on the ref, never from the sender.

#### Scenario: Counts come from the artifacts
- **WHEN** `tasks.md` has three `## N.` sections and twelve checkboxes of which four are ticked
- **THEN** the header shows "4 of 12 tasks" and "3 waves"
- Covered by task 1.3

#### Scenario: Ledger summary with invalid rows
- **WHEN** `decisions.md` has five rows: one `needs_human`, three valid `agent_resolved`, one `agent_resolved` with an empty evidence cell
- **THEN** the header shows "1 needs you, 3 resolved, 1 invalid, of 5 rows" and the ledger is marked blocking
- Covered by task 1.2

### Requirement: Risk is shown only when observed
The header SHALL show the risk class only when the sender recorded one in `checkpoint.json` on the ref, together with the head SHA it was recorded against. When the recorded head differs from the current head the risk SHALL be labelled stale. When no risk was recorded the header SHALL show `unobserved`.

#### Scenario: Recorded risk is shown with its head
- **WHEN** `checkpoint.json` carries `request.risk.class = "medium"` and `request.headSha` equal to the current head
- **THEN** the header shows "risk medium" and "recorded at <short sha>"
- Covered by task 1.4

#### Scenario: Risk recorded for an older head is stale
- **WHEN** `checkpoint.json` carries a risk class but its `request.headSha` differs from the current head
- **THEN** the header shows the class with the label "stale: recorded for <old short sha>"
- Covered by task 1.4

#### Scenario: No recorded risk is unobserved
- **WHEN** there is no `checkpoint.json` or it has no `request` block
- **THEN** the header shows "risk unobserved" and the page otherwise renders fully
- Covered by task 1.4

### Requirement: Change page failures are spoken
When a change directory does not exist on the ref the page SHALL say so with the ref and offer the inbox. When the git host fails the page SHALL show the failure kind and a retry control.

#### Scenario: Unknown change on the ref
- **WHEN** `/changes/no-such-change` is requested
- **THEN** the page shows "No change named no-such-change on <ref>" with a link to the inbox
- Covered by task 3.2

#### Scenario: Host failure on the change page is named
- **WHEN** the adapter fails with kind `forbidden` carrying a `retryAt`
- **THEN** the page shows "GitHub refused (forbidden), retry after <time>" and a retry control
- Covered by task 3.2

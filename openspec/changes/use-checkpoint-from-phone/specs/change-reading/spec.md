## MODIFIED Requirements

### Requirement: Header with counts and denominators
The header SHALL show:
- the change name;
- the repository, when more than one is configured;
- the ref and the head SHA (short form);
- the task count as done of total;
- the wave count;
- the ledger summary as needs-human, agent-resolved and invalid counts out of total rows;
- the decision state;
- an "Inbox" link to the inbox for the same repository and ref.

Counts SHALL be computed from the artifacts on the ref, never from the sender.

#### Scenario: Counts come from the artifacts
- **WHEN** `tasks.md` has three `## N.` sections and twelve checkboxes of which four are ticked
- **THEN** the header shows "4 of 12 tasks" and "3 waves"

#### Scenario: Ledger summary with invalid rows
- **WHEN** `decisions.md` has five rows: one `needs_human`, three valid `agent_resolved`, one `agent_resolved` with an empty evidence cell
- **THEN** the header shows "1 needs you, 3 resolved, 1 invalid, of 5 rows" and the ledger is marked blocking

#### Scenario: Repository shown when several are configured
- **GIVEN** two configured repositories
- **WHEN** the change page for `add-user-auth` in `renzrollon/checkpoint` loads
- **THEN** the header shows `renzrollon/checkpoint` beside the ref
- **AND** with one configured repository, the header shows no repository

#### Scenario: Inbox link keeps repository and ref
- **WHEN** the change page for `add-user-auth` loads for `renzrollon/interlock` on `carlrollon/sunstar`
- **THEN** the header's "Inbox" link is `/?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar`

### Requirement: Risk is shown only when observed
The header SHALL show the risk class only when the sender recorded one in `checkpoint.json` on the ref, together with the head SHA it was recorded against. The risk SHALL be labelled stale by the same freshness rule as a decision. It stays fresh while the only commits after the recorded head change this change's `decisions.md` or `checkpoint.json`, and anything else is stale, including a comparison that cannot be made. When no risk was recorded the header SHALL show `unobserved`.

#### Scenario: Recorded risk is shown with its head
- **WHEN** `checkpoint.json` carries `request.risk.class = "medium"` and `request.headSha` equal to the current head
- **THEN** the header shows "risk medium" and "recorded at <short sha>"

#### Scenario: A phone answer does not make the risk stale
- **GIVEN** `request.headSha` names the commit carrying the artifacts, and the only later commits changed this change's `checkpoint.json` and `decisions.md`
- **WHEN** the change page loads
- **THEN** the header shows "risk medium" and "recorded at <short sha>" without a stale label

#### Scenario: Risk recorded for an older head is stale
- **WHEN** `checkpoint.json` carries a risk class and a commit after its `request.headSha` changed a path other than this change's `decisions.md` or `checkpoint.json`
- **THEN** the header shows the class with the label "stale: recorded for <old short sha>"

#### Scenario: No recorded risk is unobserved
- **WHEN** there is no `checkpoint.json` or it has no `request` block
- **THEN** the header shows "risk unobserved" and the page otherwise renders fully

### Requirement: Change page failures are spoken
When a change directory does not exist on the ref, the page SHALL say so with the ref, and with the repository when more than one is configured. It SHALL offer the inbox for that same repository and ref. When the git host fails the page SHALL show the failure kind and a retry control.

#### Scenario: Unknown change on the ref
- **WHEN** `/changes/no-such-change?repo=renzrollon%2Finterlock&ref=main` is requested
- **THEN** the page shows "No change named no-such-change on main" with a link to `/?repo=renzrollon%2Finterlock&ref=main`
- **AND** with two configured repositories, the page reads "No change named no-such-change on main in renzrollon/interlock"

#### Scenario: Host failure on the change page is named
- **WHEN** the adapter fails with kind `forbidden` carrying a `retryAt`
- **THEN** the page shows "GitHub refused (forbidden), retry after <time>" and a retry control

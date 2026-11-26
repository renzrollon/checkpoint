## MODIFIED Requirements

### Requirement: Decision state is visible and replaceable
The page SHALL show the current decision (state, note, decided time, head) when one exists, and SHALL allow a new decision to replace it.

The decision SHALL be fresh when its `headSha` equals the ref's current head. It SHALL also be fresh when the current head is a descendant of that `headSha` and every path changed between them is the change's own `decisions.md` or `checkpoint.json`, the two files the app may write. Otherwise the decision SHALL be labelled stale and Approve offered again; this includes a comparison that failed, an unknown recorded head, a comparison that is behind or diverged, and a truncated path list. Freshness SHALL be judged by one rule shared with risk freshness, and the writable paths it tolerates SHALL be the same list the write guard enforces. A failed comparison SHALL never fail the page. Before writing a decision the server SHALL judge the head the page rendered against the ref's current head by the same rule, SHALL write nothing when that is stale, and SHALL record the page's head, the head the owner read, as the decision's `headSha`. The head the page carries SHALL move forward only after one of the app's own writes, and only when the ancestry rule reads the old page head fresh against the new head. Otherwise it SHALL stay the head the owner read.

#### Scenario: Approval is current right after it is written
- **GIVEN** the owner approves `add-user-auth` while the ref head is `0123456…`, and the approval commit moves the head to `89abcde…`
- **WHEN** the change page is reloaded
- **THEN** the decision bar shows the approval without a stale label, and the header shows head `89abcde`

#### Scenario: An answer after an approval keeps it current
- **GIVEN** an approval recorded for `0123456…`, followed only by commits that changed this change's `decisions.md`
- **WHEN** the change page loads
- **THEN** the approval is shown without a stale label

#### Scenario: Stale approval after the branch moved
- **GIVEN** `checkpoint.json` holds an approval for head `0123456…`
- **AND** the ref head is now `89abcde…`, with a commit in between that changed `openspec/changes/add-user-auth/design.md`
- **WHEN** the change page loads
- **THEN** the decision bar shows "approved at 0123456, branch has moved to 89abcde" and Approve is offered again

#### Scenario: Edge case — another change's decision file is not tolerated
- **GIVEN** an approval for `add-user-auth` recorded for `0123456…`, followed by a commit that changed only `openspec/changes/add-report-flag/checkpoint.json`
- **WHEN** the `add-user-auth` page loads
- **THEN** the approval is labelled stale

#### Scenario: Edge case — the comparison cannot be made
- **GIVEN** an approval recorded for a head the host reports as not found, or a comparison that fails with any host error
- **WHEN** the change page loads
- **THEN** the page renders fully and the approval is labelled stale

#### Scenario: Decision write conflict
- **WHEN** `checkpoint.json` changed on the ref between page load and the decision
- **THEN** the decision is not written and the bar shows "The decision file changed on <ref>; reloaded" with the fresh state

#### Scenario: The branch moved past what the owner read
- **GIVEN** the change page was rendered at head `0123456…`
- **AND** before the owner taps Approve a commit changed `openspec/changes/add-user-auth/design.md`, so the ref head is `89abcde…`
- **WHEN** the owner taps Approve
- **THEN** nothing is written, and the bar shows "The branch moved past 0123456; reload to read it" with a Reload control
- **AND** the note the owner typed, if any, is kept

#### Scenario: Edge case — a second tap after "moved" is refused again
- **GIVEN** the bar has shown "The branch moved past 0123456; reload to read it"
- **WHEN** the owner taps Approve again without reloading
- **THEN** nothing is written and the same message is shown, because the page still carries `0123456…`
- **AND** after the page is reloaded it renders the artifacts at `89abcde…`, and Approve records `89abcde…`

#### Scenario: A ledger answer between render and approve does not block the approval
- **GIVEN** the change page was rendered at head `0123456…`, and the only commit since changed this change's `decisions.md`
- **WHEN** the owner taps Approve
- **THEN** the decision is written with `headSha` `0123456…`, the head the owner read, and the bar shows it without a stale label

## MODIFIED Requirements

### Requirement: List active changes on a ref
The inbox SHALL list every directory under `openspec/changes/` on the requested ref of the requested repository, except `archive`. Changes with blocking ledger rows SHALL come first, then the rest alphabetically. Each entry SHALL show:
- the change name;
- its ledger status (blocking rows count, or "clear", or "missing");
- its task count as done/total;
- its wave count;
- its decision state (none, approved, returned), shown as recorded and without a freshness label; the change page is where staleness is judged.

The repository SHALL come from the `repo` query parameter and default to the first configured repository. The ref SHALL come from the `ref` query parameter and default to that repository's default branch. The inbox SHALL display which ref it is showing, and SHALL display the repository too when more than one is configured. It SHALL offer:
- a "Branch" field that reopens the inbox for the same repository on the entered ref;
- when more than one repository is configured, a picker listing every configured repository, with the current one marked.

Choosing a repository SHALL open it on its default branch.

#### Scenario: Inbox lists changes with ledger status
- **WHEN** the ref holds changes `add-user-auth` (one `needs_human` row) and `add-report-flag` (ledger clear, decision approved)
- **THEN** the inbox shows `add-user-auth` first with "1 needs you", then `add-report-flag` with "clear" and "approved", each with its done/total task count and wave count

#### Scenario: Missing ledger is shown as missing not clear
- **WHEN** a listed change has no `decisions.md`
- **THEN** its entry shows "ledger missing" and is sorted with the blocking changes

#### Scenario: Ref from query parameter
- **WHEN** the inbox is requested with `?ref=feat/auth`
- **THEN** the listing is read from `feat/auth` and the page header shows `feat/auth`

#### Scenario: Branch field opens another ref
- **GIVEN** the inbox for `renzrollon/interlock` on `main`
- **WHEN** the owner enters `carlrollon/sunstar` in the Branch field and submits
- **THEN** the inbox for `renzrollon/interlock` on `carlrollon/sunstar` opens

#### Scenario: Edge case — an empty Branch field opens the default branch
- **GIVEN** the inbox for `renzrollon/interlock` on `carlrollon/sunstar`
- **WHEN** the owner clears the Branch field, or enters only spaces, and submits
- **THEN** the inbox for `renzrollon/interlock` opens on its default branch

#### Scenario: Repository picker
- **GIVEN** configured repositories `renzrollon/interlock` and `renzrollon/checkpoint`
- **WHEN** the inbox for `renzrollon/interlock` loads
- **THEN** both repositories are listed, `renzrollon/interlock` is marked current, and `renzrollon/checkpoint` links to `/?repo=renzrollon%2Fcheckpoint`
- **AND** with one configured repository, no picker is shown

#### Scenario: The inbox costs no comparison
- **WHEN** the inbox lists changes that carry decisions recorded for older heads
- **THEN** each card shows its decision state, and the git host receives no compare request

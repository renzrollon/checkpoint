# change-inbox

## Purpose

Shows, on one phone screen, every active change on a ref and whether each one is waiting on a person, so the owner can pick the one the push was about without typing a URL.

## Requirements

### Requirement: List active changes on a ref
The inbox SHALL list every directory under `openspec/changes/` on the requested ref except `archive`, ordered with changes that have blocking ledger rows first and then alphabetically. Each entry SHALL show the change name, its ledger status (blocking rows count, or "clear", or "missing"), its task count as done/total, its wave count, and its decision state (none, approved, returned). The ref SHALL come from the `ref` query parameter and default to the repository's default branch, and the inbox SHALL display which ref it is showing.

#### Scenario: Inbox lists changes with ledger status
- **WHEN** the ref holds changes `add-user-auth` (one `needs_human` row) and `add-report-flag` (ledger clear, decision approved)
- **THEN** the inbox shows `add-user-auth` first with "1 needs you", then `add-report-flag` with "clear" and "approved", each with its done/total task count and wave count

#### Scenario: Missing ledger is shown as missing not clear
- **WHEN** a listed change has no `decisions.md`
- **THEN** its entry shows "ledger missing" and is sorted with the blocking changes

#### Scenario: Ref from query parameter
- **WHEN** the inbox is requested with `?ref=feat/auth`
- **THEN** the listing is read from `feat/auth` and the page header shows `feat/auth`

### Requirement: Empty and failed listings are spoken
When no active change exists the inbox SHALL say so. When the git host fails, the inbox SHALL show the failure kind and a retry control instead of an empty list.

#### Scenario: No active changes
- **WHEN** `openspec/changes/` on the ref contains only `archive`
- **THEN** the inbox shows "No active changes on <ref>" and no entries

#### Scenario: Host failure on the inbox is named
- **WHEN** the adapter fails with kind `unauthorized` while listing
- **THEN** the inbox shows "GitHub rejected the token (unauthorized)" with a retry control and does not render as an empty inbox

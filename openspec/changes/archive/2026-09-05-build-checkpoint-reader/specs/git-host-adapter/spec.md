## Purpose

Gives the reader one narrow, typed way to read a change's files from a branch and to write exactly two files back, so the git host can be GitHub in production and a local fixture tree in tests without any other code knowing which.

## ADDED Requirements

### Requirement: Read operations against a ref
The adapter SHALL resolve a ref to its head commit SHA, read a file at a path on that ref returning its text and blob SHA, and list a directory on that ref returning entry names and types. When no ref is given the adapter SHALL use the repository's default branch. All reads SHALL be scoped to the single configured repository.

#### Scenario: Read a file with its blob sha
- **WHEN** the adapter reads `openspec/changes/add-user-auth/decisions.md` on ref `feat/auth`
- **THEN** it returns the decoded UTF-8 text and the blob SHA the host reported for that path
- Covered by task 1.6

#### Scenario: Missing file is a typed not-found
- **WHEN** the adapter reads a path that does not exist on the ref
- **THEN** it fails with an error of kind `not_found` naming the path and ref, and no other error kind
- Covered by task 1.6

#### Scenario: Default branch is used when ref is omitted
- **WHEN** the adapter is asked for the head SHA with no ref
- **THEN** it resolves the repository's default branch and returns that branch's head SHA together with the branch name
- Covered by task 1.6

#### Scenario: Directory listing distinguishes files from directories
- **WHEN** the adapter lists `openspec/changes` on a ref
- **THEN** each entry carries its name and whether it is a file or a directory, and the `archive` directory is included unfiltered
- Covered by task 1.6

### Requirement: Guarded write with base blob sha
The adapter SHALL write a file only when the caller supplies the blob SHA it last read for that path (or declares the file new), a commit message, and a target ref. It SHALL refuse, before contacting the host, any path outside `openspec/changes/<change>/` or any file name other than `decisions.md` and `checkpoint.json`. A write the host rejects because the base SHA is stale SHALL fail with kind `conflict`.

#### Scenario: Write with current sha succeeds
- **WHEN** the caller writes `decisions.md` with the blob SHA it read moments before
- **THEN** the host records a new commit on the ref with the given message and the adapter returns the new blob SHA and commit SHA
- Covered by task 1.6

#### Scenario: Stale sha is a conflict
- **WHEN** the caller writes with a blob SHA that no longer matches the file on the ref
- **THEN** the adapter fails with kind `conflict` and does not retry
- Covered by task 1.6

#### Scenario: Write outside the allowed paths is refused locally
- **WHEN** the caller attempts to write `src/app/page.tsx` or `openspec/changes/add-user-auth/tasks.md`
- **THEN** the adapter fails with kind `forbidden_path` before any request reaches the host
- Covered by task 1.6

### Requirement: Failure classes are named
Every failure SHALL be one of `unauthorized` (bad or missing token), `forbidden` (token lacks the permission, or rate limited, carrying the reset time when the host supplies it), `not_found`, `conflict`, `forbidden_path`, or `upstream` (network failure or 5xx). No failure SHALL surface as a blank page or a generic exception.

#### Scenario: Rate limit carries its reset time
- **WHEN** the host answers 403 with a rate-limit reset header
- **THEN** the adapter fails with kind `forbidden` and a `retryAt` timestamp taken from that header
- Covered by task 1.6

#### Scenario: Bad token is unauthorized
- **WHEN** the host answers 401
- **THEN** the adapter fails with kind `unauthorized` and the message does not include the token
- Covered by task 1.6

### Requirement: Fixture adapter with the same contract
A second adapter SHALL serve the same operations from a local directory tree, computing blob SHAs the way git does so that conflict behaviour matches, and SHALL keep writes in memory so tests can assert on them without touching the tree on disk.

#### Scenario: Fixture adapter passes the shared contract tests
- **WHEN** the shared adapter contract test suite runs against the fixture adapter
- **THEN** every read, write, conflict and path-guard scenario above passes with the same observable results
- Covered by task 1.6

#### Scenario: Fixture write then read reflects the write
- **WHEN** a test writes `checkpoint.json` through the fixture adapter and reads it back on the same ref
- **THEN** the read returns the written content and a blob SHA different from the pre-write SHA, and the file on disk is unchanged
- Covered by task 1.6

## MODIFIED Requirements

### Requirement: Read operations against a ref
The adapter SHALL resolve a ref to its head commit SHA, read a file at a path on that ref returning its text and blob SHA, and list a directory on that ref returning entry names and types. When no ref is given the adapter SHALL use the repository's default branch. All reads SHALL be scoped to the one repository the adapter instance was created for.

#### Scenario: Read a file with its blob sha
- **WHEN** the adapter reads `openspec/changes/add-user-auth/decisions.md` on ref `feat/auth`
- **THEN** it returns the decoded UTF-8 text and the blob SHA the host reported for that path

#### Scenario: Missing file is a typed not-found
- **WHEN** the adapter reads a path that does not exist on the ref
- **THEN** it fails with an error of kind `not_found` naming the path and ref, and no other error kind

#### Scenario: Default branch is used when ref is omitted
- **WHEN** the adapter is asked for the head SHA with no ref
- **THEN** it resolves the repository's default branch and returns that branch's head SHA together with the branch name

#### Scenario: Directory listing distinguishes files from directories
- **WHEN** the adapter lists `openspec/changes` on a ref
- **THEN** each entry carries its name and whether it is a file or a directory, and the `archive` directory is included unfiltered

#### Scenario: Two adapters read two repositories
- **GIVEN** one adapter created for `renzrollon/interlock` and one for `renzrollon/checkpoint`
- **WHEN** each reads `README.md` on its default branch
- **THEN** each request goes to its own repository's API path and neither reads the other's

### Requirement: Fixture adapter with the same contract
A second adapter SHALL serve the same operations, `compare` included, from a local directory tree. It SHALL compute blob SHAs the way git does, so that conflict behaviour matches. It SHALL keep writes in memory, so tests can assert on them without touching the tree on disk, and SHALL remember, per ref, each head its writes produced and the path each write touched.

#### Scenario: Fixture adapter passes the shared contract tests
- **WHEN** the shared adapter contract test suite runs against the fixture adapter
- **THEN** every read, write, conflict, path-guard and compare scenario passes with the same observable results

#### Scenario: Fixture write then read reflects the write
- **WHEN** a test writes `checkpoint.json` through the fixture adapter and reads it back on the same ref
- **THEN** the read returns the written content and a blob SHA different from the pre-write SHA, and the file on disk is unchanged

## ADDED Requirements

### Requirement: Compare two heads
The adapter SHALL compare two commit SHAs and return a status of `ahead` (the second is a descendant of the first), `identical`, `behind` or `diverged`. It SHALL also return the repository-relative paths changed between them, including both the old and new path of a rename, and a `truncated` flag set when the host capped the path list. A commit the host does not know SHALL fail with kind `not_found`. On GitHub the comparison SHALL use the compare API, and a path list at the API's 300-file cap SHALL be marked truncated.

#### Scenario: A descendant that only touched the decision file
- **GIVEN** head `A`, then a commit `B` on the same ref that changed only `openspec/changes/add-user-auth/checkpoint.json`
- **WHEN** the adapter compares `A` with `B`
- **THEN** it returns status `ahead`, the single path `openspec/changes/add-user-auth/checkpoint.json`, and `truncated` false

#### Scenario: Comparing a head with itself
- **WHEN** the adapter compares `A` with `A`
- **THEN** it returns status `identical` and no paths

#### Scenario: Unknown commit
- **WHEN** the adapter compares a SHA the host has never seen with the current head
- **THEN** it fails with kind `not_found`

#### Scenario: Edge case — a renamed file reports both paths
- **GIVEN** the GitHub compare API reports a file with `status: renamed`, `filename: docs/b.md` and `previous_filename: docs/a.md`
- **WHEN** the adapter maps the response
- **THEN** the changed paths include both `docs/a.md` and `docs/b.md`

#### Scenario: Edge case — a capped file list is truncated
- **GIVEN** the GitHub compare API returns 300 files
- **WHEN** the adapter maps the response
- **THEN** `truncated` is true

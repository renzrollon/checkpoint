## ADDED Requirements

### Requirement: Production refuses the fixture adapter
When the server runs with `NODE_ENV=production`, `CHECKPOINT_GIT_HOST=fixture` SHALL be a configuration error naming `CHECKPOINT_GIT_HOST`, so a production deployment can never serve fixture data or record writes only in memory. Development and test runs SHALL keep accepting the fixture adapter.

#### Scenario: Fixture host refused in production
- **GIVEN** `NODE_ENV=production` and `CHECKPOINT_GIT_HOST=fixture`
- **WHEN** the environment is parsed
- **THEN** parsing fails with a configuration error naming `CHECKPOINT_GIT_HOST`

#### Scenario: Fixture host still works in development
- **GIVEN** `NODE_ENV=development` and `CHECKPOINT_GIT_HOST=fixture`
- **WHEN** the environment is parsed
- **THEN** parsing succeeds with the fixture adapter selected

### Requirement: Configuration errors are spoken by name
When the environment is incomplete or invalid, every page SHALL render "Checkpoint is not configured", followed by the names of the variables at fault, in place of its content. Every server action SHALL answer `{ ok: false, reason: "config" }` with a message naming those variables. Neither SHALL include any variable's value, the token or the access key. Neither SHALL render as a blank page or as the framework's generic error page.

#### Scenario: Missing token on the inbox
- **GIVEN** `CHECKPOINT_GIT_HOST=github`, `CHECKPOINT_REPOS=renzrollon/interlock` and no `CHECKPOINT_GITHUB_TOKEN`
- **WHEN** an authenticated owner opens the inbox
- **THEN** the page shows "Checkpoint is not configured" and names `CHECKPOINT_GITHUB_TOKEN`

#### Scenario: Edge case — a value is never echoed
- **GIVEN** `CHECKPOINT_REPOS=not-a-repo` and a set `CHECKPOINT_GITHUB_TOKEN`
- **WHEN** the change page is opened
- **THEN** the page names `CHECKPOINT_REPOS`, and neither the text `not-a-repo` nor the token appears in the response

#### Scenario: A write under a broken configuration
- **WHEN** a decision request arrives while the environment is invalid
- **THEN** the action answers `{ ok: false, reason: "config" }` naming the variables, and nothing is written

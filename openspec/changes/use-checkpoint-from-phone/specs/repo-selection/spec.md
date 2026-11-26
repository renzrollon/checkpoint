## ADDED Requirements

### Requirement: Repository allowlist
The app SHALL read the repositories it may serve from `CHECKPOINT_REPOS`, a comma-separated list of `owner/name` entries. The first entry SHALL be the default repository. When `CHECKPOINT_REPOS` is unset, a set `CHECKPOINT_REPO` SHALL be read as a one-entry list. Setting both variables, an entry that is not `owner/name`, an empty list, or the same repository listed twice when compared case-insensitively SHALL be a configuration error naming the variable. With the fixture adapter, the list SHALL hold exactly one repository, defaulting to `fixture/repo`.

#### Scenario: Allowlist with a default
- **GIVEN** `CHECKPOINT_REPOS=renzrollon/interlock, renzrollon/checkpoint`
- **WHEN** the environment is parsed
- **THEN** the configured repositories are `renzrollon/interlock` and `renzrollon/checkpoint`, in that order, and `renzrollon/interlock` is the default

#### Scenario: The older single variable still works
- **GIVEN** only `CHECKPOINT_REPO=renzrollon/interlock` is set
- **WHEN** the environment is parsed
- **THEN** the configured repositories are exactly `renzrollon/interlock`

#### Scenario: Edge case — both variables set
- **GIVEN** both `CHECKPOINT_REPO` and `CHECKPOINT_REPOS` are set
- **WHEN** the environment is parsed
- **THEN** parsing fails with a configuration error naming `CHECKPOINT_REPO` and `CHECKPOINT_REPOS`

#### Scenario: Edge case — a duplicate differing only in case
- **GIVEN** `CHECKPOINT_REPOS=renzrollon/interlock,RenzRollon/Interlock`
- **WHEN** the environment is parsed
- **THEN** parsing fails with a configuration error naming `CHECKPOINT_REPOS`

#### Scenario: Edge case — the fixture adapter with two repositories
- **GIVEN** `CHECKPOINT_GIT_HOST=fixture` and `CHECKPOINT_REPOS=a/one,b/two`
- **WHEN** the environment is parsed
- **THEN** parsing fails with a configuration error naming `CHECKPOINT_REPOS`

### Requirement: The repository parameter resolves to one canonical entry
Every page and server action SHALL take the repository from a `repo` value resolved by one function. That function trims the value, compares it case-insensitively against the allowlist, and returns the configured entry as the canonical repository. An absent or empty value SHALL resolve to the default repository. A value matching no entry SHALL resolve to "unknown", never to the default. Every host lookup, link and write SHALL use the canonical entry the resolution returned.

#### Scenario: Case and whitespace resolve to the configured entry
- **GIVEN** the allowlist holds `renzrollon/interlock`
- **WHEN** a page is requested with `?repo=%20RenzRollon/Interlock%20`
- **THEN** the page reads from `renzrollon/interlock`, and every link it renders carries `repo=renzrollon%2Finterlock`

#### Scenario: No repo parameter means the default repository
- **WHEN** the inbox is requested with no `repo` parameter
- **THEN** it reads from the first configured repository and shows that repository's default branch unless `ref` is given

#### Scenario: Unknown repository is spoken, not guessed
- **GIVEN** the allowlist holds `renzrollon/interlock` and `renzrollon/checkpoint`
- **WHEN** `/changes/add-user-auth?repo=someone/else&ref=main` is requested
- **THEN** the page shows "Checkpoint is not configured for someone/else" with links to the two configured repositories, and no host request is made for `someone/else`

### Requirement: One host per configured repository
The app SHALL create at most one git host per canonical repository and reuse it across requests. Requesting a host for a repository outside the allowlist SHALL fail rather than create one.

#### Scenario: Two repositories get two hosts
- **GIVEN** two configured repositories
- **WHEN** the inbox is rendered once for each
- **THEN** each render read through a host created for its own repository, and a second render of either reuses that repository's host

#### Scenario: A host is never created for an unlisted repository
- **WHEN** code asks for the host of `someone/else` while it is not configured
- **THEN** the call fails, and no GitHub request is made

### Requirement: Writes re-validate the repository
The answer and decision server actions SHALL receive the repository with every request and resolve it again on the server before reading or writing. A repository that does not resolve SHALL be refused with reason `unknown_repo`, and nothing SHALL be written.

#### Scenario: A write for an unlisted repository is refused
- **WHEN** an answer request names `repo` `someone/else`
- **THEN** the action answers `{ ok: false, reason: "unknown_repo" }` and no write reaches any host

#### Scenario: A write uses the canonical repository
- **GIVEN** the allowlist holds `renzrollon/interlock`
- **WHEN** a decision request names `repo` `RENZROLLON/interlock`
- **THEN** `checkpoint.json` is written through the `renzrollon/interlock` host

### Requirement: Links keep the repository and branch
Every in-app link to the inbox or to a change SHALL carry the canonical `repo` and the resolved `ref`, each URL-encoded. This covers the chrome home link, inbox cards, the change page's inbox link, the not-found page's inbox link, the branch field and the repository picker. The chrome home link SHALL carry the canonical `repo` and the resolved `ref` of the page it appears on, never the raw query. On the unknown-repository, configuration-error and not-found pages it SHALL be `/`.

#### Scenario: Card link carries both
- **GIVEN** the inbox for `renzrollon/interlock` on `carlrollon/sunstar`
- **WHEN** it renders the card for `add-user-auth`
- **THEN** the card links to `/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar`

#### Scenario: Back to the inbox stays on the branch
- **GIVEN** the change page for `add-user-auth` on `renzrollon/interlock`, ref `carlrollon/sunstar`
- **WHEN** the owner taps the chrome "Checkpoint" link or the page's "Inbox" link
- **THEN** the inbox opens for `renzrollon/interlock` on `carlrollon/sunstar`, not the default branch

#### Scenario: Edge case — the home link carries the canonical repository, never the raw query
- **GIVEN** the change page was opened from `/changes/add-user-auth?repo=RENZROLLON%2FInterlock&ref=main`
- **WHEN** the page renders
- **THEN** the chrome "Checkpoint" link is `/?repo=renzrollon%2Finterlock&ref=main`

#### Scenario: Edge case — a change URL with no query still keeps the branch
- **GIVEN** configured repositories `renzrollon/interlock` (default branch `main`) and `renzrollon/checkpoint`
- **WHEN** `/changes/add-user-auth` is requested with no query
- **THEN** the chrome "Checkpoint" link and the page's "Inbox" link are `/?repo=renzrollon%2Finterlock&ref=main`


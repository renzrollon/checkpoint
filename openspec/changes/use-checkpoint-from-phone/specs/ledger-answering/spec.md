## ADDED Requirements

### Requirement: Answering warns when the design does not reference the row
For every `needs_human` row the owner may answer, the app SHALL decide whether `design.md` on the ref references the row's id. It SHALL use the same id matcher the ledger audit uses. When the design does not reference the id, or `design.md` is missing, the answer form SHALL warn that the answered row will read as invalid on the laptop until the design references it. The form SHALL still accept the answer, and the app SHALL not write `design.md`.

#### Scenario: Referenced row shows no warning
- **GIVEN** `design.md` mentions `D1`
- **WHEN** the owner opens the answer form for `D1`
- **THEN** no reference warning is shown

#### Scenario: Unreferenced row warns and still answers
- **GIVEN** `design.md` never mentions `D7`
- **WHEN** the owner opens the answer form for `D7`
- **THEN** the form shows "design.md does not mention D7; after this answer the laptop reads the row as invalid until the design references it"
- **AND** submitting an answer still commits `decisions.md`, and `design.md` is unchanged

#### Scenario: Edge case — an id inside a longer token is not a reference
- **GIVEN** `design.md` mentions `D10` but never `D1`
- **WHEN** the owner opens the answer form for `D1`
- **THEN** the reference warning is shown

### Requirement: An answer does not carry the page past commits the owner has not read
An answer SHALL be committed whenever the ledger file itself is unchanged, even if the branch has moved. After the write, the head the page carries SHALL advance to the branch's head only when the commits since the page's head changed nothing but this change's `decisions.md` and `checkpoint.json`. Otherwise the page's head SHALL stay as it was, and the panel SHALL say the branch also moved and that the page must be reloaded before approving.

#### Scenario: A plain answer advances the page head
- **GIVEN** the page was rendered at head `0123456…` and nothing else changed on the ref
- **WHEN** the owner answers `D1`
- **THEN** the page head becomes the answer's commit and the panel shows "D1 answered and committed to <ref>" without a moved notice

#### Scenario: An answer while the design changed on the branch
- **GIVEN** the page was rendered at head `0123456…`, and a commit since changed `openspec/changes/add-user-auth/design.md`
- **WHEN** the owner answers `D1`
- **THEN** `decisions.md` is committed, the page head stays `0123456…`, and the panel shows that the branch also moved and to reload before approving
- **AND** tapping Approve is then refused as "The branch moved past 0123456; reload to read it"


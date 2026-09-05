## Purpose

Lets the owner answer a `needs_human` row from the phone and commit a `decisions.md` that Interlock's own ledger audit accepts without a single invalid row, so the laptop side needs no re-formatting.

## ADDED Requirements

### Requirement: Ledger parse and serialize parity with Interlock
The app SHALL parse and serialize `decisions.md` with the same grammar Interlock's `interlock ledger` audit uses: a `# Decisions — <change>` heading, a five-column table `id | question | class | resolution | evidence`, `\|` as an escaped pipe, the same set of placeholder and hedge cells read as empty, and the em dash written for empty cells. Serialize-then-parse SHALL be stable. Golden fixtures generated from Interlock's module SHALL pin this parity.

#### Scenario: Golden fixtures round-trip
- **WHEN** each fixture ledger is parsed and re-serialized by the app
- **THEN** the output is byte-identical to the golden output produced by Interlock's serializer, and the parsed rows equal the golden parse
- Covered by task 1.2

#### Scenario: Escaped pipe survives an edit
- **WHEN** a row whose question contains `\|` is answered and re-serialized
- **THEN** the question cell still contains the escaped pipe and the file parses to the same number of columns
- Covered by task 1.2

#### Scenario: Hedge cells read as empty
- **WHEN** a row's evidence cell is `Obvious.` or `see above`
- **THEN** the parser reports the evidence as empty and the row as invalid when its class is `agent_resolved`
- Covered by task 1.2

#### Scenario: Unparseable ledger is reported not emptied
- **WHEN** `decisions.md` has neither a decisions heading nor a table
- **THEN** the app reports the ledger as unparseable and blocking, and offers no rows to answer
- Covered by task 1.2

### Requirement: Answer a needs_human row in place
The app SHALL let the owner answer only rows whose class is `needs_human`. Answering SHALL set the class to `agent_resolved`, the resolution to the answer, and the evidence to `human decision <YYYY-MM-DD> via Checkpoint`, keeping the row's id, question and position, and leaving every other line of the file byte-identical. The answer SHALL be non-empty after trimming, SHALL have newlines collapsed to spaces and literal pipes escaped. The result SHALL be committed to `decisions.md` on the ref with message `checkpoint(<change>): answer <id>`.

#### Scenario: Answer flips the row
- **WHEN** row `D1` (`needs_human`) is answered with "shared access key cookie" on 2026-09-05
- **THEN** the committed `decisions.md` has `D1` as `| D1 | <same question> | agent_resolved | shared access key cookie | human decision 2026-09-05 via Checkpoint |` and every other line byte-identical to before
- Covered by task 2.3

#### Scenario: Answer containing a pipe is escaped
- **WHEN** row `D1` is answered with "cookie | 30 days"
- **THEN** the resolution cell reads `cookie \| 30 days`, the file still parses to five columns, and the row is valid
- Covered by task 1.2

#### Scenario: Blank answer is refused
- **WHEN** row `D1` is answered with whitespace only
- **THEN** the form shows "An answer is required" and nothing is written
- Covered by task 3.3

#### Scenario: Answering a resolved row is refused
- **WHEN** an answer is submitted for a row whose class is already `agent_resolved`
- **THEN** the request fails with "D2 is not waiting on a person" and nothing is written
- Covered by task 2.3

#### Scenario: Options offered from the question text
- **WHEN** the question reads "Pin zod 4.4.3 or leave it unpinned?"
- **THEN** the form offers the choices "Pin zod 4.4.3" and "leave it unpinned" as one-tap options and still accepts free text
- Covered by task 1.5

#### Scenario: Options from a colon-prefixed list
- **WHEN** the question reads "How is the app gated: a cookie, Deployment Protection, or Cloudflare Access?"
- **THEN** the form offers "a cookie", "Deployment Protection" and "Cloudflare Access" and nothing from before the colon
- Covered by task 1.5

### Requirement: Stale ledger writes are refused
The write SHALL use the blob SHA of the `decisions.md` that was shown to the owner. When the file changed on the ref since, the write SHALL fail without retry and the page SHALL tell the owner the ledger moved and reload it.

#### Scenario: Ledger changed since it was shown
- **WHEN** `decisions.md` was committed by someone else between the page load and the answer
- **THEN** the answer is not written, the ledger panel shows "The ledger changed on <ref> since you opened it; reloaded", and the fresh rows are shown
- Covered by task 3.3

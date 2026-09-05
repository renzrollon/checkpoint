# Decisions — escaped-pipe

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | Should the row split on `a \| b` or keep it whole? | needs_human | — | — |
| D2 | Which separator is written for an empty cell? | agent_resolved | The em dash, written as `\|` never | lib/ledger.mjs:283 |

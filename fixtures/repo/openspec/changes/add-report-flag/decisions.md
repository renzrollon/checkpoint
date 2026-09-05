# Decisions — add-report-flag

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | What does the flag default to? | agent_resolved | `true`, so nobody loses a report | design.md §D1; product brief §Report |
| D2 | Where is the flag read? | agent_resolved | Once per generator run | design.md §D2; `generator.ts:40` |

# Decisions — hedges

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | Is the cache keyed by ref? | agent_resolved | Yes, by ref then path | Obvious. |
| D2 | Does logout clear the cookie? | agent_resolved | Yes | see above |
| D3 | Is the token logged? | agent_resolved | Never | src/lib/githost/github.ts:12 |
| D4 | Which port does dev use? | agent_resolved | n/a | README.md |
| D5 | Do we retry on conflict? | Needs Human | tbd | ? |

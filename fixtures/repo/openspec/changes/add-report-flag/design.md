## Context

One boolean on an existing record.

## Decisions

### D1. Default value (agent_resolved)
The flag defaults to `true` so nobody loses a report they were getting.

### D2. Where it is read (agent_resolved)
The generator reads it once per run, never per row.

# Decisions — add-user-auth

Rows explore and spec recorded. D1 waits on a person.

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | How is the reader app itself gated: a shared access key exchanged for an httpOnly session cookie, Vercel Deployment Protection, or Cloudflare Access? | needs_human | — | — |
| D2 | Which git host does the adapter target in production? | agent_resolved | GitHub; the adapter contract stays host-neutral | `git remote -v` on both source repos |
| D3 | Where does the approval marker live? | agent_resolved | `openspec/changes/<change>/checkpoint.json` | app-ideas brief `:86` |

Trailing prose after the table stays untouched.

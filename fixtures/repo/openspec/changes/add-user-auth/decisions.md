# Decisions — add-user-auth

| id | question | class | resolution | evidence |
|----|----------|-------|------------|----------|
| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | needs_human | — | — |
| D2 | Which cookie attributes does the session carry? | agent_resolved | httpOnly, Secure, SameSite=Lax, 30 days | design.md §D2; OWASP session cheat sheet |
| D3 | How is the key compared? | agent_resolved | `timingSafeEqual` over equal-length buffers | design.md §D3; node:crypto docs |
| D4 | Where does the login page live? | agent_resolved | `/login`, exempt from the gate with `/api/session` | design.md §D4 |

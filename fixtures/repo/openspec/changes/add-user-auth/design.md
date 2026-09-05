## Context

The app is reachable from the internet and holds a repository token, so the gate fails closed. Raw HTML in artifacts is rendered as text: a design that says `<script>alert(1)</script>` must show those characters, not run them.

## Decisions

### D1. How the gate is implemented (needs_human)
Left to the owner: a session cookie, Vercel Deployment Protection, or Cloudflare Access.

### D2. Cookie attributes (agent_resolved)
httpOnly, Secure, SameSite=Lax, 30-day expiry.

### D3. Constant-time key comparison (agent_resolved)
`timingSafeEqual` over equal-length buffers.

### D4. Where the login page lives (agent_resolved)
`/login`, exempt from the gate together with `/api/session`.

## Module layout

```
src/lib/auth/session.ts
src/proxy.ts
src/app/login/page.tsx
```

| column a | column b |
|---|---|
| tables render | with remark-gfm |

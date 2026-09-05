## MODIFIED Requirements

### Requirement: Every route is gated by a session
The app SHALL refuse every page and API route, except the login page, the session endpoint and the PWA manifest and icons, unless the request carries a valid session. A refused page request SHALL redirect to the login page with the original path preserved, and the redirect's `Location` SHALL be a same-origin path with no scheme and no host, so the browser resolves it against the address it used to reach the server rather than the address the server is bound to. A refused API request SHALL respond 401 with a JSON body naming the reason.

#### Scenario: Unauthenticated page request is redirected to login
- **GIVEN** a request for `/changes/add-user-auth` carries no session cookie
- **WHEN** the gate handles it
- **THEN** the response status is 307, its `Location` is exactly `/login?next=%2Fchanges%2Fadd-user-auth`, and no artifact content is in the response
- Covered by task 2.1

#### Scenario: Edge case — the redirect ignores the server's bind address
- **GIVEN** the server is bound to `0.0.0.0` and a phone on the LAN requests `/changes/add-user-auth?ref=feat/auth` with a `Host` of `192.168.7.42:3200`, so the server's own request URL reads `http://0.0.0.0:3200/...`
- **WHEN** the request carries no session cookie
- **THEN** the `Location` is exactly `/login?next=%2Fchanges%2Fadd-user-auth%3Fref%3Dfeat%2Fauth`, containing neither `0.0.0.0`, `localhost` nor any scheme
- **AND** the same holds when the server's request URL reads `http://localhost:3000/...` behind a tunnel
- Covered by task 1.1

#### Scenario: Unauthenticated write is rejected with 401
- **WHEN** a request to answer a ledger row carries no session cookie
- **THEN** the response is 401 with body `{ "error": "unauthenticated" }` and nothing is written to the git host
- Covered by task 2.1

#### Scenario: Tampered session cookie is rejected
- **WHEN** a request carries a session cookie whose signature does not verify
- **THEN** the request is treated exactly as unauthenticated and the cookie is cleared
- Covered by task 2.1

#### Scenario: Expired session is rejected
- **WHEN** a request carries a session cookie whose signature verifies but whose expiry is in the past
- **THEN** the request is treated exactly as unauthenticated and the cookie is cleared
- Covered by task 2.1

### Requirement: Access key exchange
The session endpoint SHALL accept the access key, compare it to the configured key in constant time, and on success set an httpOnly, SameSite=Lax session cookie that expires after 30 days. The cookie SHALL carry the `Secure` attribute when the server runs in production or when the request arrived over https; a development server reached over plain http SHALL omit `Secure`, so a phone on the same network can hold the session. On failure the endpoint SHALL respond 401 without revealing whether a key is configured. After a successful login the endpoint SHALL answer 303 with a `Location` that is a same-origin path with no scheme and no host: the preserved `next` path, or `/` when none was given or the given one is not a same-origin path.

#### Scenario: Correct key issues a session
- **GIVEN** the login form posts the configured access key with `next=/changes/add-user-auth`
- **WHEN** the session endpoint handles it
- **THEN** a session cookie is set with the httpOnly and SameSite=Lax attributes, with `Secure` when in production or over https
- **AND** the response status is 303 with `Location` exactly `/changes/add-user-auth`, so the browser lands on the change page at the address it used
- Covered by task 2.1

#### Scenario: Edge case — the redirect does not depend on how the server was addressed
- **GIVEN** the server's own request URL reads `http://0.0.0.0:3200/api/session` because it is bound to `0.0.0.0` and the phone sent `Host: 192.168.7.42:3200`
- **WHEN** the configured key is posted with `next=/`
- **THEN** the response is 303 with `Location` exactly `/` and the session cookie is set
- **AND** with `X-Forwarded-Proto: https`, `X-Forwarded-Host: checkpoint.example.app` and `next=/changes/x`, the `Location` is exactly `/changes/x`
- Covered by task 1.1

#### Scenario: Edge case — an unsafe next falls back to the inbox
- **GIVEN** the configured key is posted
- **WHEN** `next` is `//evil.example`, `https://evil.example/x`, `/login`, or absent
- **THEN** the response is 303 with `Location` exactly `/`
- Covered by task 1.1

#### Scenario: Edge case — the Secure attribute follows the transport
- **GIVEN** a development server (not production) reached over plain http from a LAN address
- **WHEN** the configured key is posted
- **THEN** the session cookie is set without `Secure`, and a later page request from the same phone over http is treated as authenticated
- **AND** in production, or when the request arrived over https, the cookie carries `Secure`
- Covered by task 1.1

#### Scenario: Wrong key is refused
- **WHEN** the login form posts a key that differs from the configured key in any character
- **THEN** the response is 401, no cookie is set, and the login page shows "That key was not accepted"
- Covered by task 2.1

#### Scenario: Logout clears the session
- **WHEN** an authenticated user activates "Sign out"
- **THEN** the session cookie is cleared and the next page request redirects to the login page
- Covered by task 2.1

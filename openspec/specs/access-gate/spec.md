# access-gate

## Purpose

Keeps the reader private to its one owner: nothing renders and nothing is written until a shared access key has been exchanged for a session, and a missing key configuration fails closed rather than open.

## Requirements

### Requirement: Every route is gated by a session
The app SHALL refuse every page and API route, except the login page, the session endpoint and the PWA manifest and icons, unless the request carries a valid session. A refused page request SHALL redirect to the login page with the original path preserved; a refused API request SHALL respond 401 with a JSON body naming the reason.

#### Scenario: Unauthenticated page request is redirected to login
- **WHEN** a request for `/changes/add-user-auth` carries no session cookie
- **THEN** the response redirects to `/login?next=/changes/add-user-auth` and no artifact content is in the response

#### Scenario: Unauthenticated write is rejected with 401
- **WHEN** a request to answer a ledger row carries no session cookie
- **THEN** the response is 401 with body `{ "error": "unauthenticated" }` and nothing is written to the git host

#### Scenario: Tampered session cookie is rejected
- **WHEN** a request carries a session cookie whose signature does not verify
- **THEN** the request is treated exactly as unauthenticated and the cookie is cleared

#### Scenario: Expired session is rejected
- **WHEN** a request carries a session cookie whose signature verifies but whose expiry is in the past
- **THEN** the request is treated exactly as unauthenticated and the cookie is cleared

### Requirement: Access key exchange
The session endpoint SHALL accept the access key, compare it to the configured key in constant time, and on success set an httpOnly, Secure, SameSite=Lax session cookie that expires after 30 days. On failure it SHALL respond 401 without revealing whether a key is configured. After a successful login the app SHALL redirect to the preserved `next` path, or to the inbox when none was given.

#### Scenario: Correct key issues a session
- **WHEN** the login form posts the configured access key with `next=/changes/add-user-auth`
- **THEN** a session cookie is set with the httpOnly, Secure and SameSite=Lax attributes and the browser is redirected to `/changes/add-user-auth`

#### Scenario: Wrong key is refused
- **WHEN** the login form posts a key that differs from the configured key in any character
- **THEN** the response is 401, no cookie is set, and the login page shows "That key was not accepted"

#### Scenario: Logout clears the session
- **WHEN** an authenticated user activates "Sign out"
- **THEN** the session cookie is cleared and the next page request redirects to the login page

### Requirement: Missing key configuration fails closed
When no access key is configured on the server, the app SHALL respond 503 to every request except the manifest and icons, with the text "Checkpoint has no access key configured", and SHALL never issue a session.

#### Scenario: No configured key blocks login
- **WHEN** the server has no access key configured and any key is posted to the session endpoint
- **THEN** the response is 503 with the configuration message and no cookie is set

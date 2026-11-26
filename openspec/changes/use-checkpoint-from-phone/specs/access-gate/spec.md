## MODIFIED Requirements

### Requirement: Access key exchange
The session endpoint SHALL accept the access key, compare it to the configured key in constant time, and on success set an httpOnly, SameSite=Lax session cookie that expires after 30 days. The cookie SHALL carry the `Secure` attribute when the server runs in production or when the request arrived over https. A development server reached over plain http SHALL omit `Secure`, so a phone on the same network can hold the session. On failure the endpoint SHALL respond 401 without revealing whether a key is configured. After a successful login the endpoint SHALL answer 303 with a `Location` that is a same-origin path with no scheme and no host: the preserved `next` path with its query unchanged, or `/` when none was given or the given one is not a same-origin path.

#### Scenario: Correct key issues a session
- **GIVEN** the login form posts the configured access key with `next=/changes/add-user-auth`
- **WHEN** the session endpoint handles it
- **THEN** a session cookie is set with the httpOnly and SameSite=Lax attributes, with `Secure` when in production or over https
- **AND** the response status is 303 with `Location` exactly `/changes/add-user-auth`, so the browser lands on the change page at the address it used

#### Scenario: A push link survives sign-in
- **GIVEN** the configured key is posted with `next=/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar`
- **WHEN** the session endpoint handles it
- **THEN** the response is 303 with `Location` exactly `/changes/add-user-auth?repo=renzrollon%2Finterlock&ref=carlrollon%2Fsunstar`
- **AND** opening that change URL signed out, signing in, and following the redirects lands on the change page for `add-user-auth` on ref `carlrollon/sunstar`

#### Scenario: Edge case — the redirect does not depend on how the server was addressed
- **GIVEN** the server's own request URL reads `http://0.0.0.0:3200/api/session` because it is bound to `0.0.0.0` and the phone sent `Host: 192.168.7.42:3200`
- **WHEN** the configured key is posted with `next=/`
- **THEN** the response is 303 with `Location` exactly `/` and the session cookie is set
- **AND** with `X-Forwarded-Proto: https`, `X-Forwarded-Host: checkpoint.example.app` and `next=/changes/x`, the `Location` is exactly `/changes/x`

#### Scenario: Edge case — an unsafe next falls back to the inbox
- **GIVEN** the configured key is posted
- **WHEN** `next` is `//evil.example`, `https://evil.example/x`, `/login`, or absent
- **THEN** the response is 303 with `Location` exactly `/`

#### Scenario: Edge case — the Secure attribute follows the transport
- **GIVEN** a development server (not production) reached over plain http from a LAN address
- **WHEN** the configured key is posted
- **THEN** the session cookie is set without `Secure`, and a later page request from the same phone over http is treated as authenticated
- **AND** in production, or when the request arrived over https, the cookie carries `Secure`

#### Scenario: Wrong key is refused
- **WHEN** the login form posts a key that differs from the configured key in any character
- **THEN** the response is 401, no cookie is set, and the login page shows "That key was not accepted"

#### Scenario: Logout clears the session
- **WHEN** an authenticated user activates "Sign out"
- **THEN** the session cookie is cleared and the next page request redirects to the login page

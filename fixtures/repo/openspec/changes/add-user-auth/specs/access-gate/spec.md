## Purpose

Keeps the app private to its owner.

## ADDED Requirements

### Requirement: Every route is gated by a session
The app SHALL refuse every page unless the request carries a valid session.

#### Scenario: Unauthenticated page request is redirected to login
- **WHEN** a request for `/changes/x` carries no session cookie
- **THEN** the response redirects to `/login?next=/changes/x`

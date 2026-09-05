## Why

Sign-in today is a shared password in a config file. The app needs per-user sessions before the report flag can be scoped to an owner.

## What Changes

- New session cookie issued by `POST /api/session`.
- A login page at `/login` that preserves the `next` path.
- Every route redirects to login without a session.

## Capabilities

### New Capabilities
- `access-gate`: refuse every route until a session exists.
- `change-inbox`: list the owner's changes.

## Impact

- New code under `src/lib/auth/` and `src/app/login/`.
- One new environment variable, `APP_ACCESS_KEY`.

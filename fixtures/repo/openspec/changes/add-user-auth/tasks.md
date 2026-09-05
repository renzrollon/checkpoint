## 1. Foundation

- [x] 1.1 Add `src/lib/auth/session.ts` with make and verify
- [x] 1.2 Add `src/lib/env.ts` validating `APP_ACCESS_KEY`
- [x] 1.3 Write session unit tests
- [x] 1.4 Add the login page shell

## 2. Gate

- [ ] 2.1 Add `src/proxy.ts` redirecting page requests
- [ ] 2.2 Return 401 JSON for API requests
- [ ] 2.3 Clear a tampered cookie
- [ ] 2.4 Write proxy tests

## 3. Session endpoint

- [ ] 3.1 `POST /api/session` exchanges the key
- [ ] 3.2 `DELETE /api/session` clears the cookie
- [ ] 3.3 Sign out control in the layout
- [ ] 3.4 End-to-end login smoke

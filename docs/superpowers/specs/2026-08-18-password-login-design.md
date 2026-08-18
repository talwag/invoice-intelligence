# Password-protected login — design

GitHub issue: [#10 — Add password-protected login to the live app](https://github.com/talwag/invoice-intelligence/issues/10)

## Overview

The live app has zero authentication today: `/app` (the dashboard) and
several API routes can be viewed and edited by anyone who has the URL, with
no password, login, or session of any kind. This was confirmed live during a
security audit in this session — real invoice data is publicly viewable and
editable right now. This design adds a single shared password gating the
routes that expose or mutate real data, while keeping the landing page (`/`)
public.

## Decisions

- **Credential model:** a single shared password (not per-user accounts).
  This is a solo-owned project with no other stakeholders needing individual
  access; a shared password is the simplest model that fits.
- **Cloudflare Access was considered and rejected.** Access's native login
  methods are identity-based (per-person email one-time-PIN, or SSO) — not a
  single shared static password, which is what's actually wanted here.
  Making Access do a shared password would require bolting on a custom OIDC
  identity provider, which is more setup than writing the login directly.
  Access would also need careful path-by-path configuration to cover the
  actual vulnerable routes without breaking the existing `X-API-Key` access
  for external callers (see below) — no simpler than the code version, and
  external to this repo.
- **Enforcement point: `custom-worker.js`, not Next.js middleware/proxy.**
  Next.js 16 renamed `middleware.ts` to `proxy.ts`; as of this app's exact
  versions (`next@16.2.10`, `@opennextjs/cloudflare@^1.20.1`), there is a
  confirmed, unresolved compatibility problem between Next.js 16's proxy
  architecture and the Cloudflare adapter
  ([cloudflare/workers-sdk#13755](https://github.com/cloudflare/workers-sdk/issues/13755)).
  Building the gate as Next.js middleware risks it silently not running on
  this exact deployment. `custom-worker.js` is already this app's actual
  Cloudflare Worker entry point (built earlier for the Supabase keep-alive
  cron) — every request passes through its `fetch` handler before Next.js
  ever sees it, with no framework abstraction in between.
- **Session mechanism: a stateless, HMAC-signed cookie**, not a database
  session table. No new infrastructure, no session-storage cleanup, and
  matches this app's existing "no migrations folder, schema changes by hand"
  posture — adding a sessions table would be disproportionate for a
  single-shared-password gate.
- **One secret does double duty.** `APP_PASSWORD` (a new Worker secret) is
  both the login password and the HMAC signing key for the session cookie.
  Knowing a valid signature doesn't reveal the key, so reusing it is safe and
  avoids managing a second secret.
- **Basic Auth was considered and rejected**, despite being less code (no
  login page, no cookie, no session-expiry logic — just an `Authorization`
  header check). Rejected for UX: no styled Hebrew/RTL login page consistent
  with the rest of the app, and no clean logout (Basic Auth credentials are
  cached by the browser with no standard way to clear them short of clearing
  site data).
- **Brute-force protection: a Cloudflare Rate Limiting Rule**, configured in
  the Cloudflare dashboard on `/api/login`, not app code. Cloudflare's edge
  is the right layer for this — it blocks abusive traffic before it reaches
  the Worker at all. This is a manual, documented deployment step (see
  Out of Scope), not something this plan implements in code.
- **`X-API-Key` stays completely separate and untouched.** `/api/documents`
  and `/api/documents/[id]` keep their existing header-based check for
  external/programmatic callers. The new password gate does not apply to
  them, and the password gate does not replace or wrap that mechanism.

## Protected vs. public routes

**Gated by the new password check:**
- `/app` (the dashboard page)
- `/api/upload`
- `/api/documents/[id]/pdf-url` (matched as `/api/documents/*/pdf-url`)
- `/api/documents/[id]/edit` (matched as `/api/documents/*/edit`)

**Untouched — always public, no session check:**
- `/` (the landing page)
- `/login` (the new login page — must be reachable to log in at all)
- `/api/login` (the new login endpoint — same reason)

**Untouched — keep the existing separate `X-API-Key` check, unrelated to this
gate:**
- `/api/documents`
- `/api/documents/[id]`

## Session design

The session cookie's value is:

```
<expiryUnixMs>.<hex HMAC-SHA256 signature of expiryUnixMs, keyed by APP_PASSWORD>
```

- **Sign:** `signature = HMAC-SHA256(key = APP_PASSWORD, message = String(expiryUnixMs))`,
  hex-encoded.
- **Verify:** split the cookie on `.`, recompute the HMAC over the expiry
  value, and compare to the provided signature using a constant-time
  comparison (`node:crypto`'s `timingSafeEqual`, available here because
  `wrangler.jsonc` already sets `compatibility_flags: ["nodejs_compat"]`).
  Reject if the signature doesn't match, or if `expiryUnixMs` is in the
  past.
- **Cookie attributes:** `httpOnly`, `secure`, `SameSite=Lax`, `Path=/`,
  `Max-Age` = 30 days from login.
- **Password check:** the submitted password is compared to `APP_PASSWORD`
  with the same constant-time comparison (never a plain `===`, which leaks
  timing information).

This is stateless — no database table, no server-side session list. Anyone
holding a validly-signed, unexpired cookie value is treated as logged in.

## Components

```
web/custom-worker.js                — MODIFIED: fetch handler gains the
                                       gate check (path match → cookie
                                       verify) before delegating to the
                                       Next.js handler. Redirects to
                                       /login for page requests, returns
                                       401 JSON for API requests.
web/lib/session.ts                  — NEW: createSessionCookie(),
                                       verifySessionCookie() — the
                                       sign/verify logic shared by
                                       custom-worker.js and the login route.
                                       Pure functions, unit-tested.
web/lib/session.test.ts             — NEW: Vitest tests for session.ts.
web/app/login/page.tsx              — NEW: the login page. Client
                                       Component (needs state for the
                                       password field and error message).
                                       Hebrew/RTL, styled consistently
                                       with the rest of the app.
web/app/api/login/route.ts          — NEW: POST endpoint. Validates the
                                       submitted password, sets the
                                       session cookie on success, returns
                                       an error on failure.
web/app/api/logout/route.ts         — NEW: POST endpoint. Clears the
                                       session cookie (Max-Age=0).
```

`custom-worker.js` currently reads `env.NEXT_PUBLIC_SUPABASE_URL` and
`env.SUPABASE_SERVICE_ROLE_KEY` directly for the cron job, outside the
Next.js request context. The new gate check needs `env.APP_PASSWORD` the
same way, for requests it intercepts *before* Next.js starts — but
`web/lib/session.ts`'s functions take the secret as a parameter (not reading
`process.env` internally), so the same pure functions work correctly whether
called from `custom-worker.js` (with `env.APP_PASSWORD`) or from
`web/app/api/login/route.ts` (with `process.env.APP_PASSWORD`, inlined at
Next.js build time the normal way).

## Data flow

**Logging in:**
1. Visitor requests a protected path with no valid session cookie →
   `custom-worker.js` redirects to `/login`.
2. `/login` renders the password form.
3. Submitting POSTs to `/api/login`. On a correct password, the response
   sets the session cookie and redirects to `/app`. On an incorrect
   password, the form shows "סיסמה שגויה" inline and the cookie is not set.

**Subsequent requests:**
1. `custom-worker.js` checks the request path against the protected list.
2. Not protected → delegate to the Next.js handler immediately, unchanged.
3. Protected → verify the session cookie.
   - Valid → delegate to the Next.js handler as normal.
   - Invalid/missing/expired → distinguish by path: if it starts with
     `/api/`, return `401 { "error": "Unauthorized" }` as JSON (so the
     dashboard's own `fetch` calls, e.g. for "View PDF" or saving an edit,
     get a normal error to handle instead of following a redirect to an
     HTML page); otherwise (the `/app` page itself), redirect to `/login`.

**Logging out:** a small logout control in the dashboard calls
`/api/logout`, which clears the cookie, then navigates to `/`.

## Error handling

- Wrong password: inline Hebrew error on the login form, no redirect, no
  cookie set.
- Expired/tampered/missing cookie: treated identically to "not logged in" —
  no distinct error message differentiates "expired" from "never logged
  in," since there's nothing a user could act on differently either way.
- Malformed `Authorization`/cookie data (e.g. a cookie value with no `.`
  separator): treated as invalid, same as above — `verifySessionCookie`
  never throws, it returns a boolean.

## Testing

- `web/lib/session.test.ts` (Vitest, matching this project's existing
  convention): valid cookie round-trips correctly; tampered signature is
  rejected; expired timestamp is rejected; malformed input (wrong number of
  `.`-separated parts, non-numeric expiry) is rejected without throwing.
- No automated test for `custom-worker.js` itself — this project has no
  existing test coverage for that file (it's a thin wrapper), consistent
  with its current state. Verified manually instead: after deploying,
  confirm `/app` redirects to `/login` when logged out, logging in with the
  correct/incorrect password behaves as designed, a valid session persists
  across a page reload, and `/`, `/api/documents`, `/api/documents/[id]`
  remain reachable exactly as before (unauthenticated for `/`,
  `X-API-Key`-gated as before for the other two).

## Out of scope

- **Cloudflare Rate Limiting Rule on `/api/login`** — a manual step in the
  Cloudflare dashboard, not app code. Document it in `README.md`'s deploy
  section alongside the existing secret-setup instructions.
- **Per-user accounts** — explicitly rejected; a single shared password
  fits this project.
- **The separate demo feature (issue #9)** — unrelated and independent;
  not touched by this design.
- **Changing or replacing the existing `X-API-Key` mechanism** — out of
  scope; it continues to work exactly as it does today.

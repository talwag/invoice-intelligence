# Password-Protected Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate `/app`, `/api/upload`, `/api/documents/[id]/pdf-url`, and `/api/documents/[id]/edit` behind a single shared password, while `/`, `/login`, `/api/login`, and the existing `X-API-Key`-gated `/api/documents` + `/api/documents/[id]` stay exactly as they are today.

**Architecture:** A stateless, HMAC-SHA256-signed session cookie. All sign/verify logic lives in one pure-function module (`web/lib/session.ts`) with no framework dependency, so the exact same functions run both inside `web/custom-worker.js` (the actual Cloudflare Worker entry point, checked *before* Next.js ever sees the request — chosen over Next.js middleware/proxy because of a confirmed, unresolved compatibility bug between Next.js 16's proxy architecture and `@opennextjs/cloudflare`) and inside two new Next.js API routes (`/api/login`, `/api/logout`).

**Tech Stack:** Next.js 16 App Router (Client Component for the login page, Route Handlers for login/logout), `node:crypto` (`createHmac`, `timingSafeEqual` — available via `wrangler.jsonc`'s existing `nodejs_compat` flag), Vitest (existing test runner, no new dependency).

**Spec:** [`docs/superpowers/specs/2026-08-18-password-login-design.md`](../specs/2026-08-18-password-login-design.md) — read it before starting; this plan implements it task-by-task but does not repeat its rationale.

## Global Constraints

- **One secret, `APP_PASSWORD`**, is both the login password and the HMAC signing key. No second secret.
- **Session cookie name:** `session`. **Max age:** 30 days (`2592000000` ms / `2592000` seconds).
- **Cookie attributes:** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
- **Every password/signature comparison is constant-time** (`node:crypto`'s `timingSafeEqual`) — never a plain `===` on secret material.
- **Protected paths (exact set, no more, no less):** `/app`, `/api/upload`, and any path matching `/^\/api\/documents\/[^/]+\/(pdf-url|edit)$/`.
- **Public, untouched paths:** `/`, `/login`, `/api/login`, `/api/logout`, `/api/documents`, `/api/documents/[id]` (the last two keep their current `X-API-Key` check — this plan does not modify `web/app/api/documents/route.ts` or `web/app/api/documents/[id]/route.ts`).
- **On an invalid/missing/expired session for a protected path:** paths starting with `/api/` get `401 { "error": "Unauthorized" }` as JSON; everything else (`/app`) gets a redirect to `/login`.
- **No new npm dependencies.**
- **All user-facing UI is Hebrew/RTL**, matching `web/app/layout.tsx`'s `lang="he" dir="rtl"` + Heebo font, and this project's established convention of Tailwind *logical* properties (`text-start`/`text-end`, `ms-`/`me-`) over physical ones (`text-left`/`text-right`, `ml-`/`mr-`).
- **Every interactive control gets a `title` attribute** (hover tooltip) and `cursor-pointer`, matching this project's existing convention on every other button/control.
- Follow this project's existing test style: `describe`/`it`/`expect` from Vitest, no mocking needed for pure functions (see `web/lib/invoiceMath.test.ts` for the exact style this plan's tests should match).

---

### Task 1: Session helper library

**Files:**
- Create: `web/lib/session.ts`
- Test: `web/lib/session.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `SESSION_COOKIE_NAME: string` (value: `"session"`)
  - `SESSION_MAX_AGE_MS: number` (value: `2592000000`)
  - `getCookieValue(cookieHeader: string | null, name: string): string | null`
  - `verifyPassword(submitted: string, secret: string): boolean`
  - `createSessionCookie(secret: string, now?: number, maxAgeMs?: number): string`
  - `verifySessionCookie(cookieValue: string | null | undefined, secret: string, now?: number): boolean`
  - `buildSessionCookieHeader(secret: string, now?: number): string`
  - `buildClearSessionCookieHeader(): string`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  SESSION_COOKIE_NAME,
  getCookieValue,
  verifyPassword,
  createSessionCookie,
  verifySessionCookie,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
} from "./session";

describe("getCookieValue", () => {
  it("extracts the named cookie among several", () => {
    expect(getCookieValue("a=1; session=abc123; b=2", "session")).toBe("abc123");
  });

  it("returns null when the cookie is missing", () => {
    expect(getCookieValue("a=1; b=2", "session")).toBeNull();
  });

  it("returns null when the header itself is null", () => {
    expect(getCookieValue(null, "session")).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", () => {
    expect(verifyPassword("correct-horse", "correct-horse")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(verifyPassword("wrong", "correct-horse")).toBe(false);
  });

  it("rejects an empty submitted password", () => {
    expect(verifyPassword("", "correct-horse")).toBe(false);
  });
});

describe("createSessionCookie / verifySessionCookie", () => {
  it("round-trips: a freshly created cookie verifies as valid", () => {
    const cookie = createSessionCookie("my-secret");
    expect(verifySessionCookie(cookie, "my-secret")).toBe(true);
  });

  it("rejects a cookie checked against the wrong secret", () => {
    const cookie = createSessionCookie("my-secret");
    expect(verifySessionCookie(cookie, "wrong-secret")).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const cookie = createSessionCookie("my-secret");
    const [expiry] = cookie.split(".");
    const tampered = `${expiry}.${"0".repeat(64)}`;
    expect(verifySessionCookie(tampered, "my-secret")).toBe(false);
  });

  it("rejects an expired cookie", () => {
    const alreadyExpired = createSessionCookie("my-secret", Date.now(), -1000);
    expect(verifySessionCookie(alreadyExpired, "my-secret")).toBe(false);
  });

  it("rejects a cookie with no separator", () => {
    expect(verifySessionCookie("not-a-valid-cookie", "my-secret")).toBe(false);
  });

  it("rejects a cookie with too many separators", () => {
    expect(verifySessionCookie("a.b.c", "my-secret")).toBe(false);
  });

  it("rejects a cookie with a non-numeric expiry", () => {
    expect(verifySessionCookie("not-a-number.abc123", "my-secret")).toBe(false);
  });

  it("rejects a missing cookie value", () => {
    expect(verifySessionCookie(null, "my-secret")).toBe(false);
    expect(verifySessionCookie(undefined, "my-secret")).toBe(false);
  });
});

describe("buildSessionCookieHeader", () => {
  it("produces a Set-Cookie header whose value verifies as valid", () => {
    const header = buildSessionCookieHeader("my-secret");
    const value = header.split(";")[0].split("=").slice(1).join("=");
    expect(verifySessionCookie(value, "my-secret")).toBe(true);
  });

  it("includes the security attributes", () => {
    const header = buildSessionCookieHeader("my-secret");
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
  });
});

describe("buildClearSessionCookieHeader", () => {
  it("clears the cookie via Max-Age=0", () => {
    const header = buildClearSessionCookieHeader();
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run lib/session.test.ts`
Expected: FAIL — `Cannot find module './session'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `web/lib/session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(message: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(message).digest();
}

function timingSafeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

export function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function verifyPassword(submitted: string, secret: string): boolean {
  const submittedHash = hmac(submitted, secret);
  const actualHash = hmac(secret, secret);
  return timingSafeEqual(submittedHash, actualHash);
}

export function createSessionCookie(
  secret: string,
  now: number = Date.now(),
  maxAgeMs: number = SESSION_MAX_AGE_MS
): string {
  const expiry = now + maxAgeMs;
  const signature = hmac(String(expiry), secret).toString("hex");
  return `${expiry}.${signature}`;
}

export function verifySessionCookie(
  cookieValue: string | null | undefined,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;

  const [expiryStr, signature] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry)) return false;
  if (expiry < now) return false;

  const expectedSignature = hmac(String(expiry), secret).toString("hex");
  return timingSafeEqualHex(expectedSignature, signature);
}

export function buildSessionCookieHeader(
  secret: string,
  now: number = Date.now()
): string {
  const value = createSessionCookie(secret, now);
  const maxAgeSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run lib/session.test.ts`
Expected: PASS, all 17 tests.

- [ ] **Step 5: Type-check and run the full suite**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass (existing 53 + this task's 17 = 70).

- [ ] **Step 6: Commit**

```bash
git add web/lib/session.ts web/lib/session.test.ts
git commit -m "feat: add session cookie helper library for password login"
```

---

### Task 2: Login API route

**Files:**
- Create: `web/app/api/login/route.ts`

**Interfaces:**
- Consumes: `verifyPassword`, `buildSessionCookieHeader` from `web/lib/session.ts` (Task 1)
- Produces: `POST /api/login` — request body `{ "password": string }`; on correct password, `200 { "ok": true }` with a `Set-Cookie` header; on incorrect password or missing `APP_PASSWORD` secret, `401 { "error": "סיסמה שגויה" }` with no cookie set. Later tasks (the login page, Task 4) rely on this exact contract.

- [ ] **Step 1: Write the implementation**

There's no separate unit test for this route — it's a thin wrapper around Task 1's already-tested pure functions, following this project's existing convention of not unit-testing its other one-line-of-logic API routes (e.g. `web/app/api/documents/[id]/pdf-url/route.ts`). It's verified manually in Task 7's end-to-end check.

Create `web/app/api/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyPassword, buildSessionCookieHeader } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password =
    typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).password === "string"
      ? (body as Record<string, string>).password
      : "";

  const secret = process.env.APP_PASSWORD;

  if (!secret || !verifyPassword(password, secret)) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildSessionCookieHeader(secret) } }
  );
}
```

- [ ] **Step 2: Add the secret for local testing**

Add a line to `web/.dev.vars` (already gitignored — confirm with `git check-ignore -q web/.dev.vars` before editing, it should print nothing and exit 0 meaning it's ignored):

```
APP_PASSWORD=local-test-password
```

- [ ] **Step 3: Manually verify against the local dev server**

Run: `cd web && npm run dev`, then in another terminal:

```bash
curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"password":"wrong"}'
```
Expected: `HTTP/1.1 401`, body `{"error":"סיסמה שגויה"}`, no `Set-Cookie` header.

```bash
curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"password":"local-test-password"}'
```
Expected: `HTTP/1.1 200`, body `{"ok":true}`, a `Set-Cookie: session=...; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` header present.

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/login/route.ts web/.dev.vars
git commit -m "feat: add POST /api/login route"
```

---

### Task 3: Logout API route

**Files:**
- Create: `web/app/api/logout/route.ts`

**Interfaces:**
- Consumes: `buildClearSessionCookieHeader` from `web/lib/session.ts` (Task 1)
- Produces: `POST /api/logout` — no request body needed; always `200 { "ok": true }` with a `Set-Cookie` header that clears the session. Task 6 (the dashboard's logout button) relies on this contract.

- [ ] **Step 1: Write the implementation**

Create `web/app/api/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { buildClearSessionCookieHeader } from "@/lib/session";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildClearSessionCookieHeader() } }
  );
}
```

- [ ] **Step 2: Manually verify against the local dev server**

Run: `cd web && npm run dev` (if not already running from Task 2), then:

```bash
curl -i -X POST http://localhost:3000/api/logout
```
Expected: `HTTP/1.1 200`, body `{"ok":true}`, a `Set-Cookie: session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` header present.

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/logout/route.ts
git commit -m "feat: add POST /api/logout route"
```

---

### Task 4: Login page

**Files:**
- Create: `web/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/login`'s contract from Task 2 (`{ password }` → `200 { ok: true }` + cookie, or `401 { error }`)
- Produces: route `/login`, a page with no params/props. Task 5 (the gate in `custom-worker.js`) relies on this route existing as the redirect target.

- [ ] **Step 1: Write the implementation**

Create `web/app/login/page.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "סיסמה שגויה");
      setSubmitting(false);
      return;
    }

    window.location.href = "/app";
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          התחברות
        </h1>

        <label className="mt-6 block text-sm text-zinc-600 dark:text-zinc-400">
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            title="הזן את הסיסמה כדי להיכנס לאפליקציה"
            className="mt-2 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          title="התחבר לאפליקציה"
          className="mt-6 w-full cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "מתחבר..." : "התחבר"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify against the local dev server**

Run: `cd web && npm run dev`, open `http://localhost:3000/login` in a browser.
Expected: a centered Hebrew/RTL login card with a password field and "התחבר" button. Submitting the wrong password (`local-test-password` is the correct one, set in Task 2) shows "סיסמה שגויה" inline without navigating away. Submitting the correct password navigates to `/app`.

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/login/page.tsx
git commit -m "feat: add login page"
```

---

### Task 5: Enforce the gate in the Worker

**Files:**
- Modify: `web/custom-worker.js`
- Modify: `web/app/api/documents/[id]/pdf-url/route.ts:6-9` (update the now-stale comment)
- Modify: `web/app/api/documents/[id]/edit/route.ts:43-45` (update the now-stale comment)

**Interfaces:**
- Consumes: `getCookieValue`, `verifySessionCookie` from `web/lib/session.ts` (Task 1); `/login` existing as a route (Task 4)
- Produces: the enforced protected-path list, now live in `custom-worker.js`'s `fetch` handler

- [ ] **Step 1: Update the stale "no auth wall" comments**

These two comments were written before this feature existed and are no longer true. In `web/app/api/documents/[id]/pdf-url/route.ts`, replace:

```ts
// Unauthenticated, unlike GET /api/documents/[id]: this route is called
// from the dashboard's own client-side "View PDF" button, not external
// callers, and the dashboard itself already has no auth wall — anyone who
// can load /app can already see every document's extracted data.
```

with:

```ts
// No X-API-Key check here, unlike GET /api/documents/[id]: this route is
// called from the dashboard's own client-side "View PDF" button, not
// external callers. It's still protected — web/custom-worker.js gates
// this exact path behind the session cookie before Next.js ever sees it.
```

In `web/app/api/documents/[id]/edit/route.ts`, replace:

```ts
// Unauthenticated, same reasoning as GET .../pdf-url: called from the
// dashboard's own "Edit" form, not external callers, and the dashboard
// already has no auth wall.
```

with:

```ts
// No X-API-Key check here, same reasoning as GET .../pdf-url: called from
// the dashboard's own "Edit" form, not external callers. Still protected —
// see web/custom-worker.js.
```

- [ ] **Step 2: Write the gate check in `custom-worker.js`**

Replace the full contents of `web/custom-worker.js` with:

```js
import handler from "./.open-next/worker.js";
import { getCookieValue, verifySessionCookie, SESSION_COOKIE_NAME } from "./lib/session.ts";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const PROTECTED_API_PATTERN = /^\/api\/documents\/[^/]+\/(pdf-url|edit)$/;

function isProtectedPath(pathname) {
  return (
    pathname === "/app" ||
    pathname === "/api/upload" ||
    PROTECTED_API_PATTERN.test(pathname)
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isProtectedPath(url.pathname)) {
      const cookieHeader = request.headers.get("Cookie");
      const sessionValue = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
      const isLoggedIn = verifySessionCookie(sessionValue, env.APP_PASSWORD, Date.now());

      if (!isLoggedIn) {
        if (url.pathname.startsWith("/api/")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.redirect(new URL("/login", request.url).toString(), 302);
      }
    }

    return handler.fetch(request, env, ctx);
  },

  // Cloudflare Cron Trigger (see wrangler.jsonc's "triggers.crons"). Pings
  // Supabase daily so the free-tier project's REST API never sits idle long
  // enough (7 days) to hit Supabase's auto-pause. Runs outside the Next.js
  // request context, so it reads env vars directly rather than through
  // web/lib/supabase.ts (which expects process.env, populated only during
  // fetch requests).
  async scheduled(controller, env, ctx) {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/documents?select=id&limit=1`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    console.log(`Supabase keep-alive ping: HTTP ${res.status}`);
  },
};
```

Note the import path: `./lib/session.ts`, not `./lib/session` and not `@/lib/session` — `custom-worker.js` is bundled directly by Wrangler's esbuild (not by Next.js's compiler), which has no path-alias config and needs the real relative path with its extension.

- [ ] **Step 3: Verify the Worker still bundles correctly**

`custom-worker.js` is bundled by Wrangler, not Next.js — this step confirms Wrangler's bundler can actually resolve and strip types from the new `.ts` import, without deploying anything.

Run: `cd web && opennextjs-cloudflare build && npx wrangler deploy --dry-run --outdir .wrangler-dryrun-tmp`
Expected: the build/bundle step completes with no error about resolving `./lib/session.ts` or about `node:crypto`. If it fails here, this is a **STOP and re-plan** signal — report the exact error rather than guessing a workaround.

Clean up the throwaway output afterward: `rm -rf web/.wrangler-dryrun-tmp` (not gitignored by name, and not meant to be committed).

- [ ] **Step 4: Manually verify the gate end-to-end with a real local preview**

`next dev` (used in Tasks 2-4) does **not** run `custom-worker.js` — only `wrangler`/OpenNext's preview does. This is the first task where the gate itself can actually be tested.

Run: `cd web && npm run cf:preview` (this builds via OpenNext and serves through Wrangler, using `web/.dev.vars` for secrets — confirm `APP_PASSWORD=local-test-password` is still there from Task 2).

With the preview server running, in a browser:
- Visit the preview URL's `/app` while not logged in → expect a redirect to `/login`.
- Log in with `local-test-password` at `/login` → expect landing on `/app`, dashboard visible.
- Visit `/` → expect the landing page, no login required.

With curl against the preview URL:
```bash
curl -s -o /dev/null -w "%{http_code}\n" <preview-url>/api/upload -X POST
```
Expected: `401` (no session cookie sent).

```bash
curl -s -o /dev/null -w "%{http_code}\n" <preview-url>/api/documents -H "X-API-Key: wrong"
```
Expected: `401` (unchanged existing behavior — this route isn't part of the new gate at all, it's still the old `X-API-Key` check).

- [ ] **Step 5: Type-check and run the full test suite**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests still pass (`custom-worker.js` itself has no unit tests, consistent with its current state).

- [ ] **Step 6: Commit**

```bash
git add web/custom-worker.js web/app/api/documents/\[id\]/pdf-url/route.ts web/app/api/documents/\[id\]/edit/route.ts
git commit -m "feat: enforce the session gate in custom-worker.js"
```

---

### Task 6: Logout control in the dashboard

**Files:**
- Modify: `web/app/app/DashboardClient.tsx:101-129` (the header row)

**Interfaces:**
- Consumes: `POST /api/logout`'s contract from Task 3

- [ ] **Step 1: Add the logout button**

In `web/app/app/DashboardClient.tsx`, the header currently is:

```tsx
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence
          </h1>

          <div>
            <input
```

Replace it with (wrapping the upload button and a new logout button in a shared flex container):

```tsx
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              title="התנתק מהאפליקציה"
              className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              התנתק
            </button>
            <input
```

(The rest of the file — the `<input>`, the upload `<button>`, and the closing tags — stays exactly as it is; only the opening of that `<div>` changes from `<div>` to `<div className="flex items-center gap-3">`, with the new logout button inserted right before the existing `<input>`.)

Add the `handleLogout` function next to the existing `handleFileSelected` function (same component, above the `return`):

```tsx
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }
```

- [ ] **Step 2: Manually verify against the local preview**

Using the same `npm run cf:preview` server from Task 5 (restart it if needed to pick up this change): log in, click "התנתק" in the dashboard header.
Expected: navigates to `/`. Visiting `/app` again afterward redirects back to `/login` (the session cookie was cleared).

- [ ] **Step 3: Type-check and run the full test suite**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/app/app/DashboardClient.tsx
git commit -m "feat: add logout control to the dashboard"
```

---

### Task 7: Documentation and final end-to-end verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: every file/route created or modified in Tasks 1-6

- [ ] **Step 1: Update `CLAUDE.md`'s Project Structure section**

Add these lines to the bulleted file list (alongside the existing `/web/app/api/...` entries), matching the existing style of one bullet per file with its responsibility:

```markdown
- `/web/lib/session.ts` — pure, unit-tested session-cookie helpers
  (`createSessionCookie`/`verifySessionCookie`/`verifyPassword`/etc.) used
  by both `web/custom-worker.js` and the login/logout API routes
- `/web/app/api/login/route.ts` — POST endpoint: checks the submitted
  password against the `APP_PASSWORD` secret, sets the signed session
  cookie on success
- `/web/app/api/logout/route.ts` — POST endpoint: clears the session
  cookie
- `/web/app/login/page.tsx` — the login page (Hebrew/RTL, matches the
  rest of the app)
```

Add a line near the existing Tech Stack / Deploy bullet about `custom-worker.js`, documenting the new gate behavior:

```markdown
- Auth: `web/custom-worker.js`'s `fetch` handler gates `/app`, `/api/upload`,
  and `/api/documents/[id]/{pdf-url,edit}` behind a single shared password
  (a signed session cookie — see `web/lib/session.ts`), enforced before
  Next.js ever sees the request. This runs in `custom-worker.js` rather
  than Next.js middleware/proxy because of a confirmed compatibility bug
  between Next.js 16's proxy architecture and `@opennextjs/cloudflare`
  ([cloudflare/workers-sdk#13755](https://github.com/cloudflare/workers-sdk/issues/13755)).
  `/`, `/login`, `/api/login`, `/api/logout`, and the existing
  `X-API-Key`-gated `/api/documents` + `/api/documents/[id]` are untouched
  by this gate.
```

- [ ] **Step 2: Update `README.md`'s deploy section**

Find the line documenting required Worker secrets (`API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) and add `APP_PASSWORD` to that list, e.g.:

```markdown
Requires `wrangler login` once, and the following secrets set on the Worker
(`wrangler secret put <NAME>`, not committed anywhere): `API_KEY`,
`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`APP_PASSWORD`.
```

Add a new paragraph after that section documenting the manual rate-limiting step:

```markdown
`/app`, `/api/upload`, and `/api/documents/[id]/{pdf-url,edit}` are gated
behind a shared password (set via the `APP_PASSWORD` secret above). To
blunt brute-force attempts against `/api/login`, add a
[Rate Limiting Rule](https://developers.cloudflare.com/waf/rate-limiting-rules/)
in the Cloudflare dashboard for this Worker's `/api/login` path — this is a
manual, one-time dashboard step, not something set up by this repo's code.
```

- [ ] **Step 3: Final manual end-to-end check on the real deployment target**

This repeats Task 5/6's local preview checks, but is the authoritative check because it's the same build/deploy path production actually uses. Do this after setting the real `APP_PASSWORD` secret with `npx wrangler secret put APP_PASSWORD` (a strong, non-guessable value — not the `local-test-password` used for local testing) and deploying with `npm run cf:deploy`.

After deploying:
- Confirm `/app` redirects to `/login` when not logged in.
- Confirm logging in with the wrong password shows the inline error and does not navigate.
- Confirm logging in with the correct password lands on `/app`.
- Confirm the session persists across a page reload (no re-login needed).
- Confirm "התנתק" logs out and visiting `/app` afterward redirects to `/login` again.
- Confirm `/` (landing page) is still reachable with no login.
- Confirm `/api/documents` and `/api/documents/[id]` still behave exactly as before (`401` with no/wrong `X-API-Key`, `200` with the correct one) — this gate must not have touched them.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document the password gate, new secret, and rate-limiting step"
```

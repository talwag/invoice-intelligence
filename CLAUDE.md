# Invoice Intelligence Service

## What This Does
Accepts invoice PDFs, extracts structured data using Google Gemini (gemini-2.5-flash),
stores results in Supabase, displays them in a Next.js dashboard, and exposes a REST
API for external callers.

## Tech Stack
- Frontend/API: Next.js 16 (App Router) + Tailwind CSS
- File Storage: Supabase Storage
- Database: Supabase (PostgreSQL). Schema is managed by hand in the Supabase
  dashboard's SQL Editor — there's no migrations folder in this repo. Current
  `documents` columns beyond the obvious: `r2_key` (Storage path — named for
  the original R2-based spec, never renamed after switching to Supabase
  Storage) and `edited_at` (nullable timestamp, set when a document is
  manually edited via the dashboard)
- AI Extraction: `web/lib/extractor.ts` (TypeScript, `@google/genai`) — this is what
  runs in production. `extractor.py` / `schemas.py` (Python + Pydantic) is a standalone
  reference implementation only; Cloudflare Workers can't run Python, so it's not part
  of the deployed app.
- Deploy: Cloudflare Workers, via the `@opennextjs/cloudflare` adapter (not Cloudflare
  Pages — the Next.js-on-Pages adapter is deprecated). The Worker's entry point is
  `web/custom-worker.js`, not the OpenNext-generated `.open-next/worker.js` directly —
  it wraps the generated `fetch` handler and adds a `scheduled` handler (see
  `web/wrangler.jsonc`'s `triggers.crons`) that pings Supabase daily to prevent the
  free-tier project from auto-pausing after 7 days of inactivity.
- Testing: Vitest (`web/lib/extractor.test.ts`) — Gemini calls are mocked via
  `vi.mock("@google/genai", ...)`, so tests run without real API calls, a key, or cost
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

## Project Structure
- `/extractor.py`, `/schemas.py` — standalone Python reference implementation, not deployed
- `/web/lib/extractor.ts` — the extraction logic that actually runs in production,
  including runtime validation of Gemini's JSON response (`validateInvoiceExtraction`)
- `/web/lib/supabase.ts` — shared Supabase client (service role key, server-only)
- `/web/app/api/upload/route.ts` — POST endpoint: receives PDF, stores it, runs
  extraction, saves the result to Supabase
- `/web/app/api/documents/route.ts` — GET endpoint: list all documents (requires
  `X-API-Key` header)
- `/web/app/api/documents/[id]/route.ts` — GET endpoint: single document by ID
  (requires `X-API-Key` header)
- `/web/app/api/documents/[id]/pdf-url/route.ts` — GET endpoint: returns a
  short-lived (5 min) Supabase Storage signed URL for the original PDF. No
  `X-API-Key` — called from the dashboard's own "View PDF" button, and the
  dashboard already has no auth wall
- `/web/app/api/documents/[id]/edit/route.ts` — PATCH endpoint: saves manual
  edits to vendor/business ID/invoice number/dates/line items/VAT rate.
  Recomputes line_total/subtotal/vat_amount/total server-side via
  `web/lib/invoiceMath.ts` (never trusts client-sent totals), re-validates
  the merged object with `extractor.ts`'s `validateInvoiceExtraction`, and
  sets `edited_at`. No `X-API-Key`, same reasoning as pdf-url
- `/web/app/page.tsx` — the marketing landing page (static, no data fetching);
  links to `/app` for the actual dashboard
- `/web/app/_components/landing/` — Hero, Benefits, HowItWorks,
  SampleExtraction, Footer — the landing page's section components
- `/web/app/app/page.tsx` — Server Component: fetches documents directly via
  Supabase, server-side, no API key involved (moved from `/web/app/page.tsx`
  to make room for the landing page above)
- `/web/app/app/DashboardClient.tsx` — owns tab/filter/sort state and the
  upload flow; composes `DocumentsTab`/`SummaryTab` and renders `DocumentPanel`
- `/web/app/app/DocumentPanel.tsx` — the row-click detail side panel: read-only
  view, an editable mode (top-level fields + line items, with live-recalculated
  totals), and the "View PDF" button
- `/web/app/app/DocumentsTab.tsx` — Documents tab UI: filters, sortable
  table, CSV export button
- `/web/app/app/SummaryTab.tsx` — Summary tab UI: cumulative total, monthly
  totals, company breakdown
- `/web/lib/dashboardAggregations.ts` — pure, unit-tested filtering/sorting/aggregation
  functions; source of truth for the totals and lists both tabs render
- `/web/lib/invoiceMath.ts` — pure, unit-tested `calculateInvoiceTotals`
  (line_total/subtotal/vat_amount/total from items + VAT rate); used for both
  the edit form's live preview and the edit endpoint's authoritative recompute
- `/web/lib/csvExport.ts` — builds the CSV string and triggers the client-side download
  for the "Export to CSV" button
- `/web/lib/testFixtures.ts` — shared `makeDoc()` test fixture used across the lib unit
  tests
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
- `/web/custom-worker.js` — the actual deployed Worker entry point (see
  `web/wrangler.jsonc`'s `"main"`); wraps `.open-next/worker.js`'s generated `fetch`
  handler and adds a `scheduled` handler for the daily Supabase keep-alive ping

## API Authentication
`/api/documents` and `/api/documents/[id]` require header: `X-API-Key: {API_KEY}`.

The dashboard itself (`page.tsx`) does **not** use this header — it fetches Supabase
directly as a Server Component, so the key never reaches the browser. The header is
for external callers (curl, a CRM integration, etc.) only.

## Dashboard Requirements
1. Upload button at top (file picker, PDF only), shows a spinner while processing
2. Two tabs: Documents and Summary
3. Documents tab:
   - Month filter, company filter (both derived from the actual data, not hardcoded)
   - Table columns: filename, date, company, status badge, confidence badge
     - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
   - Date and Company columns are sortable (click header, click again to reverse)
   - "Export to CSV" exports the currently filtered/sorted rows as a CSV file
     (client-side, no server round-trip, no new dependency)
4. Summary tab: cumulative total, monthly totals, and a company breakdown —
   always across all documents with extracted data (processing/failed documents are
   excluded from these totals but still appear in the Documents tab), independent
   of the Documents tab's filters (see docs/superpowers/specs/2026-08-04-admin-dashboard-design.md for why)
5. Click any row in the Documents table: side panel showing vendor, business ID,
   dates, line items, VAT breakdown, and total, with Hebrew labels
6. Warning banner in the side panel if confidence < 0.7
7. Filtering/sorting/aggregation logic lives in web/lib/dashboardAggregations.ts
   (pure functions, unit-tested) — DocumentsTab.tsx and SummaryTab.tsx render,
   they don't re-derive
8. "View PDF" button in the side panel opens the original uploaded file (a
   Supabase Storage signed URL) in a new tab
9. "Edit" button in the side panel makes vendor/business ID/invoice number/
   dates/line items/VAT rate editable; subtotal/VAT amount/total are always
   computed (never directly editable) via web/lib/invoiceMath.ts. Saved edits
   set `edited_at` on the document, shown as an "Edited" badge in the panel

## Conventions
- Gemini calls for the deployed app go through `web/lib/extractor.ts` only —
  `extractor.py` is a separate, unused-in-production reference implementation, not a
  shared dependency the web app calls into
- All database access via the Supabase JS client (`web/lib/supabase.ts`)
- Monetary values formatted with the ₪ symbol
- The entire UI (landing page + dashboard) is Hebrew and RTL: `web/app/layout.tsx`
  sets `lang="he"` `dir="rtl"` on `<html>` and uses the Heebo font (Geist has no
  Hebrew glyphs). Dates use `toLocaleDateString("he-IL")` / `formatMonthLabel`'s
  `he-IL` locale, not `en-US`. Tailwind classes use logical properties (`text-start`/
  `text-end`, `ms-`/`me-`) instead of physical ones (`text-left`/`text-right`, `ml-`/
  `mr-`) so the layout mirrors correctly under `dir="rtl"` without needing `rtl:`
  variants — keep using logical properties in any new UI. `README.md`, `CLAUDE.md`,
  code comments, and `extractor.ts`'s Gemini prompt stay in English (developer docs/
  logic, not rendered UI). The product name "Invoice Intelligence" itself stays
  untranslated (brand name).
- Extracted invoice *data* (e.g. vendor names) already tends to be Hebrew —
  `extractor.ts`'s prompt standardizes on Hebrew when an invoice shows both
  languages, see the extraction prompt for why. `ensure_ascii=False` in the Python
  reference implementation keeps that Hebrew data readable in its own output.
- `confidence < 0.7` triggers a warning banner in the UI
- Every interactive control in the dashboard (tabs, buttons, filters, sortable
  headers, table rows) has a native `title` attribute for a hover tooltip explaining
  what it does — keep this up when adding new controls
- Changes to `web/lib/extractor.ts` should come with matching test updates in
  `web/lib/extractor.test.ts` — that file mocks the Gemini call, so run `npm test`
  before deploying, not just `tsc`

## Known deviations from the original assignment spec
See [`README.md`](./README.md)'s "Known limitations" section for the full list
(Supabase Storage instead of R2, Gemini Developer API instead of Vertex AI,
Workers/OpenNext instead of Pages, no Provider Abstraction layer).

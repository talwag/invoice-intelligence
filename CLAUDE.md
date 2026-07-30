# Invoice Intelligence Service

## What This Does
Accepts invoice PDFs, extracts structured data using Google Gemini (gemini-2.5-flash),
stores results in Supabase, displays them in a Next.js dashboard, and exposes a REST
API for external callers.

## Tech Stack
- Frontend/API: Next.js 16 (App Router) + Tailwind CSS
- File Storage: Supabase Storage
- Database: Supabase (PostgreSQL)
- AI Extraction: `web/lib/extractor.ts` (TypeScript, `@google/genai`) — this is what
  runs in production. `extractor.py` / `schemas.py` (Python + Pydantic) is a standalone
  reference implementation only; Cloudflare Workers can't run Python, so it's not part
  of the deployed app.
- Deploy: Cloudflare Workers, via the `@opennextjs/cloudflare` adapter (not Cloudflare
  Pages — the Next.js-on-Pages adapter is deprecated)
- Testing: Vitest (`web/lib/extractor.test.ts`) — Gemini calls are mocked via
  `vi.mock("@google/genai", ...)`, so tests run without real API calls, a key, or cost

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
- `/web/app/page.tsx` — Server Component: fetches documents directly via Supabase,
  server-side, no API key involved
- `/web/app/DashboardClient.tsx` — the interactive dashboard UI (upload button, table,
  detail panel)

## API Authentication
`/api/documents` and `/api/documents/[id]` require header: `X-API-Key: {API_KEY}`.

The dashboard itself (`page.tsx`) does **not** use this header — it fetches Supabase
directly as a Server Component, so the key never reaches the browser. The header is
for external callers (curl, a CRM integration, etc.) only.

## Dashboard Requirements
1. Upload button at top (file picker, PDF only), shows a spinner while processing
2. Documents table columns: filename, date, status badge, confidence badge
   - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
3. Click any row: side panel showing vendor, business ID, dates, line items, VAT
   breakdown, and total, with Hebrew labels
4. Warning banner in the side panel if confidence < 0.7

## Conventions
- Gemini calls for the deployed app go through `web/lib/extractor.ts` only —
  `extractor.py` is a separate, unused-in-production reference implementation, not a
  shared dependency the web app calls into
- All database access via the Supabase JS client (`web/lib/supabase.ts`)
- Monetary values formatted with the ₪ symbol
- Hebrew text supported throughout (UI labels; `ensure_ascii=False` in the Python
  reference implementation)
- `confidence < 0.7` triggers a warning banner in the UI
- Changes to `web/lib/extractor.ts` should come with matching test updates in
  `web/lib/extractor.test.ts` — that file mocks the Gemini call, so run `npm test`
  before deploying, not just `tsc`

## Known deviations from the original assignment spec
See [`README.md`](./README.md)'s "Known limitations" section for the full list
(Supabase Storage instead of R2, Gemini Developer API instead of Vertex AI,
Workers/OpenNext instead of Pages, no Provider Abstraction layer).

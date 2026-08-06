# Invoice Intelligence

Upload an invoice PDF, get back structured JSON (vendor, line items, VAT, totals, a
confidence score) in seconds — via a small Next.js dashboard and a REST API.

## What it does

`/` is a static marketing landing page; the dashboard itself lives at `/app`.

1. You drop a PDF invoice into the dashboard at `/app` (or `POST` it to `/api/upload`).
2. The file is stored, a `documents` row is created with `status: "processing"`.
3. Gemini 2.5 Flash extracts the invoice fields as JSON.
4. The row is updated to `status: "done"` (or `"failed"`) with the extracted data.
5. The dashboard shows the result: vendor, business ID, dates, line items, VAT
   breakdown, and a color-coded confidence badge (green ≥ 0.8, yellow ≥ 0.6, red
   below that — with a warning banner in the detail panel below 0.7).

## Architecture

```
Browser (/ landing page, /app dashboard)
   │  Server Component fetch — no auth needed, runs server-side only
   ▼
Next.js App Router  ──────────────────────────►  external caller (curl, a CRM, …)
   │   deployed as a Cloudflare Worker via OpenNext        │  X-API-Key header
   │                                                        ▼
   ├── POST /api/upload ───► Gemini 2.5 Flash (Developer API, structured JSON output)
   │                              │
   ▼                              ▼
Supabase Storage (file)    Supabase Postgres (`documents` table)
                                   ▲
                     GET /api/documents, /api/documents/[id]
```

## Tech stack

| Layer | What's used |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind v4 |
| Hosting | Cloudflare Workers, via the `@opennextjs/cloudflare` adapter |
| File storage | Supabase Storage |
| Database | Supabase (Postgres) — `documents` table |
| Extraction | Gemini 2.5 Flash, Developer API (`@google/genai` in TS; a standalone Python port also exists, see below) |
| Auth | A private `API_KEY` env var, checked via the `X-API-Key` header on the REST read endpoints |

## REST API

Both read endpoints require `X-API-Key: <API_KEY>`. The dashboard itself doesn't
use this — it fetches Supabase directly from a Server Component, so the key never
reaches the browser. This header is for external callers.

```bash
curl -H "X-API-Key: $API_KEY" <your-deployment-url>/api/documents
curl -H "X-API-Key: $API_KEY" <your-deployment-url>/api/documents/<id>
```

`POST /api/upload` takes a `multipart/form-data` body with a `file` field (PDF
only, ≤ 20 MB) and currently has no auth check — it's meant to be called from the
dashboard's own upload button.

## Local setup

**Web app** (`web/`):

```bash
cd web
npm install
```

Create `web/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
GEMINI_API_KEY=<Gemini Developer API key, from aistudio.google.com>
API_KEY=<any random string — this app's own REST auth secret>
```

To run this project yourself, you'll need your own Supabase project and Gemini
API key:

- **Supabase** — create a free project at [supabase.com](https://supabase.com).
  - `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both on the
    project's **Settings → API** page (the service role key, not the
    anon/public key — this app uses it server-side only, so it never reaches
    the browser).
  - Create a `documents` table (columns: `id`, `filename`, `status`,
    `confidence`, `extracted_data`, `created_at`, plus whatever your schema
    needs) and a Storage bucket for the uploaded PDFs — this app reads/writes
    both.
- **Gemini** — create a free API key at
  [aistudio.google.com](https://aistudio.google.com/app/apikey) and use it for
  `GEMINI_API_KEY`. The Developer API's free tier is enough for local testing.
- **API_KEY** — any random string you pick yourself; it's just the shared
  secret this app checks on its own `/api/documents` routes, unrelated to
  either provider.

```bash
npm run dev        # http://localhost:3000 (or next free port)
                    # / is the marketing landing page; the dashboard is at /app
```

**Tests** (`web/lib/extractor.test.ts`, using Vitest — Gemini calls are mocked,
so this runs fast with no API key, network access, or cost):

```bash
npm test
```

**Standalone Python extractor** (project root — a reference implementation, see
note below):

```bash
pip install -r requirements.txt
```

Create a root `.env` with `GEMINI_API_KEY=<same as above>`, then:

```bash
python test_connection.py   # sanity check against the Gemini API
python test_extract.py      # run extraction against a sample PDF
```

## Deploy

```bash
cd web
npm run cf:deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Requires `wrangler login` once, and the following secrets set on the Worker
(`wrangler secret put <NAME>`, not committed anywhere): `API_KEY`,
`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Cost

~$5.55/month at 100 documents/day on Gemini 2.5 Flash standard pricing —
Cloudflare Workers and Supabase both stay within their free tiers at that
volume. Full breakdown in [`COST.md`](./COST.md).

## Known limitations / deviations from the original spec

- **File storage is Supabase Storage, not Cloudflare R2.** Enabling R2 requires
  linking a payment method to the Cloudflare account, even to stay within the
  free tier; Supabase Storage needed no extra credentials since the Supabase
  client was already configured for the database.
- **Extraction uses the Gemini Developer API, not Vertex AI.** Vertex AI
  requires a GCP project with a billing account (and Application Default
  Credentials) instead of a simple API key; the Developer API needs neither.
- **Deployed to Cloudflare Workers via OpenNext, not Cloudflare Pages.**
  Cloudflare's Next.js-on-Pages adapter (`next-on-pages`) is deprecated; the
  OpenNext Cloudflare adapter is the currently recommended path and supports
  the full Next.js feature set (SSR, ISR, middleware, `<Image>`).
- **`extractor.py` / `schemas.py` are a reference implementation, not what runs
  in production.** Cloudflare Workers can't run Python, so the deployed
  extraction path is `web/lib/extractor.ts`. It has its own hand-written
  runtime validation (`validateInvoiceExtraction`) mirroring what `schemas.py`'s
  Pydantic model checks, rather than sharing the same schema definition — the
  two are kept in sync by hand, not by a single shared source of truth.
- **No Provider Abstraction layer.** Both `extractor.py` and `extractor.ts` call
  the Gemini SDK directly, with the model name hardcoded. Swapping AI providers
  would mean editing code in both places, not changing a single env var.

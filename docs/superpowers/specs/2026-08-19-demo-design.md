# Public demo — design

GitHub issue: [#9 — Add a live demo that doesn't use the real Gemini key or expose the real app URL](https://github.com/talwag/invoice-intelligence/issues/9)

## Overview

The landing page currently links straight to `/app` — the real, password-gated
dashboard (issue #10). That's fine for the owner, but it gives a prospective
client or recruiter nothing to look at without a password, and it makes the
landing page's "Open the App" link a direct pointer at the real production
Worker. This design adds a public, interactive demo of the dashboard that
uses no real Gemini or Supabase calls at all (so it can't cost money or be
abused), replaces the landing page's CTA, and is hosted so that finding the
demo's URL gives no way to derive or guess the real app's URL.

## Decisions

- **Interaction model: pick a preset sample, not a real file upload.** A
  visitor selects from 3 bundled sample invoices rather than uploading
  their own file. Rejected: accepting a real upload — the result would have
  to be a generic canned response regardless of what was actually uploaded
  (since nothing is really parsed), which risks feeling dishonest, and
  buys nothing over presets.
- **Scope: the full dashboard**, not just the upload → single-result moment.
  Documents tab (table, filters, sort, CSV export) and Summary tab
  (cumulative/monthly totals, company breakdown) are both real, already-built
  features worth showcasing — restricting the demo to a narrower slice would
  undersell the product for no real savings in effort, since the components
  needed either way largely already exist.
- **No changes to the real dashboard's components.** `DashboardClient.tsx`
  and `DocumentPanel.tsx` (the two components with real `fetch` calls baked
  into their handlers) are not modified or made "mode-aware" — new,
  demo-only components are built instead. Rejected: refactoring them to
  accept injectable data-fetching behavior via props — that's real,
  ongoing risk to already-shipped, working production code for a feature
  that only needs to exist once. `DocumentsTab.tsx` and `SummaryTab.tsx`,
  by contrast, have zero real-backend coupling already (they're pure
  `documents[] → render` components driven by `web/lib/dashboardAggregations.ts`'s
  pure functions) — these are reused completely as-is, no new demo version
  needed.
- **Hosting: a second Cloudflare Worker deployment, under a separate
  Cloudflare account**, not the same account as production. Cloudflare's
  free `*.workers.dev` URLs are `<worker-name>.<account-subdomain>.workers.dev`
  — the account-subdomain segment is shared across every Worker in one
  account. A same-account second Worker would leak that segment into the
  public repo (the demo's link has to be public, e.g. in the landing page
  source), letting anyone who reads it guess or brute-force sibling Worker
  names on that same subdomain to find the real app. A separate account
  has a structurally unrelated subdomain, closing that gap entirely, at
  the cost of a second (free) account to manage and switch into when
  deploying the demo specifically. Considered and rejected: Cloudflare
  Pages under the same account (its `<project>.pages.dev` URLs have no
  shared account segment, so this would also close the gap) — rejected
  because it would require the demo to become a genuinely separate
  Next.js project (a fully static export can't coexist in one build with
  the real app's server-rendered pages/API routes), which is a permanent
  ongoing maintenance cost (keeping two codebases visually in sync)
  versus a second account's one-time, occasional setup/login cost.
- **The real Worker keeps serving the landing page.** Only the CTA
  changes (see below). Considered and rejected: moving the landing page
  itself onto the demo deployment too, so the real Worker serves nothing
  public except `/login` — rejected as disproportionate complexity (either
  two separate codebases, or a new "which deployment am I" conditional
  in the shared gate logic in `custom-worker.js`) for a marginal security
  gain, since the sensitive routes are already behind the password gate
  regardless of what `/` shows.
- **No link to `/login` anywhere in the landing page or the demo.** The
  real system is reached only by someone who already has that URL
  directly (bookmarked or shared privately) — never by browsing from the
  public-facing side.
- **The demo needs no `APP_PASSWORD`, Supabase, or Gemini secrets at
  all.** Its Worker deployment simply never sets them. `/demo` and its
  components never import `web/lib/supabase.ts` or `web/lib/extractor.ts`,
  so their absence is never a problem. A side effect: `/login` and `/app`
  are technically present in the same codebase and thus reachable on the
  demo Worker's URL too, but with `APP_PASSWORD` unset, the gate's
  existing missing-secret guard (from issue #10's final review) makes
  them permanently fail closed there — a safe default, not something this
  design needs to add logic for.

## Demo content

4 hardcoded sample `Document` records (matching
`web/lib/dashboardAggregations.ts`'s `Document`/`ExtractedData` shape
exactly, so `DocumentsTab`/`SummaryTab`/`calculateInvoiceTotals` all consume
them identically to real data), realistic Hebrew invoices, `status: "done"`,
varied confidence scores (including at least one below 0.7, to show the
warning-banner feature) and varied vendors/months (to make the Summary
tab's aggregates and the Documents tab's filters non-trivial).

Additionally, 3 real sample PDF files bundled as static assets (e.g.
`web/public/demo-samples/*.pdf`), one per "pick a sample to add" option.

## Data flow

**Initial load:** `/demo` renders with the hardcoded sample documents
already present — a visitor sees a populated dashboard immediately, no
empty state.

**"Add a sample" flow:** clicking the demo's upload-equivalent button opens
a picker of the 3 preset samples (shown by filename/vendor, not a real
file browser). Picking one shows a brief simulated "processing" delay
(a fixed `setTimeout`, matching the real spinner's visual language), then
appends a new pre-baked `Document` to local React state — no network
request anywhere in this flow.

**Row click → detail panel:** identical to the real app's UX (uses the
existing `DocumentPanel`-equivalent), showing vendor/dates/line
items/VAT/total, with the confidence warning banner below 0.7.

**"View PDF":** opens the sample document's associated static PDF path
directly (`window.open`), no signed-URL fetch.

**"Edit":** same editable-fields UX as the real panel, using the same
`calculateInvoiceTotals` pure function for live-recalculated totals on
save — but "save" just updates the in-memory document in local state
(setting a mock `edited_at`) instead of a `PATCH` request.

**No logout control** — the demo has no authentication concept at all.

## Components

```
web/app/demo/page.tsx                — NEW: the demo's entry page. Renders
                                        DemoDashboardClient with the
                                        hardcoded sample documents baked
                                        in at build time (no server-side
                                        fetch — this can be a plain
                                        Server Component that just passes
                                        static data as a prop, or the
                                        data can live directly in
                                        DemoDashboardClient; whichever
                                        keeps the file structure clearest
                                        is fine, decided at plan time).
web/lib/demoData.ts                  — NEW: the hardcoded sample
                                        Document[] array and the list of
                                        preset "add a sample" options
                                        (each pointing at one of the
                                        bundled PDF paths).
web/app/demo/DemoDashboardClient.tsx — NEW: analogous to
                                        DashboardClient.tsx (owns
                                        tab/filter/sort state, renders
                                        DocumentsTab/SummaryTab/
                                        DemoDocumentPanel), but the
                                        "upload" button opens the preset
                                        picker instead of a file input,
                                        and there's no logout control.
web/app/demo/DemoDocumentPanel.tsx   — NEW: analogous to
                                        DocumentPanel.tsx, same read/edit
                                        UI, but "View PDF" opens the
                                        static sample PDF directly and
                                        "Save" updates local state
                                        instead of calling
                                        PATCH /api/documents/[id]/edit.
web/app/app/DocumentsTab.tsx          — UNCHANGED, reused as-is (no real
                                        backend coupling already).
web/app/app/SummaryTab.tsx            — UNCHANGED, reused as-is (same
                                        reason).
web/public/demo-samples/*.pdf         — NEW: 3 real sample invoice PDFs.
web/app/_components/landing/Footer.tsx — MODIFIED: CTA changes from
                                        "Open the App" (→ /app) to "Try
                                        the Demo" (→ the demo Worker's
                                        full URL, e.g.
                                        https://<demo-worker>.<demo-account-subdomain>.workers.dev/demo).
web/wrangler.demo.jsonc               — NEW: a copy of web/wrangler.jsonc
                                        with two changes: a different
                                        `name`, and `triggers.crons`
                                        removed entirely (no cron job —
                                        there's nothing for it to keep
                                        alive on this deployment). Every
                                        other field carries over unchanged,
                                        including `main`, `assets`
                                        (needed regardless, to serve the
                                        app's own CSS/JS/fonts), and
                                        `ratelimits` (kept for parity, so
                                        a direct, unlinked hit to
                                        `/api/login` on the demo Worker
                                        gets a clean 429 path instead of
                                        a 500 from a missing binding —
                                        low-priority, but free to include).
                                        Unlike the real config, no
                                        Supabase/Gemini/APP_PASSWORD
                                        secrets are ever set for this
                                        deployment.
package.json                          — MODIFIED: a new `cf:deploy:demo`
                                        script (build once, then
                                        `wrangler deploy --config
                                        wrangler.demo.jsonc`).
```

## Error handling

There is no error handling to speak of beyond what the reused components
already have (`DocumentsTab`/`SummaryTab` have none, being pure renderers).
`DemoDashboardClient`/`DemoDocumentPanel`'s "network calls" are all
synchronous local-state updates or a fixed `setTimeout` — nothing that can
fail in a way worth surfacing to the user.

## Testing

- `web/lib/demoData.ts` is static data, not logic — no unit test needed,
  matching this project's convention of not testing plain data modules.
- No automated tests for the demo's UI components, matching this
  project's existing convention for the landing page and dashboard shells
  (logic lives in and is tested via `web/lib/*.ts`; UI is verified
  manually). Manual verification: `/demo` loads with sample documents
  visible, filtering/sorting/CSV export all work (proving `DocumentsTab`
  reuse is intact), the Summary tab's aggregates are non-trivial, clicking
  a row opens the detail panel with the confidence warning banner
  correctly appearing below 0.7, "add a sample" simulates processing and
  adds a new row, "View PDF" opens a real static sample file, editing and
  saving updates the row's totals and sets a demo "edited" indicator.

## Deployment

1. Create a new, separate Cloudflare account (the user's own action —
   outside what this plan implements in code).
2. `wrangler login` (or a scoped API token) authenticated as that new
   account when deploying the demo specifically.
3. `npm run cf:deploy:demo` from `web/` — builds once via
   `opennextjs-cloudflare build`, then deploys using
   `wrangler.demo.jsonc`'s config to the new account, producing a
   `*.workers.dev` URL structurally unrelated to the real production
   Worker's.
4. Update `Footer.tsx`'s CTA with that real URL once known.

## Out of scope

- **Moving the landing page itself off the real Worker** — considered
  and rejected above; out of scope for this design.
- **A custom domain** for the demo — would also solve the URL-relation
  problem, but costs real money (domain registration) for no benefit
  over the chosen free-account approach; not pursued.
- **Real file upload in the demo** — considered and rejected above;
  presets only.
- **Persisting demo edits/added samples across a page reload** — every
  demo session starts fresh from the hardcoded dataset; no
  `localStorage` or any other persistence layer is needed or planned.
- **Issue #7's static demo content** (screenshots/examples for the
  README) — unrelated, separate issue, not touched by this design.

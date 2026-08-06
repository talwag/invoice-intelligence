# Landing page — design

GitHub issue: [#3 — בניית דף נחיתה (Landing Page)](https://github.com/talwag/invoice-intelligence/issues/3)

## Overview

Add a marketing landing page as the new root (`/`), moving the existing
dashboard to `/app`. Purpose: a portfolio piece — something that reads as a
real product to a recruiter or freelance client, not a class exercise. Built
after the admin dashboard improvements (issue #6) shipped, so the copy
reflects what's actually built (filtering, CSV export, monthly/cumulative
totals, company breakdown), not an earlier, thinner feature set.

## Decisions

- **Routing:** the dashboard (`web/app/page.tsx`, `DashboardClient.tsx`,
  `DocumentsTab.tsx`, `SummaryTab.tsx`) moves into a new `web/app/app/`
  folder, becoming route `/app`. A new `web/app/page.tsx` becomes the
  landing page, at `/`. Rationale: this is the standard SaaS pattern
  (marketing page → "Open the App" → the actual product) and matches the
  issue's own phrasing ("a clear button linking to *the actual
  application*," implying they're separate destinations). API routes
  (`web/app/api/...`) don't move.
- **Language:** English — matches the app's title/meta and a
  broader/international portfolio audience, over Hebrew (which would match
  the meeting-note context but narrow the audience).
- **Visual direction:** a bolder, distinct marketing treatment — a real
  hero section, more visual personality — rather than reusing the
  dashboard's plain minimal zinc/gray look. Rationale: this page's job is to
  "sell" the product for a portfolio; a marketing homepage should feel
  different from an admin panel.
- **Audience/positioning:** generic "any business" drowning in paper
  invoices — not narrowed to bookkeepers or accountants specifically, since
  there's no real target customer to write for; the goal is a compelling
  general pitch.
- **Sample extraction visual:** an illustrative mockup (stylized
  document → arrow → extracted-data card, placeholder data), not a real
  screenshot. Simpler to build, no dependency on live data looking
  camera-ready for a portfolio audience.
- **Accent color:** blue.
- **Implementation approach:** hand-coded Tailwind CSS, no new
  dependencies — consistent with how the rest of this app is built (rejected:
  a UI kit/template, which would add a dependency and read as generic for a
  portfolio piece meant to show off original work; rejected: MDX/CMS-driven
  content, overkill for one static page).

## Page structure

Single long-scroll page, top to bottom:

1. **Hero** — headline, one-line subheadline, primary CTA (`Open the App`,
   linking to `/app`)
2. **Benefits** — 4 cards:
   - **Instant extraction** — AI reads your invoice and extracts every field
     in seconds, not minutes.
   - **No manual entry** — Stop typing invoice data by hand. Upload a PDF
     and you're done.
   - **Export anytime** — Filter by month or company, then export to CSV in
     one click — ready for your spreadsheet or accounting software.
     (Updated from the original "Structured, exportable data" draft to
     name the real CSV-export/filter feature that shipped in issue #6.)
   - **Confidence scoring built in** — Every extraction includes a
     confidence score, so you always know what's worth double-checking.
3. **How it works** — 3 steps:
   - **Upload** — Drop in any invoice PDF.
   - **Extract** — AI reads the document and pulls out vendor, items, VAT,
     and totals.
   - **Review** — See the structured result instantly, track monthly and
     cumulative totals, and export whenever you need to. (Updated to
     mention totals/export, reflecting the Summary tab that shipped in
     issue #6.)
4. **Sample extraction** — the illustrative mockup: document icon → arrow →
   card showing placeholder fields (vendor, invoice #, total, confidence
   badge)
5. **Final CTA** — the same call-to-action repeated near the bottom
6. **Footer** — minimal; no GitHub link for now (omit it entirely — the repo
   is still private, see Out of Scope). Add one when issue #4 ships.

## Architecture

```
web/app/page.tsx                        — NEW: the landing page (Server
                                           Component, fully static, no
                                           "use client" needed anywhere)
web/app/_components/landing/
  Hero.tsx
  Benefits.tsx
  HowItWorks.tsx
  SampleExtraction.tsx                  — the mockup panel
  Footer.tsx
web/app/app/page.tsx                    — MOVED from web/app/page.tsx
                                           (the existing dashboard Server
                                           Component, unchanged in behavior)
web/app/app/DashboardClient.tsx         — MOVED from web/app/DashboardClient.tsx
web/app/app/DocumentsTab.tsx            — MOVED from web/app/DocumentsTab.tsx
web/app/app/SummaryTab.tsx              — MOVED from web/app/SummaryTab.tsx
```

The `_components` folder name is prefixed with `_`, a Next.js convention
excluding it from routing — marking it clearly as shared UI, not a page.
Each landing section component takes no props (all static content) except
where a CTA needs the `/app` link target, which is just a hardcoded string,
not worth threading through as a prop.

`web/lib/dashboardAggregations.ts`, `web/lib/csvExport.ts`,
`web/lib/extractor.ts`, `web/lib/supabase.ts`, and all `web/app/api/`
routes are untouched — this is a pure UI/routing change, no data-layer
changes.

## Testing

No automated tests for this page — consistent with this project's existing
scope (logic is unit-tested via Vitest; static UI is verified by running
the dev server and looking at it), and this page has no logic to unit-test
(no state, no data fetching, no conditionals beyond static JSX). Verify
manually: `/` renders the landing page, `/app` renders the dashboard
exactly as before (upload, tabs, filters, export all still work — this is
a routing change around code that already has its own test coverage, not
a rewrite of that code), and the CTA buttons link correctly.

## Out of scope

- Real screenshots (explicitly rejected in favor of an illustrative mockup).
- GitHub link in the footer — placeholder until issue #4 (public repo) is
  done; linking to a private repo would 404 for anyone else.
- Any change to `/app`'s actual dashboard behavior — this is a pure move,
  not a rewrite.

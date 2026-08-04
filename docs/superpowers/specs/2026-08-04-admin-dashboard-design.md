# Admin dashboard improvements — design

GitHub issue: [#6 — Improve the admin dashboard](https://github.com/talwag/invoice-intelligence/issues/6)

## Overview

Add sorting/filtering, monthly totals, a company breakdown, and CSV export to
the existing dashboard. Today `DashboardClient.tsx` renders a single
unfiltered table of all documents with no aggregation and no export.

## Prerequisite (already implemented, separately)

Grouping documents "by company" requires a stable `vendor` string per
company. `extractor.ts`'s prompt was updated to standardize on the Hebrew
name when an invoice shows both a Hebrew and English name — otherwise the
same real company could extract under two different names on different runs
(observed directly: the same invoice extracted as "Kyndryl Israel Ltd." once
and "קינדריל ישראל בע\"מ" another time). This was fixed and tested
separately from this feature (commit `a676294`), before this design.

## Decisions

- **Filtering/sorting/aggregation: client-side.** The dashboard already
  fetches all documents up front (~25 today, no pagination). No new Supabase
  queries per filter change.
- **Layout: tabs, not one long page.** "Documents" (filters + table + export)
  and "Summary" (monthly totals + cumulative + company breakdown), as
  distinct views rather than everything stacked on one page.
- **Date filter: by month**, not an arbitrary date range — a dropdown of
  months that actually have data. Matches the requirement's own framing
  ("monthly totals").
- **Company filter: a dropdown** of distinct `vendor` values present in the
  data (not free-text search).
- **Sort: click column headers**, toggling ascending/descending, on the
  Documents table — scoped to the **Date** and **Company** columns
  specifically (matching the issue's literal ask), not every column.
- **Export: CSV only**, generated client-side with no new dependency (a
  Blob + a temporary `<a download>` link). Not a real `.xlsx` file — CSV
  opens directly in Excel, which satisfies "export to Excel or CSV" without
  adding a library.
- **Export scope: respects the Documents tab's active filters** — exports
  whatever's currently filtered/sorted, not unconditionally everything.
- **Summary tab is independent of the Documents tab's filters** — it always
  shows the full picture across all months/companies. Rationale: "monthly
  totals" and "cumulative total" only mean something as a full picture; if
  Summary respected the Documents tab's month filter, "cumulative" would
  just equal that one month's total.
- **Documents without extracted data (`processing`/`failed`) are excluded
  from Summary's totals and company breakdown** (no `vendor`/`total` to
  aggregate), but still appear normally in the Documents tab table, exactly
  as they do today.

## Architecture

```
web/app/DashboardClient.tsx        — owns tab state + filter state,
                                      computes the filtered/sorted list,
                                      renders the upload button, tab bar,
                                      and whichever tab is active. Keeps
                                      the existing upload flow and the
                                      DocumentPanel side-panel as-is.
web/app/DocumentsTab.tsx  (new)    — toolbar (month dropdown, company
                                      dropdown, sortable column headers),
                                      the table, the export button
web/app/SummaryTab.tsx    (new)    — monthly totals, cumulative total,
                                      company breakdown
web/lib/dashboardAggregations.ts (new) — pure functions: filter documents
                                      by month/company, sort by column,
                                      compute monthly totals, compute
                                      cumulative total, compute company
                                      breakdown. No React, no DOM — plain
                                      data in, data out, so these are
                                      directly unit-testable.
web/lib/csvExport.ts      (new)    — pure function: documents in, CSV
                                      string out (handles comma/quote
                                      escaping in vendor names etc.)
```

`DashboardClient.tsx` passes derived data down as props; `DocumentsTab` and
`SummaryTab` receive already-computed data and setters, not raw documents —
they don't each re-derive their own filtered views.

## Data flow

1. `initialDocuments` arrives as a prop from the Server Component in
   `page.tsx` (unchanged — no changes to data fetching).
2. Month options = distinct `YYYY-MM` values derived from `created_at`
   across *all* documents.
3. Company options = distinct `extracted_data.vendor` values across *all*
   documents with `status === "done"`.
4. Documents tab: `initialDocuments` → filtered by selected month/company →
   sorted by selected column/direction → rendered in the table.
5. Summary tab: `initialDocuments` filtered to `status === "done"` only →
   grouped by month (sum of `extracted_data.total`) → grouped by vendor →
   cumulative sum across all of them.
6. Export: takes the Documents tab's current filtered+sorted array, converts
   to CSV via `csvExport.ts`, triggers a browser download.

## Testing

- `web/lib/dashboardAggregations.test.ts` (new) — unit tests for each pure
  function: month filtering, company filtering, sorting (both directions),
  monthly totals, cumulative total, company breakdown, and the exclusion of
  non-`done` documents from aggregates.
- `web/lib/csvExport.test.ts` (new) — unit tests for correct headers,
  correct row content, and correct escaping of commas/quotes/Hebrew text in
  vendor names.
- No React component rendering tests — consistent with this project's
  existing testing scope (logic is unit-tested; UI is verified by running
  the dev server), no testing-library/jsdom setup exists or is being added
  for this.

## Out of scope

- Pagination (dataset is small; not needed yet).
- Real `.xlsx` export.
- Fuzzy/manual company-name matching — the prompt fix handles the
  consistency problem at the source instead.
- Landing page (issue #3) — paused until this ships, since its copy/mockup
  depend on the final feature set here.

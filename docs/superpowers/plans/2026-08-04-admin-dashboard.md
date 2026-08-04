# Admin Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add month/company filtering, Date/Company sorting, monthly totals + cumulative total + company breakdown, and CSV export to the invoice-intelligence dashboard, split across a new "Documents" and "Summary" tab.

**Architecture:** Pull the data logic (types, filtering, sorting, aggregation, CSV generation) into two new pure-function modules in `web/lib/`, fully unit-tested. Split the UI into `DocumentsTab.tsx` and `SummaryTab.tsx`, each driven by those pure functions. `DashboardClient.tsx` keeps owning state (which tab, which filters, which sort) and passes already-computed data down — the tab components render, they don't re-derive.

**Tech Stack:** Next.js 16 App Router, React (client component), TypeScript, Vitest (existing test runner — no new dependency for testing or CSV export).

## Global Constraints

- No new npm dependencies (CSV is hand-generated, not via a library — see spec).
- Client-side filtering/sorting/aggregation only — no new Supabase queries (see spec).
- Sortable columns are **Date and Company only** — not every column (see spec's ambiguity fix).
- Summary tab always shows the full picture across all months/companies, independent of the Documents tab's active filters (judgment call #1 in the spec).
- Documents with `status !== "done"` (no `extracted_data`) are excluded from all Summary aggregates, but still shown normally in the Documents table (judgment call #2 in the spec).
- Follow this project's established conventions from earlier work: explain each change in the commit message (why, not just what), commit and push after each verified task (to the feature branch created for this plan — **not** `master`; `master` only gets this work via the merge at the end of the whole-branch review), check `README.md`/`CLAUDE.md` for staleness after a change that could affect them, and write real Vitest tests matching the style already in `web/lib/extractor.test.ts` (`vi.hoisted`/`vi.mock` pattern where mocking is needed, `describe`/`it`/`expect`).
- UI copy: this app already mixes Hebrew (data labels, table headers, messages) and English (branding, action buttons like "Upload PDF"). New Hebrew labels used in this plan: tabs "מסמכים" (Documents) / "סיכום" (Summary); month filter "חודש" with "כל החודשים" (all months) as the no-filter option; company filter "חברה" with "כל החברות" (all companies); export button "ייצוא ל-CSV"; new table column "חברה" (Company).

---

### Task 1: `web/lib/dashboardAggregations.ts` — types, month/company options, filtering, sorting

**Files:**
- Create: `web/lib/dashboardAggregations.ts`
- Create: `web/lib/testFixtures.ts` (shared `makeDoc` test helper — Task 3's test file reuses this instead of redefining it, so the same fixture isn't duplicated verbatim across two test files)
- Test: `web/lib/dashboardAggregations.test.ts`

**Interfaces:**
- Produces: `InvoiceItem`, `ExtractedData`, `Document` (moved from `DashboardClient.tsx` — that file still has its own copy until Task 6, which is fine, TypeScript doesn't complain about two structurally-identical interfaces living in two files), `DocumentFilters`, `SortColumn`, `SortDirection`, `getMonthOptions(documents: Document[]): string[]`, `getCompanyOptions(documents: Document[]): string[]`, `filterDocuments(documents: Document[], filters: DocumentFilters): Document[]`, `sortDocuments(documents: Document[], sortBy: SortColumn, direction: SortDirection): Document[]`, `formatMonthLabel(month: string): string`, `formatILS(value: number | null | undefined): string`. Also produces `makeDoc(overrides: Partial<Document> & { id: string }): Document` from `web/lib/testFixtures.ts` — a test-only helper, not part of the app's runtime code, but a named interface later tasks' tests rely on.

- [ ] **Step 1: Write the failing test**

Create `web/lib/testFixtures.ts` (test-only fixture helper, not application code):

```typescript
import type { Document } from "./dashboardAggregations";

export function makeDoc(overrides: Partial<Document> & { id: string }): Document {
  return {
    filename: "invoice.pdf",
    status: "done",
    confidence: 0.95,
    created_at: "2026-07-15T10:00:00.000Z",
    extracted_data: {
      vendor: "Acme Ltd",
      vendor_id: null,
      invoice_number: "INV-1",
      invoice_date: "2026-07-15",
      due_date: null,
      items: [],
      subtotal: 100,
      vat_rate: 0.17,
      vat_amount: 17,
      total: 117,
      currency: "ILS",
      confidence: 0.95,
    },
    ...overrides,
  };
}
```

This has no test of its own (it's a fixture, not logic) — Task 1's own tests below exercise it indirectly by using it. If `npx tsc --noEmit` passes with this file in place, that's the check for this specific step.

Create `web/lib/dashboardAggregations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getMonthOptions,
  getCompanyOptions,
  filterDocuments,
  sortDocuments,
  formatMonthLabel,
  formatILS,
} from "./dashboardAggregations";
import { makeDoc } from "./testFixtures";

describe("getMonthOptions", () => {
  it("returns distinct months, newest first", () => {
    const docs = [
      makeDoc({ id: "1", created_at: "2026-06-01T00:00:00.000Z" }),
      makeDoc({ id: "2", created_at: "2026-07-15T00:00:00.000Z" }),
      makeDoc({ id: "3", created_at: "2026-07-20T00:00:00.000Z" }),
    ];
    expect(getMonthOptions(docs)).toEqual(["2026-07", "2026-06"]);
  });
});

describe("getCompanyOptions", () => {
  it("returns distinct vendors from done documents only, sorted", () => {
    const docs = [
      makeDoc({ id: "1", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Zeta Ltd" } }),
      makeDoc({ id: "2", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Acme Ltd" } }),
      makeDoc({ id: "3", status: "processing", extracted_data: null }),
    ];
    expect(getCompanyOptions(docs)).toEqual(["Acme Ltd", "Zeta Ltd"]);
  });
});

describe("filterDocuments", () => {
  const docs = [
    makeDoc({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }),
    makeDoc({
      id: "2",
      created_at: "2026-06-01T00:00:00.000Z",
      extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Other Co" },
    }),
  ];

  it("returns everything when no filters are set", () => {
    expect(filterDocuments(docs, { month: null, company: null })).toHaveLength(2);
  });

  it("filters by month", () => {
    const result = filterDocuments(docs, { month: "2026-07", company: null });
    expect(result.map((d) => d.id)).toEqual(["1"]);
  });

  it("filters by company", () => {
    const result = filterDocuments(docs, { month: null, company: "Other Co" });
    expect(result.map((d) => d.id)).toEqual(["2"]);
  });
});

describe("sortDocuments", () => {
  it("sorts by date ascending and descending", () => {
    const docs = [
      makeDoc({ id: "old", created_at: "2026-01-01T00:00:00.000Z" }),
      makeDoc({ id: "new", created_at: "2026-12-01T00:00:00.000Z" }),
    ];
    expect(sortDocuments(docs, "date", "asc").map((d) => d.id)).toEqual(["old", "new"]);
    expect(sortDocuments(docs, "date", "desc").map((d) => d.id)).toEqual(["new", "old"]);
  });

  it("sorts by company, treating missing vendor as empty string", () => {
    const docs = [
      makeDoc({ id: "b", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Beta" } }),
      makeDoc({ id: "a", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Alpha" } }),
      makeDoc({ id: "none", status: "processing", extracted_data: null }),
    ];
    expect(sortDocuments(docs, "company", "asc").map((d) => d.id)).toEqual(["none", "a", "b"]);
  });

  it("does not mutate the input array", () => {
    const docs = [makeDoc({ id: "1" }), makeDoc({ id: "2" })];
    const original = [...docs];
    sortDocuments(docs, "date", "desc");
    expect(docs).toEqual(original);
  });
});

describe("formatMonthLabel", () => {
  it("formats a YYYY-MM string as a Hebrew month/year label", () => {
    expect(formatMonthLabel("2026-07")).toBe("יולי 2026");
  });
});

describe("formatILS", () => {
  it("formats a number with the shekel symbol", () => {
    expect(formatILS(117)).toBe("₪117.00");
  });

  it("returns a dash for null or undefined", () => {
    expect(formatILS(null)).toBe("—");
    expect(formatILS(undefined)).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/dashboardAggregations.test.ts`
Expected: FAIL — `Cannot find module './dashboardAggregations'` (the file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/dashboardAggregations.ts`:

```typescript
export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ExtractedData {
  vendor: string;
  vendor_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  confidence: number;
}

export interface Document {
  id: string;
  filename: string;
  status: "processing" | "done" | "failed";
  confidence: number | null;
  extracted_data: ExtractedData | null;
  created_at: string;
}

export interface DocumentFilters {
  month: string | null;
  company: string | null;
}

export type SortColumn = "date" | "company";
export type SortDirection = "asc" | "desc";

export function getMonthOptions(documents: Document[]): string[] {
  const months = new Set(documents.map((d) => d.created_at.slice(0, 7)));
  return Array.from(months).sort().reverse();
}

export function getCompanyOptions(documents: Document[]): string[] {
  const companies = new Set(
    documents
      .filter((d): d is Document & { extracted_data: ExtractedData } =>
        d.status === "done" && d.extracted_data !== null
      )
      .map((d) => d.extracted_data.vendor)
  );
  return Array.from(companies).sort();
}

export function filterDocuments(documents: Document[], filters: DocumentFilters): Document[] {
  return documents.filter((d) => {
    if (filters.month && d.created_at.slice(0, 7) !== filters.month) return false;
    if (filters.company && d.extracted_data?.vendor !== filters.company) return false;
    return true;
  });
}

export function sortDocuments(
  documents: Document[],
  sortBy: SortColumn,
  direction: SortDirection
): Document[] {
  const sorted = [...documents].sort((a, b) => {
    const cmp =
      sortBy === "date"
        ? a.created_at.localeCompare(b.created_at)
        : (a.extracted_data?.vendor ?? "").localeCompare(b.extracted_data?.vendor ?? "");
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

const HEBREW_MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  const name = HEBREW_MONTH_NAMES[Number(monthNum) - 1];
  return `${name} ${year}`;
}

export function formatILS(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₪${value.toFixed(2)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run lib/dashboardAggregations.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Run the deliberate-break check (this project's established practice for new tests)**

Temporarily change `direction === "asc" ? cmp : -cmp` to always `cmp` (remove the ternary), run the suite, confirm the "sorts by date ascending and descending" test fails, then revert with `git checkout -- web/lib/dashboardAggregations.ts` (safe — nothing is committed yet) and re-run to confirm it's green again. This matches the pattern used earlier this session for `extractor.test.ts` (a test that never fails on a real regression is worse than no test).

- [ ] **Step 6: Commit**

```bash
cd web
npx tsc --noEmit
git add lib/dashboardAggregations.ts lib/testFixtures.ts lib/dashboardAggregations.test.ts
git commit -m "feat: add month/company filtering and sorting for the dashboard

New web/lib/dashboardAggregations.ts holds the Document/ExtractedData
types plus pure functions for deriving filter options and
filtering/sorting documents client-side, per the admin dashboard
design (docs/superpowers/specs/2026-08-04-admin-dashboard-design.md).
Aggregation (monthly totals, cumulative, company breakdown) is a
separate follow-up task."
git push -u origin worktree-admin-dashboard
```

---

### Task 2: `web/lib/dashboardAggregations.ts` — monthly totals, cumulative total, company breakdown

**Files:**
- Modify: `web/lib/dashboardAggregations.ts`
- Modify: `web/lib/dashboardAggregations.test.ts`

**Interfaces:**
- Consumes: `Document`, `ExtractedData` from Task 1 (same file).
- Produces: `MonthlyTotal`, `CompanyBreakdown`, `getMonthlyTotals(documents: Document[]): MonthlyTotal[]`, `getCumulativeTotal(documents: Document[]): number`, `getCompanyBreakdown(documents: Document[]): CompanyBreakdown[]`.

- [ ] **Step 1: Write the failing test**

Append to `web/lib/dashboardAggregations.test.ts` (add this import to the existing import line, and these `describe` blocks anywhere after the existing ones):

```typescript
// add to the existing import from "./dashboardAggregations":
//   getMonthlyTotals, getCumulativeTotal, getCompanyBreakdown

describe("getMonthlyTotals", () => {
  it("sums totals per month for done documents only", () => {
    const docs = [
      makeDoc({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }), // total 117
      makeDoc({ id: "2", created_at: "2026-07-15T00:00:00.000Z" }), // total 117
      makeDoc({ id: "3", created_at: "2026-06-01T00:00:00.000Z" }), // total 117
      makeDoc({ id: "4", created_at: "2026-07-20T00:00:00.000Z", status: "processing", extracted_data: null }),
    ];
    expect(getMonthlyTotals(docs)).toEqual([
      { month: "2026-07", total: 234 },
      { month: "2026-06", total: 117 },
    ]);
  });
});

describe("getCumulativeTotal", () => {
  it("sums totals across all done documents, excluding processing/failed", () => {
    const docs = [
      makeDoc({ id: "1" }), // 117
      makeDoc({ id: "2" }), // 117
      makeDoc({ id: "3", status: "failed", extracted_data: null }),
    ];
    expect(getCumulativeTotal(docs)).toBe(234);
  });
});

describe("getCompanyBreakdown", () => {
  it("groups totals by vendor, sorted descending by total", () => {
    const docs = [
      makeDoc({ id: "1", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Small Co", total: 50 } }),
      makeDoc({ id: "2", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Big Co", total: 500 } }),
      makeDoc({ id: "3", extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: "Big Co", total: 300 } }),
      makeDoc({ id: "4", status: "failed", extracted_data: null }),
    ];
    expect(getCompanyBreakdown(docs)).toEqual([
      { company: "Big Co", total: 800 },
      { company: "Small Co", total: 50 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/dashboardAggregations.test.ts`
Expected: FAIL — `getMonthlyTotals is not a function` (or similar; the new import names don't exist yet).

- [ ] **Step 3: Write minimal implementation**

Append to `web/lib/dashboardAggregations.ts`:

```typescript
export interface MonthlyTotal {
  month: string;
  total: number;
}

export function getMonthlyTotals(documents: Document[]): MonthlyTotal[] {
  const totals = new Map<string, number>();
  for (const doc of documents) {
    if (doc.status !== "done" || !doc.extracted_data) continue;
    const month = doc.created_at.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + doc.extracted_data.total);
  }
  return Array.from(totals.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function getCumulativeTotal(documents: Document[]): number {
  return documents
    .filter((d): d is Document & { extracted_data: ExtractedData } =>
      d.status === "done" && d.extracted_data !== null
    )
    .reduce((sum, d) => sum + d.extracted_data.total, 0);
}

export interface CompanyBreakdown {
  company: string;
  total: number;
}

export function getCompanyBreakdown(documents: Document[]): CompanyBreakdown[] {
  const totals = new Map<string, number>();
  for (const doc of documents) {
    if (doc.status !== "done" || !doc.extracted_data) continue;
    const vendor = doc.extracted_data.vendor;
    totals.set(vendor, (totals.get(vendor) ?? 0) + doc.extracted_data.total);
  }
  return Array.from(totals.entries())
    .map(([company, total]) => ({ company, total }))
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run lib/dashboardAggregations.test.ts`
Expected: PASS — all tests green (Task 1's tests plus these).

- [ ] **Step 5: Commit**

```bash
cd web
npx tsc --noEmit
git add lib/dashboardAggregations.ts lib/dashboardAggregations.test.ts
git commit -m "feat: add monthly totals, cumulative total, and company breakdown

Completes the dashboardAggregations module. All three exclude
processing/failed documents (no extracted_data to aggregate) per
judgment call #2 in the design spec."
git push -u origin worktree-admin-dashboard
```

---

### Task 3: `web/lib/csvExport.ts` — CSV generation and download

**Files:**
- Create: `web/lib/csvExport.ts`
- Test: `web/lib/csvExport.test.ts`

**Interfaces:**
- Consumes: `Document` from `web/lib/dashboardAggregations.ts` (Task 1); `makeDoc` from `web/lib/testFixtures.ts` (Task 1, test-only).
- Produces: `documentsToCsv(documents: Document[]): string`, `downloadCsv(csvContent: string, filename: string): void`.

- [ ] **Step 1: Write the failing test**

Create `web/lib/csvExport.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { documentsToCsv, downloadCsv } from "./csvExport";
import { makeDoc } from "./testFixtures";

describe("documentsToCsv", () => {
  it("produces a header row plus one row per document", () => {
    const csv = documentsToCsv([makeDoc({ id: "1" })]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Filename,Date,Company,Status,Confidence,Total");
    expect(lines[1]).toBe("invoice.pdf,2026-07-15,Acme Ltd,done,95%,117.00");
    expect(lines).toHaveLength(2);
  });

  it("leaves company/confidence/total blank for documents with no extracted data", () => {
    const csv = documentsToCsv([
      makeDoc({ id: "1", status: "processing", confidence: null, extracted_data: null }),
    ]);
    expect(csv.split("\n")[1]).toBe("invoice.pdf,2026-07-15,,processing,,");
  });

  it("quotes fields containing commas, and escapes embedded quotes", () => {
    const csv = documentsToCsv([
      makeDoc({
        id: "1",
        extracted_data: {
          ...makeDoc({ id: "x" }).extracted_data!,
          vendor: 'Acme, "The Best" Ltd',
        },
      }),
    ]);
    expect(csv.split("\n")[1]).toContain('"Acme, ""The Best"" Ltd"');
  });

  it("returns just the header row for an empty list", () => {
    expect(documentsToCsv([])).toBe("Filename,Date,Company,Status,Confidence,Total");
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a Blob URL, clicks a download link, then revokes the URL", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const fakeLink = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(fakeLink);

    downloadCsv("a,b\n1,2", "export.csv");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(fakeLink.download).toBe("export.csv");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/csvExport.test.ts`
Expected: FAIL — `Cannot find module './csvExport'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/lib/csvExport.ts`:

```typescript
import type { Document } from "./dashboardAggregations";

const CSV_HEADERS = ["Filename", "Date", "Company", "Status", "Confidence", "Total"];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function documentsToCsv(documents: Document[]): string {
  const rows = documents.map((doc) => {
    const company = doc.extracted_data?.vendor ?? "";
    const confidence = doc.confidence !== null ? `${(doc.confidence * 100).toFixed(0)}%` : "";
    const total = doc.extracted_data ? doc.extracted_data.total.toFixed(2) : "";
    return [
      doc.filename,
      doc.created_at.slice(0, 10),
      company,
      doc.status,
      confidence,
      total,
    ]
      .map(escapeCsvField)
      .join(",");
  });
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run lib/csvExport.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
cd web
npx tsc --noEmit
git add lib/csvExport.ts lib/csvExport.test.ts
git commit -m "feat: add client-side CSV export

documentsToCsv() and downloadCsv() — no new dependency (a Blob and
a temporary <a download> link), matching the design spec's choice
of CSV over a real .xlsx library."
git push -u origin worktree-admin-dashboard
```

---

### Task 4: `web/app/DocumentsTab.tsx`

**Files:**
- Create: `web/app/DocumentsTab.tsx`

**Interfaces:**
- Consumes: `Document`, `SortColumn`, `SortDirection`, `formatILS` from `@/lib/dashboardAggregations`; `documentsToCsv`, `downloadCsv` from `@/lib/csvExport`.
- Produces: `DocumentsTab` component with this prop shape (later consumed by Task 6):

```typescript
interface DocumentsTabProps {
  documents: Document[]; // already filtered + sorted by the caller
  monthOptions: string[];
  companyOptions: string[];
  selectedMonth: string | null;
  selectedCompany: string | null;
  sortBy: SortColumn;
  sortDirection: SortDirection;
  onMonthChange: (month: string | null) => void;
  onCompanyChange: (company: string | null) => void;
  onSortChange: (column: SortColumn) => void;
  onSelectDocument: (doc: Document) => void;
  isRefreshing: boolean;
}
```

This component does not filter or sort — it renders exactly the `documents` array it's given, in order. `StatusBadge` and `ConfidenceBadge` move here from `DashboardClient.tsx` (Task 6 removes them from there) since the table is now here.

- [ ] **Step 1: Create the component**

Create `web/app/DocumentsTab.tsx`:

```typescript
"use client";

import {
  formatMonthLabel,
  type Document,
  type SortColumn,
  type SortDirection,
} from "@/lib/dashboardAggregations";
import { documentsToCsv, downloadCsv } from "@/lib/csvExport";

interface DocumentsTabProps {
  documents: Document[];
  monthOptions: string[];
  companyOptions: string[];
  selectedMonth: string | null;
  selectedCompany: string | null;
  sortBy: SortColumn;
  sortDirection: SortDirection;
  onMonthChange: (month: string | null) => void;
  onCompanyChange: (company: string | null) => void;
  onSortChange: (column: SortColumn) => void;
  onSelectDocument: (doc: Document) => void;
  isRefreshing: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) {
    return <span className="text-zinc-400">—</span>;
  }
  const color =
    confidence >= 0.8
      ? "bg-green-100 text-green-800"
      : confidence >= 0.6
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const styles: Record<Document["status"], string> = {
    processing: "bg-blue-100 text-blue-800",
    done: "bg-zinc-100 text-zinc-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSortChange,
}: {
  label: string;
  column: SortColumn;
  sortBy: SortColumn;
  sortDirection: SortDirection;
  onSortChange: (column: SortColumn) => void;
}) {
  const active = sortBy === column;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={() => onSortChange(column)}
        className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {label}
        {active && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

export default function DocumentsTab({
  documents,
  monthOptions,
  companyOptions,
  selectedMonth,
  selectedCompany,
  sortBy,
  sortDirection,
  onMonthChange,
  onCompanyChange,
  onSortChange,
  onSelectDocument,
  isRefreshing,
}: DocumentsTabProps) {
  function handleExport() {
    const csv = documentsToCsv(documents);
    downloadCsv(csv, `invoices-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <select
          value={selectedMonth ?? ""}
          onChange={(e) => onMonthChange(e.target.value || null)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">כל החודשים</option>
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {formatMonthLabel(month)}
            </option>
          ))}
        </select>

        <select
          value={selectedCompany ?? ""}
          onChange={(e) => onCompanyChange(e.target.value || null)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">כל החברות</option>
          {companyOptions.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>

        <button
          onClick={handleExport}
          className="ml-auto rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          ייצוא ל-CSV
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">שם קובץ</th>
            <SortableHeader
              label="תאריך"
              column="date"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHeader
              label="חברה"
              column="company"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <th className="px-4 py-3 font-medium">סטטוס</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {isRefreshing ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                מרענן...
              </td>
            </tr>
          ) : documents.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                אין מסמכים תואמים
              </td>
            </tr>
          ) : (
            documents.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{doc.filename}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {new Date(doc.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {doc.extracted_data?.vendor ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge confidence={doc.confidence} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd web
git add app/DocumentsTab.tsx
git commit -m "feat: add DocumentsTab component

Toolbar (month filter, company filter, CSV export) + the documents
table, moved out of DashboardClient.tsx. Receives already-filtered
and already-sorted documents — no filtering/sorting logic lives
here, per the design spec."
git push -u origin worktree-admin-dashboard
```

---

### Task 5: `web/app/SummaryTab.tsx`

**Files:**
- Create: `web/app/SummaryTab.tsx`

**Interfaces:**
- Consumes: `Document`, `getMonthlyTotals`, `getCumulativeTotal`, `getCompanyBreakdown`, `formatMonthLabel`, `formatILS` from `@/lib/dashboardAggregations` (Tasks 1–2).
- Produces: `SummaryTab` component, prop shape `{ documents: Document[] }` — always the **full, unfiltered** list (see Global Constraints).

- [ ] **Step 1: Create the component**

Create `web/app/SummaryTab.tsx`:

```typescript
import {
  getMonthlyTotals,
  getCumulativeTotal,
  getCompanyBreakdown,
  formatMonthLabel,
  formatILS,
  type Document,
} from "@/lib/dashboardAggregations";

export default function SummaryTab({ documents }: { documents: Document[] }) {
  const monthlyTotals = getMonthlyTotals(documents);
  const cumulativeTotal = getCumulativeTotal(documents);
  const companyBreakdown = getCompanyBreakdown(documents);
  const maxCompanyTotal = companyBreakdown[0]?.total ?? 0;

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            סה&quot;כ מצטבר
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatILS(cumulativeTotal)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            מסמכים שעובדו
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {documents.filter((d) => d.status === "done").length}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">סיכום חודשי</h3>
        {monthlyTotals.length === 0 ? (
          <p className="text-sm text-zinc-400">אין נתונים עדיין</p>
        ) : (
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {monthlyTotals.map((row) => (
              <div key={row.month} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{formatMonthLabel(row.month)}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatILS(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">פילוח לפי חברה</h3>
        {companyBreakdown.length === 0 ? (
          <p className="text-sm text-zinc-400">אין נתונים עדיין</p>
        ) : (
          <div className="space-y-2">
            {companyBreakdown.map((row) => (
              <div key={row.company} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate text-zinc-600 dark:text-zinc-400">{row.company}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(row.total / maxCompanyTotal) * 100}%` }}
                  />
                </div>
                <span className="w-24 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatILS(row.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd web
git add app/SummaryTab.tsx
git commit -m "feat: add SummaryTab component

Cumulative total, monthly totals, and company breakdown. Always
receives the full unfiltered document list — independent of
whatever filter is active on the Documents tab (judgment call #1
in the design spec)."
git push -u origin worktree-admin-dashboard
```

---

### Task 6: Wire it all together in `web/app/DashboardClient.tsx` (and update `web/app/page.tsx`'s import)

**Files:**
- Modify: `web/app/DashboardClient.tsx` (full rewrite of the file — see below)
- Modify: `web/app/page.tsx:2` (change where `Document` is imported from)

**Interfaces:**
- Consumes: everything produced by Tasks 1–5.
- Produces: `Document` is now re-exported from `DashboardClient.tsx` as `export type { Document } from "@/lib/dashboardAggregations";` so `page.tsx` doesn't strictly need to change its import path — but Step 1 below updates `page.tsx` anyway to import directly from the new source, which is more correct now that `dashboardAggregations.ts` is the real source of truth for that type.

- [ ] **Step 1: Update `page.tsx`'s import**

In `web/app/page.tsx`, change line 2 from:

```typescript
import DashboardClient, { type Document } from "./DashboardClient";
```

to:

```typescript
import DashboardClient from "./DashboardClient";
import type { Document } from "@/lib/dashboardAggregations";
```

- [ ] **Step 2: Rewrite `DashboardClient.tsx`**

Replace the entire contents of `web/app/DashboardClient.tsx` with:

```typescript
"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import DocumentsTab from "./DocumentsTab";
import SummaryTab from "./SummaryTab";
import {
  filterDocuments,
  formatILS,
  getCompanyOptions,
  getMonthOptions,
  sortDocuments,
  type Document,
  type SortColumn,
  type SortDirection,
} from "@/lib/dashboardAggregations";

export type { Document };

type Tab = "documents" | "summary";

export default function DashboardClient({
  initialDocuments,
}: {
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const monthOptions = useMemo(() => getMonthOptions(initialDocuments), [initialDocuments]);
  const companyOptions = useMemo(() => getCompanyOptions(initialDocuments), [initialDocuments]);

  const visibleDocuments = useMemo(() => {
    const filtered = filterDocuments(initialDocuments, {
      month: selectedMonth,
      company: selectedCompany,
    });
    return sortDocuments(filtered, sortBy, sortDirection);
  }, [initialDocuments, selectedMonth, selectedCompany, sortBy, sortDirection]);

  function handleSortChange(column: SortColumn) {
    if (column === sortBy) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadMessage({ type: "error", text: "רק קבצי PDF נתמכים" });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error ?? "העלאה נכשלה");
      }

      setUploadMessage({ type: "success", text: `הקובץ ${file.name} עובד בהצלחה` });
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadMessage({
        type: "error",
        text: err instanceof Error ? err.message : "העלאה נכשלה",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence
          </h1>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {uploading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900" />
              )}
              {uploading ? "מעבד..." : "Upload PDF"}
            </button>
          </div>
        </div>

        {uploadMessage && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              uploadMessage.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {uploadMessage.text}
          </div>
        )}

        <div className="mt-8 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "documents"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            מסמכים
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "summary"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            סיכום
          </button>
        </div>

        <div className="overflow-hidden rounded-b-lg border-x border-b border-zinc-200 dark:border-zinc-800">
          {activeTab === "documents" ? (
            <DocumentsTab
              documents={visibleDocuments}
              monthOptions={monthOptions}
              companyOptions={companyOptions}
              selectedMonth={selectedMonth}
              selectedCompany={selectedCompany}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onMonthChange={setSelectedMonth}
              onCompanyChange={setSelectedCompany}
              onSortChange={handleSortChange}
              onSelectDocument={setSelectedDocument}
              isRefreshing={isRefreshing}
            />
          ) : (
            <SummaryTab documents={initialDocuments} />
          )}
        </div>
      </div>

      {selectedDocument && (
        <DocumentPanel document={selectedDocument} onClose={() => setSelectedDocument(null)} />
      )}
    </div>
  );
}

function DocumentPanel({
  document,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  const data = document.extracted_data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {document.filename}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        {!data ? (
          <p className="mt-6 text-sm text-zinc-500">
            {document.status === "processing"
              ? "המסמך עדיין בעיבוד..."
              : "לא נמצאו נתונים מחולצים"}
          </p>
        ) : (
          <div className="mt-6 space-y-4 text-sm">
            {data.confidence < 0.7 && (
              <div className="rounded-lg bg-yellow-50 px-4 py-3 text-yellow-800">
                ⚠ רמת ביטחון נמוכה בחילוץ הנתונים (
                {(data.confidence * 100).toFixed(0)}%) — יש לבדוק ידנית
              </div>
            )}

            <dl className="space-y-2">
              <Field label="ספק" value={data.vendor} />
              <Field label="ח.פ / ע.מ" value={data.vendor_id} />
              <Field label="מספר חשבונית" value={data.invoice_number} />
              <Field label="תאריך חשבונית" value={data.invoice_date} />
              <Field label="תאריך לתשלום" value={data.due_date} />
            </dl>

            <div>
              <h3 className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">פריטים</h3>
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="pb-1">תיאור</th>
                    <th className="pb-1 text-right">כמות</th>
                    <th className="pb-1 text-right">מחיר יחידה</th>
                    <th className="pb-1 text-right">סה&quot;כ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{item.description}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right">{formatILS(item.unit_price)}</td>
                      <td className="py-1.5 text-right">{formatILS(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Field label="סכום ביניים" value={formatILS(data.subtotal)} />
              <Field
                label={`מע"מ (${(data.vat_rate * 100).toFixed(0)}%)`}
                value={formatILS(data.vat_amount)}
              />
              <Field label='סה"כ לתשלום' value={formatILS(data.total)} bold />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  bold,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-900 dark:text-zinc-100 ${bold ? "font-semibold" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and run the full test suite**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all existing tests (extractor + dashboardAggregations + csvExport) still pass — this task touches no test files, so the count should match Task 2's + Task 3's + the pre-existing `extractor.test.ts` count.

- [ ] **Step 4: Manual smoke test**

Run: `cd web && npm run dev`
Open the printed localhost URL and confirm:
- Both tabs render (מסמכים / סיכום) and clicking switches between them.
- The month and company dropdowns filter the table.
- Clicking the תאריך or חברה column header sorts (and clicking again reverses direction, shown by the ↑/↓ arrow).
- "ייצוא ל-CSV" downloads a `.csv` file that opens correctly.
- The Summary tab's totals don't change when a Documents-tab filter is applied (per judgment call #1).
- Uploading a PDF still works and the table refreshes (existing behavior, unchanged).
- Clicking a row still opens the side panel (existing behavior, unchanged).

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 5: Check README.md / CLAUDE.md for staleness**

Read `README.md`'s "Dashboard" description (if any) and `CLAUDE.md`'s "Dashboard Requirements" section. `CLAUDE.md` currently says:

```
## Dashboard Requirements
1. Upload button at top (file picker, PDF only), shows a spinner while processing
2. Documents table columns: filename, date, status badge, confidence badge
   - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
3. Click any row: side panel showing vendor, business ID, dates, line items, VAT
   breakdown, and total, with Hebrew labels
4. Warning banner in the side panel if confidence < 0.7
```

This is now out of date — the table has a new Company column, there are two tabs, filtering/sorting/export exist. Update this section (see Task 7 — folded into a dedicated docs task since it's a real, sizeable content change, not a one-line tweak).

- [ ] **Step 6: Commit**

```bash
cd web
git add app/DashboardClient.tsx app/page.tsx
git commit -m "feat: wire DocumentsTab/SummaryTab into DashboardClient

DashboardClient now owns tab state and filter/sort state, computes
the filtered+sorted document list via dashboardAggregations, and
renders whichever tab is active. Document/ExtractedData/InvoiceItem
types now live in web/lib/dashboardAggregations.ts (page.tsx updated
to import Document from there instead of from DashboardClient).

Manually verified: both tabs render and switch, month/company
filters work, Date/Company column sort toggles direction, CSV
export downloads a working file, Summary stays independent of
Documents-tab filters, upload and the side panel still work
unchanged."
git push -u origin worktree-admin-dashboard
```

---

### Task 7: Update `CLAUDE.md` to describe the new dashboard

**Files:**
- Modify: `CLAUDE.md` (root, "Dashboard Requirements" section)

- [ ] **Step 1: Replace the Dashboard Requirements section**

In `CLAUDE.md`, replace:

```
## Dashboard Requirements
1. Upload button at top (file picker, PDF only), shows a spinner while processing
2. Documents table columns: filename, date, status badge, confidence badge
   - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
3. Click any row: side panel showing vendor, business ID, dates, line items, VAT
   breakdown, and total, with Hebrew labels
4. Warning banner in the side panel if confidence < 0.7
```

with:

```
## Dashboard Requirements
1. Upload button at top (file picker, PDF only), shows a spinner while processing
2. Two tabs: "מסמכים" (Documents) and "סיכום" (Summary)
3. Documents tab:
   - Month filter, company filter (both derived from the actual data, not hardcoded)
   - Table columns: filename, date, company, status badge, confidence badge
     - Confidence badge: green if >= 0.8, yellow if 0.6-0.79, red if < 0.6
   - Date and Company columns are sortable (click header, click again to reverse)
   - "ייצוא ל-CSV" exports the currently filtered/sorted rows as a CSV file
     (client-side, no server round-trip, no new dependency)
4. Summary tab: cumulative total, monthly totals, and a company breakdown —
   always across *all* documents, independent of the Documents tab's filters
   (see docs/superpowers/specs/2026-08-04-admin-dashboard-design.md for why)
5. Click any row in the Documents table: side panel showing vendor, business ID,
   dates, line items, VAT breakdown, and total, with Hebrew labels
6. Warning banner in the side panel if confidence < 0.7
7. Filtering/sorting/aggregation logic lives in web/lib/dashboardAggregations.ts
   (pure functions, unit-tested) — DocumentsTab.tsx and SummaryTab.tsx render,
   they don't re-derive
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md's Dashboard Requirements for the new tabs

Was still describing the single-table dashboard from before this
feature (issue #6) — tabs, filtering, sorting, and export didn't
exist when it was last written."
git push -u origin worktree-admin-dashboard
```

---

### Task 8: Deploy

**Files:** none (deploy only)

**This task does not run in the worktree, and not through the subagent task
loop.** It runs from `master`, after the branch from Tasks 1-7 has passed
final review and been merged (`superpowers:finishing-a-development-branch`).
Deploying from the worktree branch would put unreviewed code live before
the merge decision is even made.

- [ ] **Step 1: Ask before deploying**

Per this project's established pattern this session, confirm with the user before running a production deploy (it touches live infrastructure).

- [ ] **Step 2: Clean build caches and deploy**

```bash
cd web
rm -rf .next .open-next
npm run cf:deploy
```

- [ ] **Step 3: Verify live**

```bash
curl -sk https://your-deployment.workers.dev/ -o /tmp/verify.html
grep -o "<title>.*</title>" /tmp/verify.html
rm -f /tmp/verify.html
```

Then manually open the live URL and repeat the Task 6 Step 4 smoke-test checklist against production, not just the dev server.

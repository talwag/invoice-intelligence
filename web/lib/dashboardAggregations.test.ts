import { describe, it, expect } from "vitest";
import {
  getMonthOptions,
  getCompanyOptions,
  filterDocuments,
  sortDocuments,
  formatMonthLabel,
  formatILS,
  getMonthlyTotals,
  getCumulativeTotal,
  getCompanyBreakdown,
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

  it("groups digits with a thousands separator", () => {
    expect(formatILS(1234.5)).toBe("₪1,234.50");
    expect(formatILS(1000000)).toBe("₪1,000,000.00");
  });

  it("returns a dash for null or undefined", () => {
    expect(formatILS(null)).toBe("—");
    expect(formatILS(undefined)).toBe("—");
  });
});

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

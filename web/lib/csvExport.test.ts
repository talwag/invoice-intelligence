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

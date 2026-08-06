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

  it.each(["=", "+", "-", "@"])(
    "prefixes a filename starting with '%s' with a single quote to prevent formula injection",
    (prefix) => {
      const csv = documentsToCsv([makeDoc({ id: "1", filename: `${prefix}HYPERLINK(evil.com)` })]);
      expect(csv.split("\n")[1]).toContain(`'${prefix}HYPERLINK(evil.com)`);
    }
  );

  it.each(["=", "+", "-", "@"])(
    "prefixes a company/vendor name starting with '%s' with a single quote to prevent formula injection",
    (prefix) => {
      const csv = documentsToCsv([
        makeDoc({
          id: "1",
          extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: `${prefix}cmd|calc!A1` },
        }),
      ]);
      expect(csv.split("\n")[1]).toContain(`'${prefix}cmd|calc!A1`);
    }
  );

  it("leaves a normal field (not starting with =, +, -, or @) unaffected", () => {
    const csv = documentsToCsv([makeDoc({ id: "1", filename: "invoice.pdf" })]);
    expect(csv.split("\n")[1]).toBe("invoice.pdf,2026-07-15,Acme Ltd,done,95%,117.00");
  });

  it("applies both the injection guard and comma/quote escaping when a field needs both", () => {
    const csv = documentsToCsv([
      makeDoc({
        id: "1",
        extracted_data: { ...makeDoc({ id: "x" }).extracted_data!, vendor: '=foo,"bar"' },
      }),
    ]);
    // guard prefixes with ' first, then the comma/quote escaping wraps and
    // doubles embedded quotes around the already-guarded value
    expect(csv.split("\n")[1]).toContain('"\'=foo,""bar"""');
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

  it("prefixes the Blob content with a UTF-8 BOM so Excel doesn't mangle Hebrew text", () => {
    let blobParts: BlobPart[] = [];
    class FakeBlob {
      constructor(parts: BlobPart[]) {
        blobParts = parts;
      }
    }
    vi.stubGlobal("Blob", FakeBlob);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
      revokeObjectURL: vi.fn(),
    });
    const fakeLink = { href: "", download: "", click: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(fakeLink);

    downloadCsv("a,b\n1,2", "export.csv");

    expect(blobParts).toHaveLength(1);
    const content = blobParts[0] as string;
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content).toBe("﻿a,b\n1,2");
  });
});

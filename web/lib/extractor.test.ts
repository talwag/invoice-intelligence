import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

import {
  extractInvoice,
  validateInvoiceExtraction,
  ExtractionError,
  PROMPT,
} from "./extractor";

const validPayload = {
  vendor: "Acme Ltd",
  vendor_id: null,
  invoice_number: "INV-1",
  invoice_date: "2026-01-01",
  due_date: null,
  items: [
    { description: "Widget", quantity: 2, unit_price: 10, line_total: 20 },
  ],
  subtotal: 20,
  vat_rate: 0.17,
  vat_amount: 3.4,
  total: 23.4,
  currency: "ILS",
  confidence: 0.95,
};

const fakePdf = Buffer.from("%PDF-1.4 fake content for testing");

describe("validateInvoiceExtraction", () => {
  it("accepts a valid payload", () => {
    expect(() => validateInvoiceExtraction(validPayload)).not.toThrow();
  });

  it("rejects a payload missing vendor", () => {
    const { vendor, ...rest } = validPayload;
    expect(() => validateInvoiceExtraction(rest)).toThrow(ExtractionError);
  });

  it("rejects an item missing line_total", () => {
    expect(() =>
      validateInvoiceExtraction({
        ...validPayload,
        items: [{ description: "x", quantity: 1, unit_price: 1 }],
      })
    ).toThrow(/items/);
  });

  it("rejects a non-object top-level value", () => {
    expect(() => validateInvoiceExtraction([1, 2, 3])).toThrow(ExtractionError);
  });

  it("rejects a wrong-typed confidence", () => {
    expect(() =>
      validateInvoiceExtraction({ ...validPayload, confidence: "high" })
    ).toThrow(/confidence/);
  });
});

describe("PROMPT", () => {
  it("tells the model to prefer the Hebrew vendor name when both appear", () => {
    // Real invoices often print both a Hebrew legal name and an English
    // trading name; without this instruction the same company can come
    // back under two different names on different extraction runs, which
    // breaks "breakdown by company" grouping.
    expect(PROMPT).toContain("extract the Hebrew name");
  });
});

describe("extractInvoice", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("rejects non-PDF mime types before calling Gemini", async () => {
    await expect(extractInvoice(fakePdf, "image/png")).rejects.toThrow(
      ExtractionError
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("rejects empty files", async () => {
    await expect(
      extractInvoice(Buffer.alloc(0), "application/pdf")
    ).rejects.toThrow(/Empty file/);
  });

  it("rejects files without a PDF header", async () => {
    await expect(
      extractInvoice(Buffer.from("not a pdf"), "application/pdf")
    ).rejects.toThrow(/valid PDF/);
  });

  it("returns validated data on a successful call", async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validPayload) });
    const result = await extractInvoice(fakePdf, "application/pdf");
    expect(result.vendor).toBe("Acme Ltd");
  });

  it("throws when Gemini returns malformed JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not json{{{" });
    await expect(extractInvoice(fakePdf, "application/pdf")).rejects.toThrow(
      /malformed/
    );
  });

  it("throws when Gemini returns a wrong-shaped response", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ foo: "bar" }),
    });
    await expect(extractInvoice(fakePdf, "application/pdf")).rejects.toThrow(
      /vendor/
    );
  });

  it("throws a sanitized error when the API call itself rejects", async () => {
    mockGenerateContent.mockRejectedValue(new Error("network blip"));
    await expect(extractInvoice(fakePdf, "application/pdf")).rejects.toThrow(
      "Extraction service is unavailable"
    );
  });

  it("times out after 15s and reports it distinctly, without a real 15s wait", async () => {
    vi.useFakeTimers();
    try {
      mockGenerateContent.mockImplementation(
        ({ config }: { config: { abortSignal: AbortSignal } }) =>
          new Promise((_resolve, reject) => {
            config.abortSignal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          })
      );

      const promise = extractInvoice(fakePdf, "application/pdf");
      const expectation = expect(promise).rejects.toThrow(/timed out after 15s/);
      await vi.advanceTimersByTimeAsync(15_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

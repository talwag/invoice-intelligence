import { GoogleGenAI } from "@google/genai";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const PDF_MAGIC_BYTES = Buffer.from("%PDF-");
const MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 15_000;

export class ExtractionError extends Error {}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface InvoiceExtraction {
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

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function isValidInvoiceItem(value: unknown): value is InvoiceItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.description === "string" &&
    typeof item.quantity === "number" &&
    typeof item.unit_price === "number" &&
    typeof item.line_total === "number"
  );
}

export function validateInvoiceExtraction(data: unknown): InvoiceExtraction {
  if (typeof data !== "object" || data === null) {
    throw new ExtractionError("Extraction result was not a JSON object");
  }
  const d = data as Record<string, unknown>;

  const isNullableString = (v: unknown) => v === null || typeof v === "string";

  if (typeof d.vendor !== "string" || d.vendor.trim() === "") {
    throw new ExtractionError("Extraction result is missing 'vendor'");
  }
  if (!isNullableString(d.vendor_id)) {
    throw new ExtractionError("Extraction result has an invalid 'vendor_id'");
  }
  if (!isNullableString(d.invoice_number)) {
    throw new ExtractionError("Extraction result has an invalid 'invoice_number'");
  }
  if (!isNullableString(d.invoice_date)) {
    throw new ExtractionError("Extraction result has an invalid 'invoice_date'");
  }
  if (!isNullableString(d.due_date)) {
    throw new ExtractionError("Extraction result has an invalid 'due_date'");
  }
  if (!Array.isArray(d.items) || !d.items.every(isValidInvoiceItem)) {
    throw new ExtractionError("Extraction result has invalid or missing 'items'");
  }
  for (const field of ["subtotal", "vat_rate", "vat_amount", "total", "confidence"] as const) {
    if (typeof d[field] !== "number") {
      throw new ExtractionError(`Extraction result has an invalid '${field}'`);
    }
  }
  if (typeof d.currency !== "string") {
    throw new ExtractionError("Extraction result has an invalid 'currency'");
  }

  return d as unknown as InvoiceExtraction;
}

export const PROMPT = `You are an invoice data extraction system.
Extract all data from this invoice document.

Return a JSON object with exactly these fields:
- vendor (string): company or person who issued the invoice. If the name
  appears in both Hebrew and English, extract the Hebrew name — always use
  the same language for the same company so results are consistent.
- vendor_id (string or null): Israeli business ID (ח.פ. or ע.מ.), null if not found
- invoice_number (string or null): invoice number or reference ID
- invoice_date (string or null): date the invoice was issued, format YYYY-MM-DD
- due_date (string or null): payment due date, null if not specified, format YYYY-MM-DD
- items (array): list of line items, each with:
  - description (string): product or service name
  - quantity (number): number of units
  - unit_price (number): price per single unit in ILS, before VAT
  - line_total (number): quantity * unit_price for this line item
- subtotal (number): total before VAT in ILS
- vat_rate (number): VAT percentage as decimal, e.g. 0.17 for 17%
- vat_amount (number): VAT amount in ILS
- total (number): final total including VAT in ILS
- currency (string): currency code, e.g. ILS, USD, EUR
- confidence (number): 0.0 to 1.0, your certainty that all extracted data is correct

Rules:
- All monetary values must be in ILS (convert if needed)
- vat_rate should be 0.17 for Israeli 17% VAT
- If a field is missing from the invoice, use null
- Return ONLY valid JSON, no explanation text`;

export async function extractInvoice(
  fileBytes: Buffer,
  mimeType: string
): Promise<InvoiceExtraction> {
  if (mimeType !== "application/pdf") {
    throw new ExtractionError("Only application/pdf is supported");
  }

  if (!fileBytes || fileBytes.length === 0) {
    throw new ExtractionError("Empty file");
  }

  if (fileBytes.length > MAX_FILE_SIZE_BYTES) {
    throw new ExtractionError(
      `File too large: max ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
    );
  }

  if (!fileBytes.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    throw new ExtractionError("File is not a valid PDF");
  }

  let responseText: string | undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: [
          { inlineData: { data: fileBytes.toString("base64"), mimeType } },
          { text: PROMPT },
        ],
        config: {
          responseMimeType: "application/json",
          abortSignal: controller.signal,
        },
      });
      responseText = response.text;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("Gemini extraction call failed:", err);
    throw new ExtractionError(
      err instanceof Error && err.name === "AbortError"
        ? `Extraction timed out after ${GEMINI_TIMEOUT_MS / 1000}s`
        : "Extraction service is unavailable"
    );
  }

  if (!responseText) {
    throw new ExtractionError("Extraction produced no data");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch (err) {
    console.error("Gemini response was not valid JSON:", err, responseText);
    throw new ExtractionError("Extraction returned malformed data");
  }

  return validateInvoiceExtraction(parsed);
}

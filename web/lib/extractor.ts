import { GoogleGenAI } from "@google/genai";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const PDF_MAGIC_BYTES = Buffer.from("%PDF-");
const MODEL = "gemini-2.5-flash";

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

const PROMPT = `You are an invoice data extraction system.
Extract all data from this invoice document.

Return a JSON object with exactly these fields:
- vendor (string): company or person who issued the invoice
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
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        { inlineData: { data: fileBytes.toString("base64"), mimeType } },
        { text: PROMPT },
      ],
      config: { responseMimeType: "application/json" },
    });
    responseText = response.text;
  } catch {
    throw new ExtractionError("Extraction service is unavailable");
  }

  if (!responseText) {
    throw new ExtractionError("Extraction produced no data");
  }

  try {
    return JSON.parse(responseText) as InvoiceExtraction;
  } catch {
    throw new ExtractionError("Extraction returned malformed data");
  }
}

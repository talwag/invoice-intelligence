import type { Document } from "./dashboardAggregations";

export function makeDoc(overrides: Partial<Document> & { id: string }): Document {
  return {
    filename: "invoice.pdf",
    status: "done",
    confidence: 0.95,
    created_at: "2026-07-15T10:00:00.000Z",
    edited_at: null,
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

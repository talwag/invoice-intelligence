import type { Document } from "./dashboardAggregations";

export const DEMO_DOCUMENTS: Document[] = [
  {
    id: "demo-doc-1",
    filename: "invoice-alpha-2026-06.pdf",
    status: "done",
    confidence: 0.95,
    created_at: "2026-06-03T09:00:00.000Z",
    edited_at: null,
    extracted_data: {
      vendor: "טכנולוגיות אלפא בע״מ",
      vendor_id: "512345671",
      invoice_number: "INV-2026-0101",
      invoice_date: "2026-06-03",
      due_date: "2026-07-03",
      items: [
        { description: "רישיון תוכנה שנתי", quantity: 1, unit_price: 1000, line_total: 1000 },
      ],
      subtotal: 1000,
      vat_rate: 0.17,
      vat_amount: 170,
      total: 1170,
      currency: "ILS",
      confidence: 0.95,
    },
  },
  {
    id: "demo-doc-2",
    filename: "invoice-beta-2026-06.pdf",
    status: "done",
    confidence: 0.92,
    created_at: "2026-06-15T11:30:00.000Z",
    edited_at: null,
    extracted_data: {
      vendor: "בטא שיווק ופרסום",
      vendor_id: "512345672",
      invoice_number: "INV-2026-0102",
      invoice_date: "2026-06-15",
      due_date: "2026-07-15",
      items: [
        { description: "עיצוב באנרים דיגיטליים", quantity: 3, unit_price: 120, line_total: 360 },
      ],
      subtotal: 360,
      vat_rate: 0.17,
      vat_amount: 61.2,
      total: 421.2,
      currency: "ILS",
      confidence: 0.92,
    },
  },
  {
    id: "demo-doc-3",
    filename: "invoice-alpha-2026-07.pdf",
    status: "done",
    confidence: 0.88,
    created_at: "2026-07-02T08:15:00.000Z",
    edited_at: null,
    extracted_data: {
      vendor: "טכנולוגיות אלפא בע״מ",
      vendor_id: "512345671",
      invoice_number: "INV-2026-0103",
      invoice_date: "2026-07-02",
      due_date: "2026-08-02",
      items: [
        { description: "תמיכה טכנית חודשית", quantity: 2, unit_price: 300, line_total: 600 },
        { description: "עדכון גרסה", quantity: 1, unit_price: 80, line_total: 80 },
      ],
      subtotal: 680,
      vat_rate: 0.17,
      vat_amount: 115.6,
      total: 795.6,
      currency: "ILS",
      confidence: 0.88,
    },
  },
  {
    id: "demo-doc-4",
    filename: "invoice-gamma-2026-07.pdf",
    status: "done",
    confidence: 0.62,
    created_at: "2026-07-20T14:45:00.000Z",
    edited_at: null,
    extracted_data: {
      vendor: "גמא לוגיסטיקה בע״מ",
      vendor_id: "512345673",
      invoice_number: "INV-2026-0104",
      invoice_date: "2026-07-20",
      due_date: "2026-08-19",
      items: [
        { description: "שירותי הובלה בין-עירונית", quantity: 5, unit_price: 380, line_total: 1900 },
      ],
      subtotal: 1900,
      vat_rate: 0.17,
      vat_amount: 323,
      total: 2223,
      currency: "ILS",
      confidence: 0.62,
    },
  },
];

export interface DemoPreset {
  id: string;
  label: string;
  document: Document;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "demo-preset-a",
    label: "דלתא ייעוץ עסקי",
    document: {
      id: "demo-doc-5",
      filename: "invoice-delta-2026-08.pdf",
      status: "done",
      confidence: 0.9,
      created_at: "2026-08-01T10:00:00.000Z",
      edited_at: null,
      extracted_data: {
        vendor: "דלתא ייעוץ עסקי",
        vendor_id: "512345674",
        invoice_number: "INV-2026-0105",
        invoice_date: "2026-08-01",
        due_date: "2026-08-31",
        items: [
          { description: "ייעוץ אסטרטגי", quantity: 4, unit_price: 150, line_total: 600 },
        ],
        subtotal: 600,
        vat_rate: 0.17,
        vat_amount: 102,
        total: 702,
        currency: "ILS",
        confidence: 0.9,
      },
    },
  },
  {
    id: "demo-preset-b",
    label: "אפסילון תוכנה",
    document: {
      id: "demo-doc-6",
      filename: "invoice-epsilon-2026-08.pdf",
      status: "done",
      confidence: 0.85,
      created_at: "2026-08-05T13:20:00.000Z",
      edited_at: null,
      extracted_data: {
        vendor: "אפסילון תוכנה",
        vendor_id: "512345675",
        invoice_number: "INV-2026-0106",
        invoice_date: "2026-08-05",
        due_date: "2026-09-04",
        items: [
          { description: "רישיון SaaS חודשי", quantity: 1, unit_price: 1500, line_total: 1500 },
        ],
        subtotal: 1500,
        vat_rate: 0.17,
        vat_amount: 255,
        total: 1755,
        currency: "ILS",
        confidence: 0.85,
      },
    },
  },
  {
    id: "demo-preset-c",
    label: "זטא הובלות",
    document: {
      id: "demo-doc-7",
      filename: "invoice-zeta-2026-08.pdf",
      status: "done",
      confidence: 0.97,
      created_at: "2026-08-10T16:00:00.000Z",
      edited_at: null,
      extracted_data: {
        vendor: "זטא הובלות",
        vendor_id: "512345676",
        invoice_number: "INV-2026-0107",
        invoice_date: "2026-08-10",
        due_date: "2026-09-09",
        items: [
          { description: "משלוח ציוד", quantity: 2, unit_price: 175, line_total: 350 },
        ],
        subtotal: 350,
        vat_rate: 0.17,
        vat_amount: 59.5,
        total: 409.5,
        currency: "ILS",
        confidence: 0.97,
      },
    },
  },
];

export const DEMO_PDF_PATHS: Record<string, string> = {
  "demo-doc-1": "/demo-samples/sample-1.pdf",
  "demo-doc-2": "/demo-samples/sample-2.pdf",
  "demo-doc-3": "/demo-samples/sample-1.pdf",
  "demo-doc-4": "/demo-samples/sample-3.pdf",
  "demo-doc-5": "/demo-samples/sample-1.pdf",
  "demo-doc-6": "/demo-samples/sample-2.pdf",
  "demo-doc-7": "/demo-samples/sample-3.pdf",
};

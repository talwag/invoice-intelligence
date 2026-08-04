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

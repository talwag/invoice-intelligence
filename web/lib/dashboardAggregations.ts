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

export const STATUS_LABELS: Record<Document["status"], string> = {
  processing: "בעיבוד",
  done: "הושלם",
  failed: "נכשל",
};

export function getMonthOptions(documents: Document[]): string[] {
  const months = new Set(documents.map((d) => d.created_at.slice(0, 7)));
  return Array.from(months).sort().reverse();
}

function hasExtractedData(doc: Document): doc is Document & { extracted_data: ExtractedData } {
  return doc.status === "done" && doc.extracted_data !== null;
}

export function getCompanyOptions(documents: Document[]): string[] {
  const companies = new Set(documents.filter(hasExtractedData).map((d) => d.extracted_data.vendor));
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

export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export function formatILS(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₪${value.toFixed(2)}`;
}

export interface MonthlyTotal {
  month: string;
  total: number;
}

export function getMonthlyTotals(documents: Document[]): MonthlyTotal[] {
  const totals = new Map<string, number>();
  for (const doc of documents.filter(hasExtractedData)) {
    const month = doc.created_at.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + doc.extracted_data.total);
  }
  return Array.from(totals.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function getCumulativeTotal(documents: Document[]): number {
  return documents.filter(hasExtractedData).reduce((sum, d) => sum + d.extracted_data.total, 0);
}

export interface CompanyBreakdown {
  company: string;
  total: number;
}

export function getCompanyBreakdown(documents: Document[]): CompanyBreakdown[] {
  const totals = new Map<string, number>();
  for (const doc of documents.filter(hasExtractedData)) {
    const vendor = doc.extracted_data.vendor;
    totals.set(vendor, (totals.get(vendor) ?? 0) + doc.extracted_data.total);
  }
  return Array.from(totals.entries())
    .map(([company, total]) => ({ company, total }))
    .sort((a, b) => b.total - a.total);
}

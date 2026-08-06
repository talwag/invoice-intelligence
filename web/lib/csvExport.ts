import type { Document } from "./dashboardAggregations";

const CSV_HEADERS = ["Filename", "Date", "Company", "Status", "Confidence", "Total"];

function escapeCsvField(value: string): string {
  // Neutralize CSV/formula injection: a leading '=', '+', '-', or '@' can be
  // interpreted as a formula by some spreadsheet apps when the file is
  // opened. Prefixing with a single quote forces the cell to be read as
  // text (the standard OWASP-recommended mitigation). filename is raw
  // user-uploaded input and company is Gemini-extracted from PDF content,
  // so neither is trustworthy here.
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (guarded.includes(",") || guarded.includes('"') || guarded.includes("\n")) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function documentsToCsv(documents: Document[]): string {
  const rows = documents.map((doc) => {
    const company = doc.extracted_data?.vendor ?? "";
    const confidence = doc.confidence !== null ? `${(doc.confidence * 100).toFixed(0)}%` : "";
    const total = doc.extracted_data ? doc.extracted_data.total.toFixed(2) : "";
    return [
      doc.filename,
      doc.created_at.slice(0, 10),
      company,
      doc.status,
      confidence,
      total,
    ]
      .map(escapeCsvField)
      .join(",");
  });
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function downloadCsv(csvContent: string, filename: string): void {
  // Prepend a UTF-8 BOM so Excel reliably detects the encoding instead of
  // guessing (and mangling Hebrew vendor/company names). This is a
  // presentation/download concern, so it belongs here, not in documentsToCsv.
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

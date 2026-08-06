import type { Document } from "./dashboardAggregations";

const CSV_HEADERS = ["Filename", "Date", "Company", "Status", "Confidence", "Total"];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

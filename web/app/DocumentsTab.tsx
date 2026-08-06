"use client";

import {
  formatMonthLabel,
  type Document,
  type SortColumn,
  type SortDirection,
} from "@/lib/dashboardAggregations";
import { documentsToCsv, downloadCsv } from "@/lib/csvExport";

interface DocumentsTabProps {
  documents: Document[];
  monthOptions: string[];
  companyOptions: string[];
  selectedMonth: string | null;
  selectedCompany: string | null;
  sortBy: SortColumn;
  sortDirection: SortDirection;
  onMonthChange: (month: string | null) => void;
  onCompanyChange: (company: string | null) => void;
  onSortChange: (column: SortColumn) => void;
  onSelectDocument: (doc: Document) => void;
  isRefreshing: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) {
    return <span className="text-zinc-400">—</span>;
  }
  const color =
    confidence >= 0.8
      ? "bg-green-100 text-green-800"
      : confidence >= 0.6
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {(confidence * 100).toFixed(0)}%
    </span>
  );
}

function StatusBadge({ status }: { status: Document["status"] }) {
  const styles: Record<Document["status"], string> = {
    processing: "bg-blue-100 text-blue-800",
    done: "bg-zinc-100 text-zinc-800",
    failed: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDirection,
  onSortChange,
}: {
  label: string;
  column: SortColumn;
  sortBy: SortColumn;
  sortDirection: SortDirection;
  onSortChange: (column: SortColumn) => void;
}) {
  const active = sortBy === column;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={() => onSortChange(column)}
        className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {label}
        {active && <span>{sortDirection === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

export default function DocumentsTab({
  documents,
  monthOptions,
  companyOptions,
  selectedMonth,
  selectedCompany,
  sortBy,
  sortDirection,
  onMonthChange,
  onCompanyChange,
  onSortChange,
  onSelectDocument,
  isRefreshing,
}: DocumentsTabProps) {
  function handleExport() {
    const csv = documentsToCsv(documents);
    downloadCsv(csv, `invoices-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <select
          value={selectedMonth ?? ""}
          onChange={(e) => onMonthChange(e.target.value || null)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">All months</option>
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {formatMonthLabel(month)}
            </option>
          ))}
        </select>

        <select
          value={selectedCompany ?? ""}
          onChange={(e) => onCompanyChange(e.target.value || null)}
          className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">All companies</option>
          {companyOptions.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>

        <button
          onClick={handleExport}
          className="ml-auto rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Export to CSV
        </button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-3 font-medium">Filename</th>
            <SortableHeader
              label="Date"
              column="date"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <SortableHeader
              label="Company"
              column="company"
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
            />
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {isRefreshing ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                Refreshing...
              </td>
            </tr>
          ) : documents.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                No matching documents
              </td>
            </tr>
          ) : (
            documents.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => onSelectDocument(doc)}
                className="cursor-pointer bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{doc.filename}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {new Date(doc.created_at).toLocaleDateString("en-US")}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {doc.extracted_data?.vendor ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge confidence={doc.confidence} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

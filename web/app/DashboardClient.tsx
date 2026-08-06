"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import DocumentsTab from "./DocumentsTab";
import SummaryTab from "./SummaryTab";
import {
  filterDocuments,
  formatILS,
  getCompanyOptions,
  getMonthOptions,
  sortDocuments,
  type Document,
  type SortColumn,
  type SortDirection,
} from "@/lib/dashboardAggregations";

export type { Document };

type Tab = "documents" | "summary";

export default function DashboardClient({
  initialDocuments,
}: {
  initialDocuments: Document[];
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const monthOptions = useMemo(() => getMonthOptions(initialDocuments), [initialDocuments]);
  const companyOptions = useMemo(() => getCompanyOptions(initialDocuments), [initialDocuments]);

  const visibleDocuments = useMemo(() => {
    const filtered = filterDocuments(initialDocuments, {
      month: selectedMonth,
      company: selectedCompany,
    });
    return sortDocuments(filtered, sortBy, sortDirection);
  }, [initialDocuments, selectedMonth, selectedCompany, sortBy, sortDirection]);

  function handleSortChange(column: SortColumn) {
    if (column === sortBy) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadMessage({ type: "error", text: "רק קבצי PDF נתמכים" });
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error ?? "העלאה נכשלה");
      }

      setUploadMessage({ type: "success", text: `הקובץ ${file.name} עובד בהצלחה` });
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadMessage({
        type: "error",
        text: err instanceof Error ? err.message : "העלאה נכשלה",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence
          </h1>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {uploading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900" />
              )}
              {uploading ? "מעבד..." : "Upload PDF"}
            </button>
          </div>
        </div>

        {uploadMessage && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${
              uploadMessage.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {uploadMessage.text}
          </div>
        )}

        <div className="mt-8 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "documents"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            מסמכים
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "summary"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            סיכום
          </button>
        </div>

        <div className="overflow-hidden rounded-b-lg border-x border-b border-zinc-200 dark:border-zinc-800">
          {activeTab === "documents" ? (
            <DocumentsTab
              documents={visibleDocuments}
              monthOptions={monthOptions}
              companyOptions={companyOptions}
              selectedMonth={selectedMonth}
              selectedCompany={selectedCompany}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onMonthChange={setSelectedMonth}
              onCompanyChange={setSelectedCompany}
              onSortChange={handleSortChange}
              onSelectDocument={setSelectedDocument}
              isRefreshing={isRefreshing}
            />
          ) : (
            <SummaryTab documents={initialDocuments} />
          )}
        </div>
      </div>

      {selectedDocument && (
        <DocumentPanel document={selectedDocument} onClose={() => setSelectedDocument(null)} />
      )}
    </div>
  );
}

function DocumentPanel({
  document,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  const data = document.extracted_data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {document.filename}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        {!data ? (
          <p className="mt-6 text-sm text-zinc-500">
            {document.status === "processing"
              ? "המסמך עדיין בעיבוד..."
              : "לא נמצאו נתונים מחולצים"}
          </p>
        ) : (
          <div className="mt-6 space-y-4 text-sm">
            {data.confidence < 0.7 && (
              <div className="rounded-lg bg-yellow-50 px-4 py-3 text-yellow-800">
                ⚠ רמת ביטחון נמוכה בחילוץ הנתונים (
                {(data.confidence * 100).toFixed(0)}%) — יש לבדוק ידנית
              </div>
            )}

            <dl className="space-y-2">
              <Field label="ספק" value={data.vendor} />
              <Field label="ח.פ / ע.מ" value={data.vendor_id} />
              <Field label="מספר חשבונית" value={data.invoice_number} />
              <Field label="תאריך חשבונית" value={data.invoice_date} />
              <Field label="תאריך לתשלום" value={data.due_date} />
            </dl>

            <div>
              <h3 className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">פריטים</h3>
              <table className="w-full text-xs">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="pb-1">תיאור</th>
                    <th className="pb-1 text-right">כמות</th>
                    <th className="pb-1 text-right">מחיר יחידה</th>
                    <th className="pb-1 text-right">סה&quot;כ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.items.map((item, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{item.description}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right">{formatILS(item.unit_price)}</td>
                      <td className="py-1.5 text-right">{formatILS(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <Field label="סכום ביניים" value={formatILS(data.subtotal)} />
              <Field
                label={`מע"מ (${(data.vat_rate * 100).toFixed(0)}%)`}
                value={formatILS(data.vat_amount)}
              />
              <Field label='סה"כ לתשלום' value={formatILS(data.total)} bold />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  bold,
}: {
  label: string;
  value: string | number | null | undefined;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-900 dark:text-zinc-100 ${bold ? "font-semibold" : ""}`}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

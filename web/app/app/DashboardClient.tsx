"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import DocumentsTab from "./DocumentsTab";
import SummaryTab from "./SummaryTab";
import DocumentPanel from "./DocumentPanel";
import {
  filterDocuments,
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
  loadError,
}: {
  initialDocuments: Document[];
  loadError?: string | null;
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
      setUploadMessage({ type: "error", text: "נתמכים רק קבצי PDF" });
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
        throw new Error(result.error ?? "ההעלאה נכשלה");
      }

      setUploadMessage({ type: "success", text: `${file.name} הועלה בהצלחה` });
      startTransition(() => router.refresh());
    } catch (err) {
      setUploadMessage({
        type: "error",
        text: err instanceof Error ? err.message : "ההעלאה נכשלה",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              title="התנתק מהאפליקציה"
              className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              התנתק
            </button>
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
              title="העלה חשבונית PDF לחילוץ אוטומטי"
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {uploading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900" />
              )}
              {uploading ? "מעבד..." : "העלה PDF"}
            </button>
          </div>
        </div>

        {loadError && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        )}

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
            title="צפה בכל המסמכים שהועלו"
            className={`cursor-pointer px-4 py-2 text-sm font-medium ${
              activeTab === "documents"
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            מסמכים
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            title="צפה בסכומים ובפילוחים על כל המסמכים"
            className={`cursor-pointer px-4 py-2 text-sm font-medium ${
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
        <DocumentPanel
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDocumentUpdated={(updated) => {
            setSelectedDocument(updated);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

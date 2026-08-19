"use client";

import { useMemo, useState } from "react";
import DocumentsTab from "../app/DocumentsTab";
import SummaryTab from "../app/SummaryTab";
import DemoDocumentPanel from "./DemoDocumentPanel";
import {
  filterDocuments,
  getCompanyOptions,
  getMonthOptions,
  sortDocuments,
  type Document,
  type SortColumn,
  type SortDirection,
} from "@/lib/dashboardAggregations";
import { DEMO_PRESETS, type DemoPreset } from "@/lib/demoData";

type Tab = "documents" | "summary";

const ADD_SAMPLE_DELAY_MS = 1200;

export default function DemoDashboardClient({
  initialDocuments,
}: {
  initialDocuments: Document[];
}) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [addingPreset, setAddingPreset] = useState<DemoPreset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const monthOptions = useMemo(() => getMonthOptions(documents), [documents]);
  const companyOptions = useMemo(() => getCompanyOptions(documents), [documents]);

  const visibleDocuments = useMemo(() => {
    const filtered = filterDocuments(documents, {
      month: selectedMonth,
      company: selectedCompany,
    });
    return sortDocuments(filtered, sortBy, sortDirection);
  }, [documents, selectedMonth, selectedCompany, sortBy, sortDirection]);

  const availablePresets = useMemo(
    () => DEMO_PRESETS.filter((preset) => !documents.some((doc) => doc.id === preset.document.id)),
    [documents]
  );

  function handleSortChange(column: SortColumn) {
    if (column === sortBy) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  function pickPreset(preset: DemoPreset) {
    setPickerOpen(false);
    setAddingPreset(preset);
    setAddMessage(null);
    setTimeout(() => {
      setDocuments((docs) => [preset.document, ...docs]);
      setAddingPreset(null);
      setAddMessage(`${preset.document.filename} נוסף בהצלחה`);
    }, ADD_SAMPLE_DELAY_MS);
  }

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Invoice Intelligence — דמו
          </h1>

          <div className="relative">
            <button
              onClick={() => setPickerOpen((open) => !open)}
              disabled={!!addingPreset || availablePresets.length === 0}
              title="הוסף חשבונית לדוגמה"
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {addingPreset && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900" />
              )}
              {addingPreset ? "מעבד..." : "הוסף חשבונית לדוגמה"}
            </button>

            {pickerOpen && (
              <div className="absolute end-0 z-10 mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => pickPreset(preset)}
                    title={`הוסף חשבונית מ${preset.label}`}
                    className="block w-full cursor-pointer px-4 py-2 text-start text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {addMessage && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {addMessage}
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
              isRefreshing={false}
            />
          ) : (
            <SummaryTab documents={documents} />
          )}
        </div>
      </div>

      {selectedDocument && (
        <DemoDocumentPanel
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDocumentUpdated={(updated) => {
            setSelectedDocument(updated);
            setDocuments((docs) => docs.map((doc) => (doc.id === updated.id ? updated : doc)));
          }}
        />
      )}
    </div>
  );
}
